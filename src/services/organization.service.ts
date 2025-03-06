import createHttpError from 'http-errors';
import { kebabCase } from 'lodash';
import { ClientSession, PipelineStage } from 'mongoose';
import organizationConfig from '../config/organization.config';
import invitationStatus from '../constants/invitation-status';
import {
  InvitationLogType,
  OrganizationLogType
} from '../constants/logs';
import { customLabels } from '../constants/pagination-custom-labels';
import { OrganizationPermissions } from '../constants/permissions';
import roles from '../constants/roles';
import { decryptFieldData, encryptFieldData } from '../helpers/db';
import { uploadFile } from '../helpers/uploads';
import enterpriseManagement from '../helpers/user-management/enterprises';
import organizationManagement from '../helpers/user-management/organizations';
import { RequestAuth } from '../middlewares/require-permissions';
import Enterprise, { EnterpriseType } from '../models/enterprise.model';
import Organization, {
  OrganizationStatus,
  OrganizationStatusType,
  OrganizationType
} from '../models/organization.model';
import { SubscriptionStatusEnum } from '../models/subscription.model';
import User, {
  OrganizationMembership,
  UserType
} from '../models/user.model';
import dayjsUTCDate from '../utils/dayjs-utc-date';
import { withFromAndTo } from '../utils/with-from-to';
import { SanitizedOrganizationSchema } from '../validations/auth.validation';
import subscriptionPlanService from './admin/subscription-plan.service';
import subscriptionService from './admin/subscription.service';
import logService from './log.service';

function sanitizeOrganization(
  organization: OrganizationType,
  decryptOptions?: {
    toObject?: boolean;
  }
) {
  const decrypted = decryptOrganization(organization, decryptOptions);

  const sanitized = SanitizedOrganizationSchema.parse(decrypted);

  return sanitized;
}

function decryptOrganization(
  organization: OrganizationType,
  options: {
    toObject?: boolean;
  } = {}
) {
  const { toObject = true } = options;

  const decryptedName = decryptFieldData(organization.name);
  const decryptedSlug = decryptFieldData(organization.slug);

  const encryptedLogo = organization.logo ?? undefined;
  const decryptedLogo =
    encryptedLogo === undefined
      ? undefined
      : decryptFieldData(encryptedLogo);

  const baseOrg = toObject
    ? organization.toObject({ getters: true })
    : organization;
  const decrypted = {
    ...baseOrg,
    name: decryptedName,
    slug: decryptedSlug,
    logo: decryptedLogo
  };

  return decrypted;
}

function decryptEnterprise(
  enterprise: EnterpriseType,
  options: {
    toObject?: boolean;
  } = {}
) {
  const { toObject = true } = options;

  const decryptedName = decryptFieldData(enterprise.organization_name);
  const decryptedEmail = decryptFieldData(enterprise.email);
  const decryptedPlatformUrl = decryptFieldData(
    enterprise.platform_url
  );

  const baseEnterprise = toObject
    ? enterprise.toObject({ getters: true })
    : enterprise;

  const decrypted = {
    ...baseEnterprise,
    organization_name: decryptedName,
    email: decryptedEmail,
    platform_url: decryptedPlatformUrl
  };

  return decrypted;
}

async function randomOrganizationCode(args?: {
  length?: number;
  codeRetries?: number;
}) {
  const {
    length = organizationConfig.ORGANIZATION_CODE_LENGTH,
    codeRetries = 3
  } = args ?? {};

  /**
   * It is possible to generate a code that is already existing,
   * so that is explicitly checked here
   */
  let code: string | undefined;
  for (let _ = 0; _ < codeRetries; _++) {
    code = crypto
      .randomUUID() // Random string
      .replace(/-/g, '') // Keep only alphanumeric characters
      .slice(0, length)
      .toUpperCase();

    const existingDocWithCode = await Organization.findOne({ code });
    if (existingDocWithCode === null) break;
  }

  if (code === undefined) {
    throw createHttpError.GatewayTimeout(
      'Organization code time out; please try again later.'
    );
  }
  code satisfies string;

  return code;
}

