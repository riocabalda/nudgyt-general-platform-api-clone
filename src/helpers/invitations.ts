import createHttpError from 'http-errors';
import { kebabCase } from 'lodash';
import z from 'zod';
import frontendConfig from '../config/frontend.config';
import organizationConfig from '../config/organization.config';
import invitationStatus from '../constants/invitation-status';
import { InvitationLogType } from '../constants/logs';
import roles from '../constants/roles';
import { RequestAuth } from '../middlewares/require-permissions';
import Enterprise from '../models/enterprise.model';
import Organization, {
  OrganizationType
} from '../models/organization.model';
import User, {
  OrganizationMembership,
  PendingOrganization,
  UserType
} from '../models/user.model';
import adminOrganizationService from '../services/admin/organization.service';
import encryptionService from '../services/encryption.service';
import logService from '../services/log.service';
import mailService from '../services/mail.service';
import userService from '../services/user.service';
import dayjsUTCDate from '../utils/dayjs-utc-date';
import { generateLogDetails } from '../utils/generate-log-details';
import { InviteUserSchema } from '../validations/admin/user.validation';
import {
  InvitationTokenSchema,
  InvitationTypeSchema
} from '../validations/auth.validation';
import {
  decryptFieldData,
  encryptFieldData,
  ProtectedField
} from './db';
import {
  getJoinInvitationEmailData,
  getOwnerInvitationEmailData,
  getPublicJoinInvitationEmailData
} from './emails';

async function inviteExistingUser(args: {
  invitingUser: UserType;
  existingUserDoc: UserType;
  orgDoc: OrganizationType;
  role: z.infer<typeof InviteUserSchema>['role'];
  reqAuth: RequestAuth;
}) {
  const { invitingUser } = args;
  const { existingUserDoc, orgDoc, role } = args;
  const { reqAuth } = args;

  const orgId = orgDoc._id;
  const userId = existingUserDoc._id;

  const orgName = decryptFieldData(orgDoc.name);
  const userName = decryptFieldData(existingUserDoc.full_name);
  const userEmail = decryptFieldData(existingUserDoc.email);

  const existingMembership = existingUserDoc.organizations?.find(
    (membership) => membership.organization._id.equals(orgId)
  );
  if (existingMembership !== undefined) {
    if (existingMembership.status === invitationStatus.ACCEPTED) {
      throw createHttpError.Conflict(
        'User is already member of given organization'
      );
    }

    if (existingMembership.status === invitationStatus.PENDING) {
      throw createHttpError.Conflict(
        'User is already invited to this organization'
      );
    }

    /** Reset invitation only if previously declined */
    if (existingMembership.status === invitationStatus.DECLINED) {
      existingMembership.status = invitationStatus.PENDING;
      existingMembership.pending_at = dayjsUTCDate() as any;
    }

    await existingUserDoc.save();
  } else {
    /** Directly add organization membership */
    const newMembership: Partial<OrganizationMembership> = {
      organization: orgId,
      roles: [role],
      status: invitationStatus.PENDING,
      pending_at: dayjsUTCDate() as any,

      approved_at: dayjsUTCDate() as any // Auto-approve membership as it is an invitation
    };
    existingUserDoc.organizations?.push(newMembership as any);

    await existingUserDoc.save();
  }

  /**
   * Get slug of first valid membership
   *
   * Used for redirecting to frontend Account page,
   * for accepting invite
   */
  const firstValidMembership = existingUserDoc.organizations?.find(
    (membership) => membership.status === invitationStatus.ACCEPTED
  );
  if (firstValidMembership === undefined) {
    throw createHttpError.BadRequest(
      'User is not a member of any organizations'
    );
  }

  const firstOrgSlug = decryptFieldData(
    firstValidMembership.organization.slug
  );
  const actorUserFullName = decryptFieldData(invitingUser.full_name);

  const url = [
    frontendConfig.url,
    firstOrgSlug,
    role.toLowerCase(),
    'account'
  ].join('/');

  /** Send mail */
  const emailData = getJoinInvitationEmailData('existing-user', role, {
    email: userEmail,
    orgName,
    recipient: userName,
    url
  });
  if (emailData === null) {
    throw createHttpError.BadRequest('Unsupported role');
  }

  const { emailPayload, templateData, template } = emailData;
  await mailService.sendMail(emailPayload, templateData, template);

  /** Log invitation */
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: orgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      user: userId,
      email: userEmail
    }),
    type: InvitationLogType.INVITE_EXISTING,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: userEmail,
        type: 'invited'
      })
    )
  });
}

