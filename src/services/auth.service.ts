import createHttpError from 'http-errors';
import { ClientSession } from 'mongoose';
import z from 'zod';
import encryptionConfig from '../config/encryption.config';
import frontendConfig from '../config/frontend.config';
import organizationConfig from '../config/organization.config';
import invitationStatus from '../constants/invitation-status';
import { UserLogType } from '../constants/logs';
import messages from '../constants/response-messages';
import roles from '../constants/roles';
import { decryptFieldData, encryptFieldData } from '../helpers/db';
import {
  getAccountVerificationEmailData,
  getForgotPasswordEmailData
} from '../helpers/emails';
import Organization from '../models/organization.model';
import RefreshToken from '../models/refresh-token.model';
import { SubscriptionStatusEnum } from '../models/subscription.model';
import User, {
  OrganizationMembership,
  UserType
} from '../models/user.model';
import dayjsUTCDate from '../utils/dayjs-utc-date';
import {
  AccessTokenSchema,
  InvitationTokenSchema,
  PasswordResetTokenSchema,
  RefreshTokenSchema,
  RegisterSchema
} from '../validations/auth.validation';
import subscriptionPlanService from './admin/subscription-plan.service';
import subscriptionService from './admin/subscription.service';
import encryptionService from './encryption.service';
import logService from './log.service';
import mailService from './mail.service';
import organizationService from './organization.service';
import userService from './user.service';

async function getActiveUserByEmail(email: string) {
  const encryptedEmail = encryptFieldData(email);

  const user = await User.findOne({
    'email.hash': encryptedEmail.hash,
    archived_at: null,
    is_guest: false
  }).populate('organizations.organization');

  return user;
}

async function loginUser(email: string, password: string) {
  const user = await getActiveUserByEmail(email);
  if (!user)
    throw createHttpError.BadRequest(messages.AUTH_INVALID_CREDENTIALS);

  /** Use separate messages for when user is blocked or not approved? */
  const defaultMembership = userService.getUserDefaultMembership(user);
  if (defaultMembership === null) {
    throw createHttpError.Forbidden(
      'Your account has no access to this platform.'
    );
  }

  if (!user.email_verified_at)
    throw createHttpError.Forbidden(
      'Your account is not yet verified.'
    );

  const isPasswordValid = await encryptionService.verifyHash(
    password,
    user.password
  );
  if (!isPasswordValid)
    throw createHttpError.Forbidden(messages.AUTH_INVALID_CREDENTIALS);

  await user.updateOne({ last_logged_in_at: dayjsUTCDate() });

  const userId = user.id;
  const sanitizedUser = userService.sanitizeUser(user);

  /** Might be able to optimize using `.findOneAndUpdate()` with upsert */
  let refreshTokenDoc = await RefreshToken.findOne({ user_id: userId });
  if (refreshTokenDoc === null) {
    refreshTokenDoc = new RefreshToken({ user_id: userId });
  }

  const accessTokenPayload: z.infer<typeof AccessTokenSchema> = {
    userId
  };
  const refreshTokenPayload: z.infer<typeof RefreshTokenSchema> = {
    id: refreshTokenDoc.id
  };

  const accessToken = encryptionService.generateToken({
    payload: accessTokenPayload,
    expiresIn: encryptionConfig.accessTokenExpiration
  });
  const refreshToken = encryptionService.generateToken({
    payload: refreshTokenPayload,
    expiresIn: encryptionConfig.refreshTokenExpiration
  });

  const refreshTokenExpiry =
    encryptionService.getTokenExpiry(refreshToken);
  if (refreshTokenExpiry === null) {
    console.warn('Token has no expiry...?');

    throw createHttpError.BadRequest();
  }

  /**
   * Store refresh token as hashed
   *
   * https://stackoverflow.com/q/59511628
   */
  const refreshTokenHashed = await encryptionService.generateHashScrypt(
    refreshToken
  );
  refreshTokenDoc.tokens.push({
    token: refreshTokenHashed,
    expire_at: refreshTokenExpiry
  });
  await refreshTokenDoc.save();

  /** Prepare log details */
  const firstMembership = user.organizations?.[0];
  if (firstMembership === undefined) {
    throw createHttpError.Conflict('User has no organizations');
  }

  const userFirstOrgId = firstMembership.organization._id;
  const userFirstOrgRole = firstMembership.roles[0];

  const userFullName = decryptFieldData(user.full_name);
  const userFirstOrgName = decryptFieldData(
    firstMembership.organization.name
  );

  /** Log user login */
  await logService.createLog({
    organization: userFirstOrgId,
    payload_snapshot: logService.encryptPayloadSnapshot({
      email
    }),
    type: UserLogType.LOGIN,
    activity: encryptFieldData(
      `${userFullName} (${userFirstOrgName} ${userFirstOrgRole}) logged in`
    )
  });

  return { user: sanitizedUser, accessToken, refreshToken };
}