async function createOrganization(args: {
  session?: ClientSession;
  name: string;
  subscription: string;
}) {
  const { session } = args;
  const { name } = args;
  const { subscription } = args;
  const slug = kebabCase(name);

  const encryptedOrgName = encryptFieldData(name);
  const encryptedOrgSlug = encryptFieldData(slug);

  const existingOrg = await Organization.findOne({
    $or: [
      { 'name.hash': encryptedOrgName.hash },
      { 'slug.hash': encryptedOrgSlug.hash }
    ] // Matches either name or slug
  });
  if (existingOrg !== null) {
    throw createHttpError.Conflict('Organization name already exists');
  }

  const code = await randomOrganizationCode();

  const orgDoc = new Organization({
    name: encryptedOrgName,
    slug: encryptedOrgSlug,
    code,
    subscription,
    permissions: OrganizationPermissions as any
  });
  await orgDoc.save({ session });

  return orgDoc;
}

async function updateOrganizationStatus(args: {
  orgId: string;
  status: OrganizationStatusType;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { orgId, status } = args;
  const { user, reqAuth } = args;

  const organization = await Organization.findById(orgId);

  if (!organization) {
    throw createHttpError.NotFound('Organization not found');
  }

  const updateData: {
    status: OrganizationStatusType;
    suspended_at?: Date | null;
  } = {
    status
  };

  // Update suspended_at based on status
  if (status === OrganizationStatus.Suspended) {
    updateData.suspended_at = new Date();
  } else if (organization.suspended_at) {
    // Clear suspended_at if status is changing from Suspended to something else
    updateData.suspended_at = null;
  }

  const updatedOrg = await Organization.findByIdAndUpdate(
    orgId,
    updateData,
    { new: true }
  );

  if (!updatedOrg) {
    throw createHttpError.NotFound('Organization not found');
  }

  /** Log Action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const targetOrgName = decryptFieldData(organization.name);

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      orgId,
      status
    }),
    type: OrganizationLogType.UPDATE_ORGANIZATION,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) changed ${targetOrgName} status to ${status}`
    )
  });

  return updatedOrg;
}

async function updateEnterprise(args: {
  session?: ClientSession;
  id: string;
  status: OrganizationStatusType;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { id, status } = args;
  const { user, reqAuth } = args;

  /** Find enterprise document */
  const enterprise = await Enterprise.findById(id);
  if (enterprise === null) {
    throw createHttpError.NotFound('Enterprise not found');
  }

  /** Assign new status */
  enterprise.status = status;

  /** Update suspension date */
  enterprise.suspended_at = null as any;
  if (status === OrganizationStatus.Suspended) {
    enterprise.suspended_at = new Date();
  }

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const targetEnterpriseName = decryptFieldData(
    enterprise.organization_name
  );

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      id,
      status
    }),
    type: OrganizationLogType.UPDATE_ENTERPRISE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) changed ${targetEnterpriseName} status to ${status}`
    )
  });

  await enterprise.save({ session });
}

async function bulkUpdateOrganizationStatus(args: {
  organizationIds: string[];
  status: OrganizationStatusType;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { organizationIds, status } = args;
  const { user, reqAuth } = args;

  // Verify all organizations exist
  const organizations = await Organization.find({
    _id: { $in: organizationIds }
  });
  if (organizations.length !== organizationIds.length) {
    throw createHttpError.NotFound(
      'One or more organizations not found'
    );
  }

  const encryptedPublicOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  // Prevent update to public organization
  const publicOrgs = organizations.filter(
    (org) => org.name.hash === encryptedPublicOrgName.hash
  );
  if (publicOrgs.length > 0) {
    throw createHttpError.BadRequest(
      'Cannot update public organization'
    );
  }

  const updateData: {
    status: OrganizationStatusType;
    suspended_at?: Date | null;
  } = {
    status
  };

  // Set suspended_at based on status
  if (status === OrganizationStatus.Suspended) {
    updateData.suspended_at = new Date();
  } else {
    updateData.suspended_at = null;
  }

  // Perform bulk update
  const result = await Organization.updateMany(
    { _id: { $in: organizationIds } },
    updateData
  );

  // Get updated organizations for response
  const updatedOrganizations = await Organization.find({
    _id: { $in: organizationIds }
  });

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      organizationIds,
      status
    }),
    type: OrganizationLogType.UPDATE_ORGANIZATION,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) changed multiple organizations status to ${status}`
    )
  });

  return {
    modifiedCount: result.modifiedCount,
    organizations: updatedOrganizations
  };
}