export async function inviteUser(args: {
  email: string;
  role: z.infer<typeof InviteUserSchema>['role'];
  user: UserType;
  organization: string;
  reqAuth: RequestAuth;
}) {
  const { email, role, user, organization } = args;
  const { reqAuth } = args;

  const isInvitingToPublicOrg =
    organization === organizationConfig.PUBLIC_ORGANIZATION_NAME;

  const encryptedOrgName = encryptFieldData(organization);
  const encryptedEmail = encryptFieldData(email);

  /** Get organization ID */
  const orgDoc = await Organization.findOne({
    'name.hash': encryptedOrgName.hash
  });
  if (orgDoc === null) {
    throw createHttpError.NotFound(
      'Organization to invite user to does not exist'
    );
  }
  const orgId = orgDoc.id;

  const orgSlug = decryptFieldData(orgDoc.slug);
  const actorUserFullName = decryptFieldData(user.full_name);

  /**
   * Check if org can invite more learners
   *
   * Only if not public!
   */
  if (!isInvitingToPublicOrg) {
    const orgLearnersLimit =
      await adminOrganizationService.getOrganizationLearnersLimit(
        orgSlug
      );
    const orgMembersCount =
      await adminOrganizationService.getOrganizationMembersCount(
        orgSlug,
        ['Learner']
      );
    if (orgMembersCount >= orgLearnersLimit)
      throw createHttpError.BadRequest(
        `Learner limit reached: ${orgMembersCount} out of ${orgLearnersLimit}.`
      );
  }

  /** Dedicated logic for existing users */
  const existingUserDoc = await User.findOne({
    'email.hash': encryptedEmail.hash,
    is_guest: false,
    archived_at: null
  }).populate('organizations.organization');
  if (existingUserDoc !== null) {
    return await inviteExistingUser({
      invitingUser: user,
      existingUserDoc,
      orgDoc,
      role,
      reqAuth
    });
  }

  /** Determine invitation type */
  let invitationType: z.infer<typeof InvitationTypeSchema> =
    'organization-user';
  if (isInvitingToPublicOrg) {
    invitationType = 'public-user';
  }

  /** Generate invitation token */
  const tokenPayload: z.infer<typeof InvitationTokenSchema> = {
    email,
    role,
    organization_id: orgId,
    type: invitationType
  };
  const token = encryptionService.generateToken({
    payload: tokenPayload,
    expiresIn: 24 * 60 * 60 // 24 hours
  });

  /** Generate invitation link */
  const invitationUrl = new URL('/sign-up', frontendConfig.url);
  invitationUrl.searchParams.set('invitation_token', token);
  invitationUrl.searchParams.set('type', invitationType);
  invitationUrl.searchParams.set('email', email);
  invitationUrl.searchParams.set('role', role);
  invitationUrl.searchParams.set('organization', organization);

  const invitationLink = invitationUrl.toString();

  /** Send email */
  if (isInvitingToPublicOrg) {
    const emailData = getPublicJoinInvitationEmailData(role, {
      email,
      recipient: email, // Should be user's name but it is not available upon invitation
      url: invitationLink
    });
    if (emailData === null) {
      throw createHttpError.BadRequest('Unsupported role');
    }

    const { emailPayload, templateData, template } = emailData;
    await mailService.sendMail(emailPayload, templateData, template);
  } else {
    const emailData = getJoinInvitationEmailData('new-user', role, {
      email,
      orgName: organization,
      recipient: email, // Should be user's name but it is not available upon invitation
      url: invitationLink
    });
    if (emailData === null) {
      throw createHttpError.BadRequest('Unsupported role');
    }

    const { emailPayload, templateData, template } = emailData;
    await mailService.sendMail(emailPayload, templateData, template);
  }

  /** Log invitation */
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: orgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      user: user._id,
      email
    }),
    type: InvitationLogType.INVITE,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: email,
        type: 'invited'
      })
    )
  });
}

