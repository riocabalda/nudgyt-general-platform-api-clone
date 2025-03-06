import createHttpError from 'http-errors';
import { ClientSession, FilterQuery, PipelineStage } from 'mongoose';
import frontendConfig from '../config/frontend.config';
import organizationConfig from '../config/organization.config';
import invitationStatus from '../constants/invitation-status';
import { UserLogType } from '../constants/logs';
import { customLabels } from '../constants/pagination-custom-labels';
import roles from '../constants/roles';
import { decryptFieldData, encryptFieldData } from '../helpers/db';
import { getApprovalEmailData } from '../helpers/emails';
import {
  inviteOwnerBasic,
  inviteOwnerEnterprise,
  inviteUser
} from '../helpers/invitations';
import userManagement from '../helpers/user-management/users';
import { RequestAuth } from '../middlewares/require-permissions';
import Organization from '../models/organization.model';
import User, {
  OrganizationMembership,
  PendingOrganization,
  UserType
} from '../models/user.model';
import dayjsUTCDate from '../utils/dayjs-utc-date';
import { generateLogDetails } from '../utils/generate-log-details';
import { getOrgIdByOrgSlug } from '../utils/get-org-id-by-org-slug';
import { getUserRole } from '../utils/get-roles-by-org';
import { withFromAndTo } from '../utils/with-from-to';
import {
  PaginatedUserSchema,
  SanitizedUserSchema
} from '../validations/auth.validation';
import logService from './log.service';
import mailService from './mail.service';
import organizationService from './organization.service';

function sanitizeUser(
  user: UserType,
  decryptOptions?: {
    toObject?: boolean;
  }
) {
  const decrypted = decryptUser(user, decryptOptions);

  const memberships = decrypted.organizations ?? [];
  decrypted.organizations = memberships.filter(
    (membership: OrganizationMembership) => {
      /** Remove declined memberships */
      const isDeclined =
        membership.status === invitationStatus.DECLINED;
      if (isDeclined) return false;

      /** Remove blocked memberships */
      const blockDate = membership.blocked_at ?? null;
      const isBlocked = blockDate !== null;
      if (isBlocked) return false;

      /** Remove unapproved memberships */
      const approveDate = membership.approved_at ?? null;
      const isApproved = approveDate !== null;
      if (!isApproved) return false;

      return true;
    }
  );

  /** Keep only actually pending organization entries */
  decrypted.pending_organizations =
    decrypted.pending_organizations?.filter(
      (org: PendingOrganization) =>
        org.status === invitationStatus.PENDING
    ) ?? [];

  const sanitized = SanitizedUserSchema.parse(decrypted);

  return sanitized;
}

function getStatusPriority(user: UserType): number {
  if (user.archived_at) return 5; // Archived
  if (user.email_verified_at) return 2; // Verified
  return 1; // Unverified
}

export function decryptUser(
  user: UserType,
  options: {
    toObject?: boolean;
  } = {}
) {
  const { toObject = true } = options;

  const decryptedFullName = decryptFieldData(user.full_name);
  const decryptedEmail = decryptFieldData(user.email);

  const decryptedMemberships = user.organizations?.map((membership) => {
    const baseMembership = toObject
      ? membership.toObject({ getters: true })
      : membership;

    return {
      ...baseMembership,
      organization: organizationService.decryptOrganization(
        membership.organization,
        { toObject }
      )
    };
  });

  const decryptedPendingOrganizations = user.pending_organizations?.map(
    (org) => {
      const baseOrg = toObject ? org.toObject({ getters: true }) : org;

      return {
        ...baseOrg,
        name: decryptFieldData(org.name)
      };
    }
  );

  const baseUser = toObject ? user.toObject({ getters: true }) : user;
  const decrypted = {
    ...baseUser,
    full_name: decryptedFullName,
    email: decryptedEmail,
    organizations: decryptedMemberships,
    pending_organizations: decryptedPendingOrganizations
  };

  return decrypted;
}