async function bulkUpdateEnterprises(args: {
  session?: ClientSession;
  enterpriseIds: string[];
  status: OrganizationStatusType;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { enterpriseIds, status } = args;
  const { user, reqAuth } = args;

  /** Optionally update suspension date */
  const today = new Date();
  const suspensionDate =
    status === OrganizationStatus.Suspended ? today : null;

  /** Perform bulk update */
  const result = await Enterprise.updateMany(
    { _id: { $in: enterpriseIds } },
    {
      status,
      suspended_at: suspensionDate
    },
    { session }
  );

  /**
   * Fail if not all specified enterprises were updated
   * (possibly non-existent)
   */
  const areAllUpdated = result.modifiedCount === enterpriseIds.length;
  if (!areAllUpdated) {
    throw createHttpError.NotFound('One or more enterprises not found');
  }

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      enterpriseIds,
      status
    }),
    type: OrganizationLogType.UPDATE_ENTERPRISE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) changed multiple enterprises status to ${status}`
    )
  });
}

async function getPublicOrganization() {
  const encryptedOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  const publicOrg = await Organization.findOne({
    'name.hash': encryptedOrgName.hash
  });
  if (!publicOrg)
    throw createHttpError.NotFound(
      'Public organization does not exist'
    );

  const { name, slug } = publicOrg.toObject();
  return {
    ...publicOrg.toObject(),
    name: decryptFieldData(name),
    slug: decryptFieldData(slug)
  };
}

async function getOrganization(args: {
  user: UserType;
  orgSlug: string;
}) {
  const { user, orgSlug } = args;

  const encryptedOrgSlug = encryptFieldData(orgSlug);

  const org = await Organization.findOne({
    'slug.hash': encryptedOrgSlug.hash
  }).populate({
    path: 'subscription',
    populate: { path: 'subscription_plan' }
  });

  if (org === null) {
    throw createHttpError.NotFound('Organization not found');
  }
  const subscription = org.subscription;
  const membership = user.organizations?.find(
    (membership) =>
      membership.organization.slug.hash === encryptedOrgSlug.hash
  );
  const isOwner = membership?.is_owner ?? false;

  let code: string | undefined;
  let memberCt: number | undefined;
  let learnerCt: number | undefined;

  if (isOwner) {
    code = org.code;

    memberCt = await User.countDocuments({
      'organizations.organization': org._id
    });

    learnerCt = await User.countDocuments({
      'organizations.organization': org._id,
      'organizations.roles': { $in: [roles.LEARNER] }
    });
  }

  const orgDisplay = {
    ...sanitizeOrganization(org),
    ...{
      code,
      member_count: memberCt,
      learner_count: learnerCt,
      subscription
    }
  };

  return orgDisplay;
}

async function updateOrganization(args: {
  session?: ClientSession;
  user: UserType;
  orgSlug: string;
  update: {
    name?: string;
    logo?: string;
  };
}) {
  async function validateName(org: OrganizationType) {
    if (update.name === undefined) {
      return { isSuccess: true } as const;
    }

    const name = update.name;
    const slug = kebabCase(name);

    const encryptedName = encryptFieldData(name);
    const encryptedSlug = encryptFieldData(slug);

    if (org.name.hash === encryptedName.hash) {
      return { isSuccess: true } as const;
    }

    const existingOrg = await Organization.findOne({
      $or: [
        { 'name.hash': encryptedName.hash },
        { 'slug.hash': encryptedSlug.hash }
      ] // Matches either name or slug
    });
    if (existingOrg !== null) {
      const error = createHttpError.Conflict(
        'Organization name already taken'
      );

      return { isSuccess: false, error } as const;
    }

    return {
      isSuccess: true,
      data: { encryptedName, encryptedSlug }
    } as const;
  }

  const { session } = args;
  const { orgSlug, user } = args;
  const { update } = args;

  const encryptedOrgSlug = encryptFieldData(orgSlug);

  /** Only allow owners */
  const membership = user.organizations?.find(
    (membership) =>
      membership.organization.slug.hash === encryptedOrgSlug.hash
  );

  const isOwner = membership?.is_owner ?? false;
  if (!isOwner) {
    throw createHttpError.Forbidden('Cannot update organization');
  }

  /** Find organization */
  const org = await Organization.findOne({
    'slug.hash': encryptedOrgSlug.hash
  });
  if (org === null) {
    throw createHttpError.NotFound('Organization not found');
  }

  /** Assign new name, if any */
  const nameValidation = await validateName(org);
  if (!nameValidation.isSuccess) {
    throw nameValidation.error;
  }
  if (nameValidation.data !== undefined) {
    org.name = nameValidation.data.encryptedName;
    org.slug = nameValidation.data.encryptedSlug;
  }

  /** Assign new logo, if any */
  if (update.logo !== undefined) {
    org.logo = encryptFieldData(update.logo);
  }

  await org.save({ session });

  /** Respond with updated info */
  const sanitized = sanitizeOrganization(org);

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(org.name);

  await logService.createLog({
    organization: org._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      orgSlug,
      update: JSON.stringify(update)
    }),
    type: OrganizationLogType.UPDATE_ORGANIZATION,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} Owner) updated organization details`
    )
  });

  return sanitized;
}