async function inviteExistingUserAsOwnerBasic(args: {
  existingUser: UserType;
  encryptedOrgName: ProtectedField;
  email: string;
  organizationName: string;
  invitingUser: UserType;
  reqAuth: RequestAuth;
}) {
  const { existingUser, encryptedOrgName } = args;
  const { email, organizationName } = args; // Can be inferred from above...
  const { invitingUser, reqAuth } = args;

  /** Disallow duplicate pending organizations */
  const existingPendingOrg = existingUser.pending_organizations?.find(
    (org) => org.name.hash === encryptedOrgName.hash
  );
  if (existingPendingOrg !== undefined) {
    if (existingPendingOrg.status === invitationStatus.PENDING) {
      throw createHttpError.BadRequest(
        'User has a pending invite to this organization'
      );
    }

    /**
     * Should check here if organization already exists
     * However, that is already checked before reaching this function
     */
    if (existingPendingOrg.status === invitationStatus.ACCEPTED) {
    }

    if (existingPendingOrg.status === invitationStatus.DECLINED) {
    }

    /** Reuse existing entry */
    existingPendingOrg.status = invitationStatus.PENDING;
    existingPendingOrg.pending_at = dayjsUTCDate() as any;

    await existingUser.save();
  } else {
    /** Create new pending organization entry */
    const pendingOrg: Partial<PendingOrganization> = {
      name: encryptedOrgName,
      status: invitationStatus.PENDING,
      pending_at: dayjsUTCDate() as any
    };
    existingUser.pending_organizations?.push(pendingOrg as any);

    await existingUser.save();
  }

  /** Find first organization */
  const firstOrg = existingUser.organizations?.[0];
  if (firstOrg === undefined) {
    throw createHttpError.Conflict('User has no organization...?');
  }

  const firstOrgRole = firstOrg.roles[0];
  if (firstOrgRole === undefined) {
    throw createHttpError.Conflict(
      'User has no organization roles...?'
    );
  }

  const invitingUserOrgId = reqAuth.membership.organization._id;
  const firstOrgSlug = decryptFieldData(firstOrg.organization.slug);
  const fullName = decryptFieldData(existingUser.full_name);
  const actorUserFullName = decryptFieldData(invitingUser.full_name);

  /** Generate invitation link */
  const invitationLink = [
    frontendConfig.url,
    firstOrgSlug,
    firstOrgRole.toLowerCase(),
    'account'
  ].join('/');

  /** Send email */
  const emailData = getOwnerInvitationEmailData('basic', {
    email,
    orgName: organizationName,
    recipient: fullName,
    url: invitationLink
  });
  if (emailData === null) {
    throw createHttpError.BadRequest('Unsupported role');
  }

  const { emailPayload, templateData, template } = emailData;
  await mailService.sendMail(emailPayload, templateData, template);

  /** Log invitation */
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: invitingUserOrgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      user: invitingUser._id,
      email
    }),
    type: InvitationLogType.INVITE_EXISTING_AS_OWNER,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: email,
        type: 'invited'
      })
    )
  });
}

export async function inviteOwnerBasic(args: {
  invitingUser: UserType;
  organizationName: string;
  email: string;
  reqAuth: RequestAuth;
}) {
  const { invitingUser } = args;
  const { organizationName, email } = args;
  const { reqAuth } = args;

  const role = roles.ADMIN;
  const invitationType: z.infer<typeof InvitationTypeSchema> =
    'basic-organization-owner';

  const isInvitingUserSuperAdmin = invitingUser.is_super_admin ?? false;
  const { isPublicAdmin } =
    userService.checkUserIfPublicAdmin(invitingUser);

  const canInviteNewOwners = isInvitingUserSuperAdmin || isPublicAdmin;
  if (!canInviteNewOwners) {
    throw createHttpError.Forbidden('Cannot invite new owners');
  }

  const invitingUserOrgId = reqAuth.membership.organization._id;
  const organizationSlug = kebabCase(organizationName);

  const encryptedOrgName = encryptFieldData(organizationName);
  const encryptedOrgSlug = encryptFieldData(organizationSlug);
  const encryptedEmail = encryptFieldData(email);

  const existingOrg = await Organization.findOne({
    $or: [
      { 'name.hash': encryptedOrgName.hash },
      { 'slug.hash': encryptedOrgSlug.hash }
    ]
  });
  if (existingOrg !== null) {
    throw createHttpError.Conflict('Organization already exists');
  }

  const existingUser = await User.findOne({
    'email.hash': encryptedEmail.hash
  }).populate('organizations.organization');
  if (existingUser !== null) {
    return await inviteExistingUserAsOwnerBasic({
      existingUser,
      encryptedOrgName,
      email,
      organizationName,
      invitingUser,
      reqAuth
    });
  }

  /** Generate invitation token */
  const tokenPayload: z.infer<typeof InvitationTokenSchema> = {
    email,
    role,
    organization_id: invitingUserOrgId.toString(), // Should not be used on sign up!
    type: invitationType
  };
  const token = encryptionService.generateToken({
    payload: tokenPayload,
    expiresIn: 24 * 60 * 60 // 24 hours
  });

  /** Generate invitation link */
  const invitationUrl = new URL('/sign-up', frontendConfig.url);
  invitationUrl.searchParams.set('invitation_token', token);
  invitationUrl.searchParams.set('type', invitationType);
  invitationUrl.searchParams.set('email', email);
  invitationUrl.searchParams.set('role', role);
  invitationUrl.searchParams.set('organization', organizationName);

  const invitationLink = invitationUrl.toString();

  /** Send email */
  const emailData = getOwnerInvitationEmailData('basic', {
    email,
    orgName: organizationName,
    recipient: email, // Should be user's name but it is not available upon invitation
    url: invitationLink
  });
  if (emailData === null) {
    throw createHttpError.BadRequest('Unsupported role');
  }

  const { emailPayload, templateData, template } = emailData;
  await mailService.sendMail(emailPayload, templateData, template);

  const actorUserFullName = decryptFieldData(invitingUser.full_name);

  /** Log invitation */
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: invitingUserOrgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      user: invitingUser._id,
      email
    }),
    type: InvitationLogType.INVITE_OWNER,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: email,
        type: 'invited'
      })
    )
  });
}