async function refreshAccessToken(refreshToken: string) {
  const { data: rawPayload } =
    encryptionService.verifyTokenSafely(refreshToken);
  if (!rawPayload) throw createHttpError.Unauthorized();

  const { data: payload } = RefreshTokenSchema.safeParse(rawPayload);
  if (!payload) throw createHttpError.Unauthorized();

  const { id } = payload;

  const refreshTokenDoc = await RefreshToken.findById(id);
  if (!refreshTokenDoc) throw createHttpError.Unauthorized();

  let nestedTokenId: string | null = null;
  for (const nestedToken of refreshTokenDoc.tokens) {
    const isMatch = await encryptionService.verifyHashScrypt(
      refreshToken,
      nestedToken.token
    );
    if (!isMatch) continue;

    nestedTokenId = nestedToken.id;
    break;
  }

  /** Remove ALL stored tokens if provided refresh token is not stored */
  if (nestedTokenId === null) {
    await refreshTokenDoc.updateOne({ tokens: [] });

    throw createHttpError.Unauthorized();
  }

  /** Remove current refresh token from database */
  refreshTokenDoc.tokens.pull(nestedTokenId);

  const userId = refreshTokenDoc.user_id;
  const newAccessTokenPayload: z.infer<typeof AccessTokenSchema> = {
    userId
  };
  const newRefreshTokenPayload: z.infer<typeof RefreshTokenSchema> = {
    id
  };

  const newAccessToken = encryptionService.generateToken({
    payload: newAccessTokenPayload,
    expiresIn: encryptionConfig.accessTokenExpiration
  });
  const newRefreshToken = encryptionService.generateToken({
    payload: newRefreshTokenPayload,
    expiresIn: encryptionConfig.refreshTokenExpiration
  });

  const newRefreshTokenExpiry =
    encryptionService.getTokenExpiry(newRefreshToken);
  if (newRefreshTokenExpiry === null) {
    console.warn('Token has no expiry...?');

    throw createHttpError.BadRequest();
  }

  /**
   * Store refresh token as hashed
   *
   * https://stackoverflow.com/q/59511628
   */
  const newRefreshTokenHashed =
    await encryptionService.generateHashScrypt(newRefreshToken);
  refreshTokenDoc.tokens.push({
    token: newRefreshTokenHashed,
    expire_at: newRefreshTokenExpiry
  });

  await refreshTokenDoc.save();
  return { newAccessToken, newRefreshToken };
}

async function sendAccountVerificationEmailToUser(
  user: UserType,
  isApproved?: boolean
) {
  if (!user.verification_token)
    throw createHttpError.InternalServerError(
      'Verification token is required.'
    );

  const firstOrg = user.organizations?.[0];
  if (firstOrg === undefined) {
    throw createHttpError.NotFound('User has no organizations');
  }

  const firstRole = firstOrg.roles[0];
  if (firstRole === undefined) {
    throw createHttpError.NotFound('User has no roles');
  }

  const url = new URL('/sign-up/verify', frontendConfig.url);
  url.searchParams.set('verification_token', user.verification_token);
  url.searchParams.set('role', firstRole);
  if (isApproved) {
    url.searchParams.set('is_approved', 'true');
  }

  const email = decryptFieldData(user.email);
  const fullName = decryptFieldData(user.full_name);

  const { emailPayload, templateData, template } =
    getAccountVerificationEmailData({
      email,
      recipient: fullName,
      url: url.toString()
    });
  await mailService.sendMail(emailPayload, templateData, template);
}