async function updateInvitation(args: {
  session?: ClientSession;
  user: UserType;
  action: 'accept' | 'decline';
  orgSlug: string;
  membershipId: string;
}) {
  const { session, user } = args;
  const { action } = args;
  const { orgSlug, membershipId } = args;

  const encryptedOrgSlug = encryptFieldData(orgSlug);

  const membership = user.organizations?.find((membership) =>
    membership._id.equals(membershipId)
  );
  if (membership === undefined) {
    throw createHttpError.NotFound('Invitation not found');
  }
  if (membership.organization.slug.hash !== encryptedOrgSlug.hash) {
    throw createHttpError.Unauthorized('Invalid invitation');
  }
  if (membership.status !== invitationStatus.PENDING) {
    throw createHttpError.Conflict('Invitation already acted upon');
  }

  const userName = decryptFieldData(user.full_name);
  const orgName = decryptFieldData(membership.organization.name);
  const firstOrgRole = membership.roles[0];

  const isInvitedToPublic =
    orgName === organizationConfig.PUBLIC_ORGANIZATION_NAME;

  if (action === 'accept') {
    /** Add subscription */
    const subscription =
      await subscriptionService.createUserSubscription({
        session,
        role: firstOrgRole,
        isPublic: isInvitedToPublic
      });
    user.subscription = subscription;

    /** Update membership status */
    membership.status = invitationStatus.ACCEPTED;
    membership.accepted_at = dayjsUTCDate() as any;

    await user.save({ session });

    /** Log action */
    await logService.createLog({
      organization: membership.organization._id,
      payload_snapshot: logService.encryptPayloadSnapshot({
        userName,
        orgName
      }),
      type: InvitationLogType.ACCEPT_INVITATION,
      activity: encryptFieldData(
        `${userName} (${firstOrgRole}) accepted invite to ${orgName}`
      )
    });

    return;
  }

  if (action === 'decline') {
    /** Update membership status */
    membership.status = invitationStatus.DECLINED;
    membership.declined_at = dayjsUTCDate() as any;
    await user.save({ session });

    /** Log action */
    await logService.createLog({
      organization: membership.organization._id,
      payload_snapshot: logService.encryptPayloadSnapshot({
        userName,
        orgName
      }),
      type: InvitationLogType.DECLINE_INVITATION,
      activity: encryptFieldData(
        `${userName} (${firstOrgRole}) declined invite to ${orgName}`
      )
    });

    return;
  }

  action satisfies never;
  throw createHttpError.BadRequest('Invalid action');
}