async function getUsers({
  organizationSlug,
  search,
  status,
  role,
  page = 1,
  limit = 20,
  sortBy = 'created_at'
}: {
  organizationSlug: string;
  search?: string;
  status?: string[];
  role?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
}) {
  function getMemberQuery(): FilterQuery<unknown> {
    const specifiedRoles = role ?? [];

    const getMemberQuery = specifiedRoles.length > 0;
    if (!getMemberQuery) {
      return {
        'organizations.organization': organizationId
      };
    }

    return {
      organizations: {
        $elemMatch: {
          organization: organizationId,
          roles: { $in: specifiedRoles }
        }
      }
    };
  }

  function* generateServiceCountStages(): Generator<PipelineStage> {
    /** Count services created by user */
    yield {
      $lookup: {
        from: 'services',
        localField: '_id',
        foreignField: 'creator',
        as: 'service_ct'
      }
    };
    yield {
      $set: {
        service_ct: { $size: '$service_ct' } // Keep only lookup result size
      }
    };

    /** Count simulations by user */
    yield {
      $lookup: {
        from: 'simulations',
        localField: '_id',
        foreignField: 'learner',
        as: 'simulation_ct'
      }
    };
    yield {
      $set: {
        simulation_ct: { $size: '$simulation_ct' } // Keep only lookup result size
      }
    };

    /**
     * Keep only one of either counts
     *
     * Ideally should explicitly check user role,
     * but since only admins/trainers can create services,
     * and only learners can take simulations,
     * this is a possible shortcut
     *
     * Rough equivalent:
     *
     * ```ts
     *   service_ct > 0 ? service_ct
     * : simulation_ct > 0 ? simulation_ct
     * : null
     * ```
     */
    yield {
      $addFields: {
        services: {
          $cond: {
            if: { $gt: ['$service_ct', 0] },
            then: '$service_ct',
            else: {
              $cond: {
                if: { $gt: ['$simulation_ct', 0] },
                then: '$simulation_ct',
                else: null
              }
            }
          }
        }
      }
    };
  }

  function* generateStatusOrQueries(): Generator<FilterQuery<unknown>> {
    const specifiedStatuses = status ?? [];

    for (const item of specifiedStatuses) {
      if (item === 'ARCHIVED') {
        yield {
          archived_at: { $exists: true, $ne: null }
        };
      }
      if (item === 'BLOCKED') {
        yield {
          'organizations.blocked_at': { $exists: true, $ne: null }
        };
      }
      if (item === 'APPROVED') {
        yield {
          'organizations.approved_at': { $exists: true, $ne: null }
        };
      }
      if (item === 'VERIFIED') {
        yield {
          email_verified_at: { $exists: true, $ne: null }
        };
      }
      if (item === 'UNVERIFIED') {
        yield {
          email_verified_at: null
        };
      }
    }
  }

  function* generateAndQueries(): Generator<FilterQuery<unknown>> {
    /** Only get organization members of specified role */
    yield getMemberQuery();

    /** Keep only non-deleted users */
    yield {
      deleted_at: null
    };

    /** Exclude Super Admin */
    yield {
      'organizations.roles': { $ne: roles.SUPER_ADMIN }
    };

    /** Include selected statuses only, if specified */
    const statusOrQueries = [...generateStatusOrQueries()];
    if (statusOrQueries.length > 0) {
      yield {
        $or: statusOrQueries
      };
    }
  }

  function* generatePipeline(): Generator<PipelineStage> {
    /** Add and queries */
    const andQueries = [...generateAndQueries()];
    if (andQueries.length > 0) {
      yield {
        $match: {
          $and: andQueries
        }
      };
    }

    /** Include search matches only, if specified */
    if (search) {
      const searchStage = userManagement.getSearchMatchStage({
        helper,
        search
      });

      yield searchStage;
    }

    /** Populate memberships */
    const populateStages =
      userManagement.getPopulateUserMembershipsAsAggregationStages();
    for (const stage of populateStages) {
      yield stage;
    }

    /** Add sort options */
    const sortStages = userManagement.getSortStages({
      helper,
      sortBy
    });
    for (const stage of sortStages) {
      yield stage;
    }

    /** Add service count stages */
    for (const stage of generateServiceCountStages()) {
      yield stage;
    }
  }

  /** Find organization */
  const encryptedOrgSlug = encryptFieldData(organizationSlug);
  const organization = await Organization.findOne({
    'slug.hash': encryptedOrgSlug.hash
  });
  if (organization === null) {
    throw createHttpError.NotFound('Organization not found');
  }
  const organizationId = organization._id;

  /** Get decryption helper */
  const helper = await userManagement.getUserManagementHelper({
    orgId: String(organizationId),
    roles: role,
    search,
    sortBy
  });

  /** Build aggregation */
  const pipeline = [...generatePipeline()];
  const aggregate = User.aggregate(pipeline);

  const options = {
    page,
    limit,
    customLabels
  };
  let paginatedUsers = await User.aggregatePaginate(aggregate, options);

  if (Array.isArray(paginatedUsers.data)) {
    /** Handle status sorting if specified */
    if (sortBy === 'status') {
      paginatedUsers.data.sort((a, b) => {
        const priorityA = getStatusPriority(a);
        const priorityB = getStatusPriority(b);
        return priorityA - priorityB;
      });
    }

    paginatedUsers.data = paginatedUsers.data.map((user: any) => {
      const decrypted = decryptUser(user, { toObject: false });
      const sanitized = PaginatedUserSchema.parse(decrypted);

      /** Keep only memberships to current organization */
      sanitized.organizations = sanitized.organizations?.filter(
        (membership) =>
          membership.organization.slug === organizationSlug
      );

      return sanitized;
    });
  }

  paginatedUsers = withFromAndTo(paginatedUsers);

  return paginatedUsers;
}