async function inferNewUserOrganizations(args: {
  session?: ClientSession;
  organizationName: string;
  role: z.infer<typeof RegisterSchema>['role'];
  isBasicOrgOwnerInvite: boolean;
  isEnterpriseOrgOwnerInvite: boolean;
  approvedAt?: Date | null;
}) {
  const { session } = args;
  const { organizationName, role } = args;
  const { isBasicOrgOwnerInvite, isEnterpriseOrgOwnerInvite } = args;
  const { approvedAt } = args;

  const organizations: Partial<OrganizationMembership>[] = [];

  const isSigningUpAsOrgOwner = role === 'Organization';
  if (
    isSigningUpAsOrgOwner ||
    isBasicOrgOwnerInvite ||
    isEnterpriseOrgOwnerInvite // Should enterprise owners be part of a regular organization? Or their platform's public organization?
  ) {
    // Temporarily put subscription creation here. TO BE REFACTORED
    const basicOrgPlan =
      await subscriptionPlanService.getBasicOrganizationPlan();

    if (!basicOrgPlan)
      throw createHttpError.InternalServerError(
        'Basic organization plan not found.'
      );

    const createdSubscription =
      await subscriptionService.createSubscription({
        session,
        subscriptionPlan: basicOrgPlan.id,
        status: SubscriptionStatusEnum.ACTIVE
      });
    //

    const orgDoc = await organizationService.createOrganization({
      session,
      name: organizationName,
      subscription: createdSubscription.id
    });

    organizations.push({
      organization: orgDoc._id,
      roles: [roles.ADMIN], // Save organization owner as admin
      is_owner: true, // Mark user as organization owner
      status: invitationStatus.ACCEPTED,
      accepted_at: dayjsUTCDate() as any,

      approved_at: approvedAt
    });
  } else {
    const encryptedOrgName = encryptFieldData(organizationName);

    const orgDoc = await Organization.findOne({
      'name.hash': encryptedOrgName.hash
    });
    if (orgDoc === null) {
      throw createHttpError.BadRequest(
        'Organization info not available'
      );
    }

    organizations.push({
      organization: orgDoc._id,
      roles: [role],
      status: invitationStatus.ACCEPTED,
      accepted_at: dayjsUTCDate() as any,

      approved_at: approvedAt
    });
  }

  return organizations;
}

async function validateOrganizationCodeSignUp(
  data: z.infer<typeof RegisterSchema>
) {
  const hasOrgCode = data.organization_code !== null;
  if (!hasOrgCode) {
    return null;
  }

  const hasOrgName = data.organization_name !== null;
  if (hasOrgName) {
    throw createHttpError.BadRequest(
      'Cannot register with both organization name and code'
    );
  }
  const hasInvitationToken = data.invitation_token !== undefined;
  if (hasInvitationToken) {
    throw createHttpError.BadRequest(
      'Cannot register with both organization code and invitation token'
    );
  }

  const encryptedEmail = encryptFieldData(data.email);

  const userDoc = await User.findOne({
    'email.hash': encryptedEmail.hash
  });
  if (userDoc !== null) {
    throw createHttpError.Conflict(
      'Existing account, join organization'
    );
  }

  const orgDoc = await Organization.findOne({
    code: data.organization_code
  });
  if (orgDoc === null) {
    throw createHttpError.NotFound('Organization does not exist');
  }

  const orgName = decryptFieldData(orgDoc.name);

  return orgName;
}