async function updateOwnerInvitation(args: {
  session?: ClientSession;
  user: UserType;
  action: 'accept' | 'decline';
  pendingOrgId: string;
  organizationName: string;
}) {
  const { session, user } = args;
  const { action } = args;
  const { pendingOrgId, organizationName } = args;

  /** Validate pending entry */
  const pendingEntry = user.pending_organizations?.find((org) =>
    org._id.equals(pendingOrgId)
  );
  if (pendingEntry === undefined) {
    throw createHttpError.NotFound('Pending organization not found');
  }
  if (pendingEntry.status !== invitationStatus.PENDING) {
    throw createHttpError.BadRequest('Invitation already acted upon');
  }

  const publicOrgDoc = await getPublicOrganization();
  const userName = decryptFieldData(user.full_name);
  const initialOrgName = decryptFieldData(pendingEntry.name);
  const finalOrgName = organizationName;

  if (action === 'accept') {
    // Temporarily put subscription creation here. TO BE REFACTORED
    const basicOrgPlan =
      await subscriptionPlanService.getBasicOrganizationPlan();

    if (!basicOrgPlan)
      throw createHttpError.InternalServerError(
        'Basic organization plan not found.'
      );

    const createdSubscription =
      await subscriptionService.createSubscription({
        subscriptionPlan: basicOrgPlan.id,
        status: SubscriptionStatusEnum.ACTIVE
      });
    //

    /** Try creating the organization */
    const orgDoc = await createOrganization({
      session,
      name: organizationName,
      subscription: createdSubscription.id
    });

    /** Add organization membership */
    const newMembership: Partial<OrganizationMembership> = {
      organization: orgDoc._id,
      roles: [roles.ADMIN],
      is_owner: true,
      status: invitationStatus.ACCEPTED,
      accepted_at: dayjsUTCDate() as any,

      approved_at: dayjsUTCDate() as any
    };
    user.organizations?.push(newMembership as any);

    /** Change pending entry status */
    pendingEntry.status = invitationStatus.ACCEPTED;
    pendingEntry.accepted_at = dayjsUTCDate() as any;
    await user.save({ session });

    /** Log action */
    await logService.createLog({
      organization: publicOrgDoc._id,
      payload_snapshot: logService.encryptPayloadSnapshot({
        userName,
        initialOrgName,
        finalOrgName
      }),
      type: InvitationLogType.ACCEPT_OWNER_INVITATION,
      activity: encryptFieldData(
        `${userName} accepted invite as owner of ${finalOrgName} (initially "${initialOrgName}")`
      )
    });

    /** Return sanitized organization */
    const sanitized = sanitizeOrganization(orgDoc);

    return sanitized;
  }

  if (action === 'decline') {
    /** Change pending entry status */
    pendingEntry.status = invitationStatus.DECLINED;
    pendingEntry.declined_at = dayjsUTCDate() as any;
    await user.save({ session });

    /** Log action */
    await logService.createLog({
      organization: publicOrgDoc._id,
      payload_snapshot: logService.encryptPayloadSnapshot({
        userName,
        initialOrgName
      }),
      type: InvitationLogType.DECLINE_OWNER_INVITATION,
      activity: encryptFieldData(
        `${userName} declined invite as owner of ${initialOrgName}`
      )
    });

    return null;
  }

  action satisfies never;
  throw createHttpError.BadRequest('Invalid action');
}