export async function inviteOwnerEnterprise(args: {
  invitingUser: UserType;
  monthlyAmount: number;
  userSeats: number;
  organizationName: string;
  email: string;
  platformUrl: string;
  reqAuth: RequestAuth;
}) {
  const { invitingUser } = args;
  const {
    monthlyAmount,
    userSeats,
    organizationName,
    email,
    platformUrl
  } = args;
  const { reqAuth } = args;

  const role = roles.ADMIN;
  const invitationType: z.infer<typeof InvitationTypeSchema> =
    'enterprise-organization-owner';

  const isInvitingUserSuperAdmin = invitingUser.is_super_admin ?? false;
  const { isPublicAdmin } =
    userService.checkUserIfPublicAdmin(invitingUser);

  const canInviteNewOwners = isInvitingUserSuperAdmin || isPublicAdmin;
  if (!canInviteNewOwners) {
    throw createHttpError.Forbidden('Cannot invite new owners');
  }

  const invitingUserOrgId = reqAuth.membership.organization._id;
  const encryptedOrgName = encryptFieldData(organizationName);
  const encryptedEmail = encryptFieldData(email);
  const encryptedUrl = encryptFieldData(platformUrl);

  /** Check if enterprise already exists */
  const existingDoc = await Enterprise.findOne({
    $or: [
      { 'organization_name.hash': encryptedOrgName.hash },
      { 'email.hash': encryptedEmail.hash }
    ]
  });
  if (existingDoc !== null) {
    throw createHttpError.Conflict('Enterprise record already exists');
  }

  /** Create new enterprise record */
  const enterpriseDoc = new Enterprise({
    monthly_amount: monthlyAmount,
    user_seats: userSeats,
    organization_name: encryptedOrgName,
    email: encryptedEmail,
    platform_url: encryptedUrl
  });
  await enterpriseDoc.save();

  // TODO Generate this on the new platform itself?
  /** Generate invitation token */
  const tokenPayload: z.infer<typeof InvitationTokenSchema> = {
    email,
    role,
    organization_id: invitingUserOrgId.toString(), // Should not be used on sign up!
    type: invitationType
  };
  const token = encryptionService.generateToken({
    payload: tokenPayload,
    expiresIn: 24 * 60 * 60 // 24 hours
  });

  /** Generate invitation link */
  const invitationUrl = new URL('/sign-up', platformUrl); // Redirects to the platform itself
  invitationUrl.searchParams.set('invitation_token', token);
  invitationUrl.searchParams.set('type', invitationType);
  invitationUrl.searchParams.set('email', email);
  invitationUrl.searchParams.set('role', role);
  invitationUrl.searchParams.set('organization', organizationName);

  const invitationLink = invitationUrl.toString();

  /** Send email */
  const emailData = getOwnerInvitationEmailData('enterprise', {
    email,
    orgName: organizationName,
    recipient: email, // Should be user's name but it is not available upon invitation
    url: invitationLink
  });
  if (emailData === null) {
    throw createHttpError.BadRequest('Unsupported role');
  }

  const { emailPayload, templateData, template } = emailData;
  await mailService.sendMail(emailPayload, templateData, template);

  const actorUserFullName = decryptFieldData(invitingUser.full_name);

  /** Log invitation */
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: invitingUserOrgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      user: invitingUser._id,
      email
    }),
    type: InvitationLogType.INVITE_ENTERPRISE,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: email,
        type: 'invited'
      })
    )
  });
}