async function registerUser(args: {
  session?: ClientSession;
  data: z.infer<typeof RegisterSchema>;
}) {
  const { session } = args;
  const { data } = args;

  // TEMPORARY Only allow invites
  const invitationToken = data.invitation_token;
  const isInvited = invitationToken !== undefined;
  if (!isInvited) {
    throw createHttpError.Forbidden('Invalid invitation link');
  }

  const orgNameFromCode = await validateOrganizationCodeSignUp(data);
  if (orgNameFromCode !== null) {
    data.organization_name = orgNameFromCode;
  }

  /** If not provided, default organization to public */
  data.organization_name ??=
    organizationConfig.PUBLIC_ORGANIZATION_NAME;
  const isPublicUser =
    data.organization_name ===
    organizationConfig.PUBLIC_ORGANIZATION_NAME;

  /** Prevent uninvited admin registrations */
  if (data.role === roles.ADMIN && !isInvited) {
    throw createHttpError.Forbidden(
      'Cannot sign up as uninvited admin'
    );
  }

  const encryptedEmail = encryptFieldData(data.email);
  const encryptedFullName = encryptFieldData(data.full_name);

  /** Check if email is already taken */
  const isEmailTaken = await User.findOne({
    'email.hash': encryptedEmail.hash,
    is_guest: false,
    archived_at: null
  });
  if (isEmailTaken)
    throw createHttpError.UnprocessableEntity(messages.EMAIL_TAKEN);

  /** If invited, validate token */
  let isBasicOrgOwnerInvite = false;
  let isEnterpriseOrgOwnerInvite = false;
  if (isInvited) {
    const { data: rawPayload, error: rawPayloadError } =
      encryptionService.verifyTokenSafely(invitationToken);
    if (rawPayloadError === 'token expired')
      throw createHttpError.UnprocessableEntity(
        'The invitation link has expired.'
      );
    if (rawPayloadError === 'token invalid')
      throw createHttpError.BadRequest(
        'The invitation link is invalid.'
      );
    if (!rawPayload) throw createHttpError.BadRequest();

    const { data: payload } =
      InvitationTokenSchema.safeParse(rawPayload);
    if (!payload) throw createHttpError.BadRequest();

    isBasicOrgOwnerInvite = payload.type === 'basic-organization-owner';
    isEnterpriseOrgOwnerInvite =
      payload.type === 'enterprise-organization-owner';

    /** Validate organization */
    const orgId = payload.organization_id;
    const orgDoc = await Organization.findById(orgId);
    if (orgDoc === null) {
      throw createHttpError.NotFound(
        'Inviting organization does not exist'
      );
    }

    const orgName = decryptFieldData(orgDoc.name);

    /**
     * Skip this check for basic organization owner invites
     * as they have the ability to change organization names on sign-up form
     */
    const isOrgPayloadValid = orgName === data.organization_name;
    if (
      !isBasicOrgOwnerInvite &&
      !isEnterpriseOrgOwnerInvite &&
      !isOrgPayloadValid
    )
      throw createHttpError.BadRequest();

    const isPayloadValid =
      payload.email === data.email && payload.role === data.role;
    if (!isPayloadValid) throw createHttpError.BadRequest();
  }

  const subscription = await subscriptionService.createUserSubscription(
    {
      session,
      role: data.role,
      isPublic: isPublicUser
    }
  );

  const currentDate = dayjsUTCDate();
  const emailVerifiedAt = isInvited ? currentDate : null;

  const isAutoApprove =
    isInvited || isBasicOrgOwnerInvite || isEnterpriseOrgOwnerInvite;
  const approvedAt = isAutoApprove ? (dayjsUTCDate() as any) : null;

  const organizations: Partial<OrganizationMembership>[] =
    await inferNewUserOrganizations({
      session,
      organizationName: data.organization_name,
      role: data.role,
      isBasicOrgOwnerInvite,
      isEnterpriseOrgOwnerInvite,
      approvedAt
    });
  if (organizations.length === 0) {
    throw createHttpError.BadRequest(
      'Unable to infer new user organizations'
    );
  }

  const password = await encryptionService.generateHash(data.password);
  const verificationToken = await encryptionService.generateHash(
    data.email
  );

  const user = await User.findOneAndUpdate(
    {
      'email.hash': encryptedEmail.hash,
      is_guest: true
    },
    {
      email: encryptedEmail,
      full_name: encryptedFullName,
      verification_token: verificationToken,
      is_guest: false,
      password,
      organizations,
      subscription,
      email_verified_at: emailVerifiedAt
    },
    { session, upsert: true, new: true }
  );

  if (isInvited) {
    await session?.commitTransaction(); // Commit changes so that login service can use them

    const loginResult = await loginUser(data.email, data.password);

    return loginResult;
  } else {
    await sendAccountVerificationEmailToUser(user, !!approvedAt);
  }
}