async function getPublicUsersByRole({
  role,
  page = 1,
  limit = 20,
  search,
  status,
  sortBy
}: {
  role: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string[];
  sortBy?: string;
}) {
  function* generateStatusOrQueries(): Generator<FilterQuery<unknown>> {
    const specifiedStatuses = status ?? [];

    for (const item of specifiedStatuses) {
      if (item === 'ARCHIVED') {
        yield {
          archived_at: { $exists: true, $ne: null }
        };
      }
      if (item === 'BLOCKED') {
        yield {
          'organizations.blocked_at': { $exists: true, $ne: null }
        };
      }
      if (item === 'APPROVED') {
        yield {
          'organizations.approved_at': { $exists: true, $ne: null }
        };
      }
      if (item === 'VERIFIED') {
        yield {
          email_verified_at: { $exists: true, $ne: null }
        };
      }
      if (item === 'UNVERIFIED') {
        yield {
          email_verified_at: null
        };
      }
    }
  }

  function* generateAndQueries(): Generator<FilterQuery<unknown>> {
    /** Only get members of Public organization with specified role */
    yield {
      organizations: {
        $elemMatch: {
          organization: publicOrg._id,
          roles: role
        }
      }
    };

    /** Keep only non-deleted users */
    yield {
      deleted_at: null
    };

    /** Include selected statuses only, if specified */
    const statusOrQueries = [...generateStatusOrQueries()];
    if (statusOrQueries.length > 0) {
      yield {
        $or: statusOrQueries
      };
    }
  }

  function* generatePipeline(): Generator<PipelineStage> {
    /** Add and queries */
    const andQueries = [...generateAndQueries()];
    if (andQueries.length > 0) {
      yield {
        $match: {
          $and: andQueries
        }
      };
    }

    /** Include search matches only, if specified */
    if (search) {
      const searchStage = userManagement.getSearchMatchStage({
        helper,
        search
      });

      yield searchStage;
    }

    /** Populate memberships */
    const populateStages =
      userManagement.getPopulateUserMembershipsAsAggregationStages();
    for (const stage of populateStages) {
      yield stage;
    }

    /** Add sort options */
    const sortStages = userManagement.getSortStages({
      helper,
      sortBy
    });
    for (const stage of sortStages) {
      yield stage;
    }
  }

  /** Get public organization */
  const publicOrg = await organizationService.getPublicOrganization();

  /** Get decryption helper */
  const helper = await userManagement.getUserManagementHelper({
    orgId: String(publicOrg._id),
    roles: [role],
    search,
    sortBy
  });

  /** Build aggregation */
  const pipeline = [...generatePipeline()];
  const aggregate = User.aggregate(pipeline);

  const options = {
    page,
    limit,
    customLabels
  };
  let paginatedUsers = await User.aggregatePaginate(aggregate, options);

  if (Array.isArray(paginatedUsers.data)) {
    /** Handle status sorting if specified */
    if (sortBy === 'status') {
      paginatedUsers.data.sort((a, b) => {
        const priorityA = getStatusPriority(a);
        const priorityB = getStatusPriority(b);
        return priorityA - priorityB;
      });
    }

    paginatedUsers.data = paginatedUsers.data.map((user: any) => {
      /**
       * Sanitize user; will also decrypt
       *
       * Previous implementation also removed verification token
       */
      const sanitized = sanitizeUser(user, { toObject: false });

      /** Keep only public memberships */
      sanitized.organizations = sanitized.organizations?.filter(
        (membership) =>
          membership.organization.name ===
          organizationConfig.PUBLIC_ORGANIZATION_NAME
      );

      return sanitized;
    });
  }

  paginatedUsers = withFromAndTo(paginatedUsers);

  return paginatedUsers;
}