async function getOrganizations({
  tier,
  page = 1,
  limit = 20,
  search,
  status,
  sortBy = 'created_at'
}: {
  tier?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  sortBy?: string;
} = {}) {
  function* generateStatusSelection() {
    const specifiedStatuses = status ?? [];

    for (const item of specifiedStatuses) {
      if (item === 'ACTIVE') {
        yield OrganizationStatus.Active;
      }

      if (item === 'INACTIVE') {
        yield OrganizationStatus.Inactive;
      }

      if (item === 'SUSPENDED') {
        yield OrganizationStatus.Suspended;
      }
    }
  }

  function* generateQueryStages(): Generator<PipelineStage.Match> {
    /** Exclude public organization */
    yield {
      $match: {
        'name.hash': { $ne: encryptedPublicOrgName.hash }
      }
    };

    /** Include search matches only, if specified */
    if (search && tier !== 'enterprise') {
      const searchStage = organizationManagement.getSearchMatchStage({
        helper,
        search
      });

      yield searchStage;
    }

    /** Include selected statuses only, if specified */
    const selectedStatus = [...generateStatusSelection()];
    if (selectedStatus.length > 0) {
      yield {
        $match: {
          status: { $in: selectedStatus }
        }
      };
    }
  }

  function* generatePipeline(): Generator<PipelineStage> {
    /** Add query stages */
    for (const stage of generateQueryStages()) {
      yield stage;
    }

    /** Get organization members */
    yield {
      $lookup: {
        from: 'users',
        let: { orgId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$$orgId', '$organizations.organization'] },
                  { $eq: ['$deleted_at', null] }
                ]
              }
            }
          }
        ],
        as: 'members'
      }
    };

    /** Get organization owner */
    yield {
      $lookup: {
        from: 'users',
        let: { orgId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$$orgId', '$organizations.organization'] },
                  { $eq: ['$deleted_at', null] }
                ]
              }
            }
          },
          {
            $unwind: '$organizations'
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$organizations.organization', '$$orgId'] },
                  { $eq: ['$organizations.is_owner', true] }
                ]
              }
            }
          }
        ],
        as: 'owner'
      }
    };

    /**
     * Added a $lookup stage to match organizations with enterprises based on hash values
     * Updated the $match stage to show only organizations with matching enterprise data (size greater than 0)
     */
    yield {
      $lookup: {
        from: 'enterprises', // Assuming the collection name is enterprises
        localField: 'name.hash',
        foreignField: 'organization_name.hash',
        as: 'basicTierMatches'
      }
    };
    yield {
      /**
       * If tier is 'basic', filter out organizations with basic tier matches
       * If tier is 'enterprise', show only organizations with enterprise tier matches
       */
      $match: {
        basicTierMatches:
          tier === 'enterprise' ? { $gt: [] } : { $size: 0 }
      }
    };

    /** Add initial sort stage if sorting by fields available before projection */
    const initialSortStages =
      tier !== 'enterprise' &&
      organizationManagement.getSortStages({
        helper,
        sortBy
      });
    if (initialSortStages) {
      for (const stage of initialSortStages) {
        yield stage;
      }
    }

    /** Add projection stage */
    yield {
      $project: {
        name: 1,
        owner: { $arrayElemAt: ['$owner.full_name', 0] },
        members: { $size: '$members' },
        created_at: 1,
        status: 1,
        suspended_at: 1,
        slug: 1
      }
    };

    /** Add post-projection sort stage if sorting by computed fields */
    if (sortBy === 'owner' || sortBy === 'members') {
      yield {
        $sort: {
          [sortBy]: 1
        }
      };
    }
  }

  const helper =
    await organizationManagement.getOrganizationManagementHelper({
      search,
      sortBy
    });

  const encryptedPublicOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  const pipeline = [...generatePipeline()];
  const aggregate = Organization.aggregate(pipeline);

  const options = {
    page,
    limit,
    customLabels
  };
  let paginatedResults = await Organization.aggregatePaginate(
    aggregate,
    options
  );

  // Decrypt the results
  if (Array.isArray(paginatedResults.data)) {
    paginatedResults.data = paginatedResults.data.map((org: any) => {
      const decryptedOrg = {
        ...org,
        name: decryptFieldData(org.name),
        slug: decryptFieldData(org.slug)
      };

      // Decrypt owner name if exists
      if (org.owner) {
        decryptedOrg.owner = decryptFieldData(org.owner);
      }

      return decryptedOrg;
    });
  }

  paginatedResults = withFromAndTo(paginatedResults);

  return paginatedResults;
}