async function resendEmailVerification(email: string) {
  const user = await getActiveUserByEmail(email);

  if (!user) throw createHttpError.NotFound(messages.EMAIL_NOT_FOUND);

  /**
   * A verification token for the user should already exist by the time resending is possible
   * Resending renews(?) that verification token
   */
  user.verification_token = await encryptionService.generateHash(email);
  await user.save();

  /** At this point, they should only have 1 membership... */
  const firstMembership = user.organizations?.[0];
  if (firstMembership === undefined) {
    throw createHttpError.NotFound('User has no organizations');
  }

  const approveDate = firstMembership.approved_at ?? null;
  const isApproved = approveDate !== null;

  await sendAccountVerificationEmailToUser(user, isApproved);
}

async function updateUserDetails(
  userId: string,
  data: Partial<{
    full_name: string;
  }>
) {
  const encryptedFullName =
    data.full_name === undefined
      ? undefined
      : encryptFieldData(data.full_name);
  const encryptedData: Partial<UserType> = {
    ...data,
    full_name: encryptedFullName
  };

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    encryptedData,
    {
      new: true,
      select: '-password -verification_token'
    }
  );
  if (!updatedUser) throw createHttpError.NotFound();

  return updatedUser;
}

async function verifyUserEmail(verification_token: string) {
  const user = await User.findOne({ verification_token });
  if (!user)
    throw createHttpError.BadRequest(
      'Your verification link is invalid or expired. Please request a new one.'
    );
  if (user.email_verified_at)
    throw createHttpError.BadRequest('Account is already verified.');

  const firstMembership = user.organizations?.[0];
  if (firstMembership === undefined) {
    throw createHttpError.NotFound('User has no organizations');
  }

  const firstRole = firstMembership.roles[0];
  if (firstRole === undefined) {
    throw createHttpError.NotFound('User has no roles');
  }

  const currentDate = dayjsUTCDate();
  user.email_verified_at = currentDate as any;

  if (firstRole === roles.LEARNER) {
    firstMembership.approved_at = currentDate as any;
  }

  await user.save();
}

async function forgotPassword(email: string) {
  const user = await getActiveUserByEmail(email);
  if (!user) throw createHttpError.NotFound(messages.EMAIL_NOT_FOUND);

  const tokenPayload: z.infer<typeof PasswordResetTokenSchema> = {
    email
  };
  const token = encryptionService.generateToken({
    payload: tokenPayload
  });

  // const url = `${hostUrl}/password-reset/${encodeURIComponent(token)}?email=${encodeURIComponent(email)}`;
  const url = new URL(
    `/password-reset/${encodeURIComponent(token)}`,
    frontendConfig.url
  );
  url.searchParams.set('email', email);

  const fullName = decryptFieldData(user.full_name);
  const { emailPayload, templateData, template } =
    getForgotPasswordEmailData({
      email,
      recipient: fullName,
      url: url.toString()
    });
  await mailService.sendMail(emailPayload, templateData, template);
}

async function resetPassword(token: string, password: string) {
  const { data: rawPayload } =
    encryptionService.verifyTokenSafely(token);
  if (!rawPayload)
    throw createHttpError.BadRequest('Invalid reset token.');

  const { data: payload } =
    PasswordResetTokenSchema.safeParse(rawPayload);
  if (!payload)
    throw createHttpError.BadRequest('Unexpected reset token payload.');

  const user = await getActiveUserByEmail(payload.email);
  if (!user) throw createHttpError.NotFound(messages.EMAIL_NOT_FOUND);

  try {
    await updatePassword(user, password);
  } catch {
    throw createHttpError.InternalServerError(
      'There is a problem resetting your password.'
    );
  }
}

async function updatePassword(
  user: UserType,
  newPassword: string,
  currentPassword?: string
) {
  if (currentPassword !== undefined) {
    const isCurrentPasswordCorrect = await encryptionService.verifyHash(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordCorrect) {
      throw createHttpError.BadRequest('Incorrect password');
    }
  }

  user.password = await encryptionService.generateHash(newPassword);
  await user.save();
}

export default {
  ...{ loginUser, refreshAccessToken },
  ...{ registerUser, resendEmailVerification },
  ...{ updateUserDetails, verifyUserEmail },
  ...{ forgotPassword, resetPassword, updatePassword }
};