async function getUserById(userId: string) {
  const user = await User.findById(userId).populate(
    'organizations.organization'
  );

  return user;
}

async function approveUser(args: {
  session?: ClientSession;
  userId: string;
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userId, user, org } = args;
  const { reqAuth } = args;

  const targetUser = await User.findById(userId).populate(
    'organizations.organization'
  );
  if (!targetUser) {
    throw createHttpError.NotFound('Target user not found');
  }

  const emailVerifiedDate = targetUser.email_verified_at ?? null;
  if (emailVerifiedDate === null) {
    throw createHttpError.BadRequest(
      'Target user is not yet verified.'
    );
  }

  const encryptedOrgSlug = encryptFieldData(org);

  const targetUserMembership = targetUser.organizations?.find(
    (m) => m.organization.slug.hash === encryptedOrgSlug.hash
  );
  if (targetUserMembership === undefined) {
    throw createHttpError.NotFound(
      'Target user not organization member'
    );
  }

  const approveDate = targetUserMembership.approved_at ?? null;
  if (approveDate !== null) {
    throw createHttpError.BadRequest('User is already approved');
  }

  targetUserMembership.approved_at = dayjsUTCDate() as any;
  await targetUser.save({ session });

  /** Send email */
  const firstRole = targetUserMembership.roles[0] ?? 'User';
  const url = `${frontendConfig.url}/sign-in`;

  const actorUserFullName = decryptFieldData(user.full_name);
  const targetUserFullName = decryptFieldData(targetUser.full_name);
  const targetUserEmail = decryptFieldData(targetUser.email);
  const targetUserRole =
    getUserRole({ user: targetUser, org }) ?? 'User';

  const approvalEmailData = getApprovalEmailData(firstRole, {
    email: targetUserEmail,
    recipient: targetUserFullName,
    url
  });

  if (approvalEmailData) {
    const { emailPayload, templateData, template } = approvalEmailData;
    mailService.sendMail(emailPayload, templateData, template, true);
  }

  /** Log action */
  const orgId = getOrgIdByOrgSlug({ user, org });
  if (orgId) {
    await logService.createLog({
      organization: orgId,
      payload_snapshot: logService.encryptPayloadSnapshot({
        actor_user_id: user._id,
        target_user_id: targetUser._id
      }),
      type: UserLogType.APPROVE,
      activity: encryptFieldData(
        generateLogDetails({
          actor: `${actorUserFullName} (${reqAuth.role})`,
          target: `${targetUserFullName} (${targetUserRole})`,
          type: 'approved'
        })
      )
    });
  }
}