/** Restrict to Super Admins only? */
async function getEnterprises(args: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  sortBy?: string;
}) {
  const { page = 1, limit = 20 } = args;
  const { search, status, sortBy = 'created_at' } = args;

  function* generateStatusSelection() {
    const specifiedStatuses = status ?? [];

    for (const item of specifiedStatuses) {
      if (item === 'ACTIVE') {
        yield OrganizationStatus.Active;
      }

      if (item === 'INACTIVE') {
        yield OrganizationStatus.Inactive;
      }

      if (item === 'SUSPENDED') {
        yield OrganizationStatus.Suspended;
      }
    }
  }

  function* generateQueryStages(): Generator<PipelineStage.Match> {
    /** Include search matches only, if specified */
    if (search) {
      const searchStage = enterpriseManagement.getSearchMatchStage({
        helper,
        search
      });

      yield searchStage;
    }

    /** Include selected statuses only, if specified */
    const selectedStatus = [...generateStatusSelection()];
    if (selectedStatus.length > 0) {
      yield {
        $match: {
          status: { $in: selectedStatus }
        }
      };
    }
  }

  function* generatePipeline(): Generator<PipelineStage> {
    /** Add query stages */
    for (const stage of generateQueryStages()) {
      yield stage;
    }

    /** Add initial sort stage if sorting by fields available before projection */
    const initialSortStages =
      sortBy &&
      enterpriseManagement.getSortStages({
        helper,
        sortBy
      });
    if (initialSortStages) {
      for (const stage of initialSortStages) {
        yield stage;
      }
    }
  }

  const helper =
    await enterpriseManagement.getEnterpriseManagementHelper({
      search,
      sortBy
    });

  const pipeline = [...generatePipeline()];
  const aggregate = Enterprise.aggregate(pipeline);

  const options = {
    page,
    limit,
    customLabels
  };
  let paginatedResults = await Enterprise.aggregatePaginate(
    aggregate,
    options
  );

  /** Sanitize the results */
  if (Array.isArray(paginatedResults.data)) {
    paginatedResults.data = paginatedResults.data.map(
      (enterprise: any) => {
        const decrypted = decryptEnterprise(enterprise, {
          toObject: false
        });

        return decrypted;
      }
    );
  }

  paginatedResults = withFromAndTo(paginatedResults);

  return paginatedResults;
}

async function getOrganizationBySlug(
  orgSlug: string,
  options?: { includeSubscription?: boolean }
) {
  const encryptedOrgSlug = encryptFieldData(orgSlug);

  let query = Organization.findOne({
    'slug.hash': encryptedOrgSlug.hash
  });

  if (options?.includeSubscription) {
    query = query.populate({
      path: 'subscription',
      populate: { path: 'subscription_plan' }
    }) as any;
  }

  const org = await query.lean();

  if (!org) {
    throw createHttpError.NotFound('Organization not found.');
  }

  const decryptedOrg = {
    ...org,
    name: decryptFieldData(org.name),
    slug: decryptFieldData(org.slug)
  };

  return decryptedOrg;
}

async function uploadOrganizationLogo(file: Express.Multer.File) {
  const url = await uploadFile({
    file,
    keyPrefix: 'organizations/logos'
  });

  return url;
}

export default {
  sanitizeOrganization,
  decryptOrganization,
  randomOrganizationCode,
  createOrganization,
  updateOrganizationStatus,
  updateEnterprise,
  bulkUpdateOrganizationStatus,
  bulkUpdateEnterprises,
  getPublicOrganization,
  getOrganization,
  updateOrganization,
  updateInvitation,
  updateOwnerInvitation,
  getOrganizations,
  getEnterprises,
  getOrganizationBySlug,
  uploadOrganizationLogo
};