async function blockUser(args: {
  session?: ClientSession;
  userId: string;
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userId, user, org } = args;
  const { reqAuth } = args;

  const targetUser = await User.findById(userId).populate(
    'organizations.organization'
  );
  if (!targetUser) {
    throw createHttpError.NotFound('Target user not found');
  }

  const encryptedOrgSlug = encryptFieldData(org);

  const targetUserMembership = targetUser.organizations?.find(
    (m) => m.organization.slug.hash === encryptedOrgSlug.hash
  );
  if (targetUserMembership === undefined) {
    throw createHttpError.NotFound(
      'Target user not organization member'
    );
  }

  const blockDate = targetUserMembership.blocked_at ?? null;
  if (blockDate !== null) {
    throw createHttpError.BadRequest('User is already blocked');
  }

  targetUserMembership.blocked_at = dayjsUTCDate() as any;
  await targetUser.save({ session });

  const actorUserFullName = decryptFieldData(user.full_name);
  const targetUserFullName = decryptFieldData(targetUser.full_name);
  const targetUserRole =
    getUserRole({ user: targetUser, org }) ?? 'User';

  const orgId = getOrgIdByOrgSlug({ user, org });
  if (orgId) {
    await logService.createLog({
      organization: orgId,
      payload_snapshot: logService.encryptPayloadSnapshot({
        actor_user_id: user._id,
        target_user_id: targetUser._id
      }),
      type: UserLogType.BLOCK,
      activity: encryptFieldData(
        generateLogDetails({
          actor: `${actorUserFullName} (${reqAuth.role})`,
          target: `${targetUserFullName} (${targetUserRole})`,
          type: 'blocked'
        })
      )
    });
  }
}

async function unblockUser(args: {
  session?: ClientSession;
  userId: string;
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userId, user, org } = args;
  const { reqAuth } = args;

  const targetUser = await User.findById(userId).populate(
    'organizations.organization'
  );
  if (!targetUser) {
    throw createHttpError.NotFound('Target user not found');
  }

  const encryptedOrgSlug = encryptFieldData(org);

  const targetUserMembership = targetUser.organizations?.find(
    (m) => m.organization.slug.hash === encryptedOrgSlug.hash
  );
  if (targetUserMembership === undefined) {
    throw createHttpError.NotFound(
      'Target user not organization member'
    );
  }

  const blockDate = targetUserMembership.blocked_at ?? null;
  if (blockDate === null) {
    throw createHttpError.BadRequest('User is not blocked');
  }

  targetUserMembership.blocked_at = null;
  await targetUser.save({ session });

  const actorUserFullName = decryptFieldData(user.full_name);
  const targetUserFullName = decryptFieldData(targetUser.full_name);
  const targetUserRole =
    getUserRole({ user: targetUser, org }) ?? 'User';

  const orgId = getOrgIdByOrgSlug({ user, org });
  if (orgId) {
    await logService.createLog({
      organization: orgId,
      payload_snapshot: logService.encryptPayloadSnapshot({
        actor_user_id: user._id,
        target_user_id: targetUser._id
      }),
      type: UserLogType.UNBLOCK,
      activity: encryptFieldData(
        generateLogDetails({
          actor: `${actorUserFullName} (${reqAuth.role})`,
          target: `${targetUserFullName} (${targetUserRole})`,
          type: 'unblocked'
        })
      )
    });
  }
}

async function archiveUser(args: {
  userId: string;
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { userId, user, org } = args;
  const { reqAuth } = args;

  const archivedUser = await User.findByIdAndUpdate(
    userId,
    { archived_at: dayjsUTCDate() },
    { new: true }
  ).populate('organizations.organization');
  if (!archivedUser) throw createHttpError.NotFound();

  const actorUserFullName = decryptFieldData(user.full_name);
  const targetUserFullName = decryptFieldData(archivedUser.full_name);
  const targetUserRole =
    getUserRole({ user: archivedUser, org }) ?? 'User';

  const orgId = getOrgIdByOrgSlug({ user, org });
  if (orgId) {
    await logService.createLog({
      organization: orgId,
      payload_snapshot: logService.encryptPayloadSnapshot({
        actor_user_id: user._id,
        target_user_id: archivedUser._id
      }),
      type: UserLogType.ARCHIVE,
      activity: encryptFieldData(
        generateLogDetails({
          actor: `${actorUserFullName} (${reqAuth.role})`,
          target: `${targetUserFullName} (${targetUserRole})`,
          type: 'archived'
        })
      )
    });
  }
}

async function bulkApproveUsers(args: {
  session?: ClientSession;
  userIds: string[];
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userIds, user, org } = args;
  const { reqAuth } = args;

  const promises = userIds.map((userId) =>
    approveUser({
      session,
      userId,
      user,
      org,
      reqAuth
    })
  );
  await Promise.all(promises);
}

async function bulkBlockUsers(args: {
  session?: ClientSession;
  userIds: string[];
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userIds, user, org } = args;
  const { reqAuth } = args;

  const promises = userIds.map((userId) =>
    blockUser({
      session,
      userId,
      user,
      org,
      reqAuth
    })
  );
  await Promise.all(promises);
}

async function bulkUnblockUsers(args: {
  session?: ClientSession;
  userIds: string[];
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { session } = args;
  const { userIds, user, org } = args;
  const { reqAuth } = args;

  const promises = userIds.map((userId) =>
    unblockUser({
      session,
      userId,
      user,
      org,
      reqAuth
    })
  );
  await Promise.all(promises);
}

async function bulkArchiveUsers(args: {
  userIds: string[];
  user: UserType;
  org: string;
  reqAuth: RequestAuth;
}) {
  const { userIds, user, org } = args;
  const { reqAuth } = args;

  await User.updateMany(
    { _id: { $in: userIds } },
    { archived_at: dayjsUTCDate() }
  );

  const users = await User.find({ _id: { $in: userIds } }).populate(
    'organizations.organization'
  );

  for (const archivedUser of users) {
    const actorUserFullName = decryptFieldData(user.full_name);
    const targetUserFullName = decryptFieldData(archivedUser.full_name);
    const targetUserRole =
      getUserRole({ user: archivedUser, org }) ?? 'User';

    const orgId = getOrgIdByOrgSlug({ user, org });
    if (orgId) {
      await logService.createLog({
        organization: orgId,
        payload_snapshot: {
          actor_user_id: user._id,
          target_user_id: archivedUser._id
        },
        type: UserLogType.ARCHIVE,
        activity: encryptFieldData(
          generateLogDetails({
            actor: `${actorUserFullName} (${reqAuth.role})`,
            target: `${targetUserFullName} (${targetUserRole})`,
            type: 'archived'
          })
        )
      });
    }
  }
}

/** First membership with acceptable conditions */
function getUserDefaultMembership(user: UserType) {
  const memberships = user.organizations ?? [];

  for (const membership of memberships) {
    /** Approved memberships only */
    const approvedDate = membership.approved_at ?? null;
    const isApproved = approvedDate !== null;
    if (!isApproved) {
      continue;
    }

    /** Non-blocked memberships */
    const blockedDate = membership.blocked_at ?? null;
    const isBlocked = blockedDate !== null;
    if (isBlocked) {
      continue;
    }

    /** Accepted memberships only */
    if (membership.status !== invitationStatus.ACCEPTED) {
      continue;
    }

    return membership;
  }

  return null;
}

function checkUserIfPublicAdmin(user: UserType) {
  const memberships = user.organizations ?? [];

  const encryptedPublicName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  const publicMembership = memberships.find(
    (membership) =>
      membership.organization.name.hash === encryptedPublicName.hash
  );
  if (publicMembership === undefined) {
    return { isPublicAdmin: false } as const;
  }

  const isAdmin = publicMembership.roles.includes(roles.ADMIN);
  if (!isAdmin) {
    return { isPublicAdmin: false } as const;
  }

  return { isPublicAdmin: true, publicMembership } as const;
}

export default {
  sanitizeUser,
  decryptUser,
  getUsers,
  getPublicUsersByRole,
  getUserById,
  approveUser,
  blockUser,
  unblockUser,
  archiveUser,
  bulkApproveUsers,
  bulkBlockUsers,
  bulkUnblockUsers,
  bulkArchiveUsers,
  inviteUser,
  inviteOwnerBasic,
  inviteOwnerEnterprise,
  getUserDefaultMembership,
  checkUserIfPublicAdmin
};
