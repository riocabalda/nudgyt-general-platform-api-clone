import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import {
  TypedRequestBody,
  TypedRequestParams
} from 'zod-express-middleware';
import asyncWrapper from '../../helpers/async-wrapper';
import { encryptFieldData } from '../../helpers/db';
import User from '../../models/user.model';
import adminUserService from '../../services/admin/user.service';
import userService from '../../services/user.service';
import createResponse from '../../utils/create-response';
import { isSuperAdmin } from '../../utils/validate-org-user-membership';
import {
  BulkUserActionSchema,
  GetAccessSchema,
  GetUserByIdSchema,
  InviteOwnerBasicSchema,
  InviteOwnerEnterpriseSchema,
  InviteUserSchema
} from '../../validations/admin/user.validation';

const getUsers = asyncWrapper(async (req, res) => {
  const { org } = req.params;
  const { search, status, role, page, limit, sortBy } = req.query;

  const users = await userService.getUsers({
    organizationSlug: org,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search: search as string,
    status: status as string[],
    role: role as string[],
    sortBy: sortBy as string
  });

  const response = createResponse({
    customFields: users
  });

  res.json(response);
});

const getTrainers = asyncWrapper(async (req, res) => {
  const { page, limit, search, status, sortBy } = req.query;

  const trainers = await userService.getPublicUsersByRole({
    role: 'Trainer',
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search: search as string,
    status: status as string[],
    sortBy: sortBy as string
  });

  const response = createResponse({
    customFields: trainers
  });

  res.json(response);
});

const getLearners = asyncWrapper(async (req, res) => {
  const { page, limit, search, status, sortBy } = req.query;

  const learners = await userService.getPublicUsersByRole({
    role: 'Learner',
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    search: search as string,
    status: status as string[],
    sortBy: sortBy as string
  });

  const response = createResponse({
    customFields: learners
  });

  res.json(response);
});

const getUserById = asyncWrapper(
  async (
    req: TypedRequestParams<typeof GetUserByIdSchema>,
    res,
    next
  ) => {
    const { userId } = req.params;

    const user = await userService.getUserById(userId);
    const sanitizedUser =
      user === null ? null : userService.sanitizeUser(user);

    const response = createResponse({
      data: sanitizedUser
    });
    res.json(response);
  }
);

const inviteUser = asyncWrapper(
  async (req: TypedRequestBody<typeof InviteUserSchema>, res, next) => {
    const { email, role, organization } = req.body;

    await userService.inviteUser({
      email,
      user: req.user,
      role,
      organization,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'Invitation sent!'
    });
    res.json(response);
  }
);

const inviteOwnerBasic = asyncWrapper(
  async (
    req: TypedRequestBody<typeof InviteOwnerBasicSchema>,
    res,
    next
  ) => {
    const { organizationName, email } = req.body;

    await userService.inviteOwnerBasic({
      invitingUser: req.user,
      organizationName,
      email,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'Invitation sent!'
    });
    res.json(response);
  }
);

const inviteOwnerEnterprise = asyncWrapper(
  async (
    req: TypedRequestBody<typeof InviteOwnerEnterpriseSchema>,
    res,
    next
  ) => {
    const {
      monthlyAmount,
      userSeats,
      organizationName,
      email,
      platformUrl
    } = req.body;

    await userService.inviteOwnerEnterprise({
      invitingUser: req.user,
      monthlyAmount,
      userSeats,
      organizationName,
      email,
      platformUrl,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'Invitation sent!'
    });
    res.json(response);
  }
);

const approveUser = asyncWrapper(async (req, res, next) =>
  mongoose.connection.transaction(async (session) => {
    const { userId, org } = req.params;
    const user = req.user;

    await userService.approveUser({
      session,
      userId,
      user,
      org,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'User approved.'
    });
    res.json(response);
  })
);

const blockUser = asyncWrapper(async (req, res, next) =>
  mongoose.connection.transaction(async (session) => {
    const { userId, org } = req.params;
    const user = req.user;

    await userService.blockUser({
      session,
      userId,
      user,
      org,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'User blocked.'
    });
    res.json(response);
  })
);

const unblockUser = asyncWrapper(async (req, res, next) =>
  mongoose.connection.transaction(async (session) => {
    const { userId, org } = req.params;
    const user = req.user;

    await userService.unblockUser({
      session,
      userId,
      user,
      org,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: 'User unblocked.'
    });
    res.json(response);
  })
);

const archiveUser = asyncWrapper(async (req, res, next) => {
  const { userId, org } = req.params;
  const user = req.user;

  const targetUser = await userService.getUserById(userId);
  if (!targetUser) throw createHttpError.NotFound();

  if (!isSuperAdmin(user)) {
    const encryptedOrg = encryptFieldData(org);
    const orgMembership = targetUser.organizations?.find(
      (m) => m.organization.slug === encryptedOrg
    );
    if (!orgMembership) {
      throw createHttpError.NotFound(
        'User does not belong to this organization'
      );
    }
  }

  await userService.archiveUser({
    userId,
    user,
    org,
    reqAuth: req.auth
  });

  const response = createResponse({ message: 'User archived.' });
  res.json(response);
});

const bulkApproveUsers = asyncWrapper(
  async (
    req: TypedRequestBody<typeof BulkUserActionSchema>,
    res,
    next
  ) =>
    mongoose.connection.transaction(async (session) => {
      const { userIds } = req.body;
      const user = req.user;
      const { org } = req.params;

      await userService.bulkApproveUsers({
        session,
        userIds,
        user,
        org,
        reqAuth: req.auth
      });

      const response = createResponse({
        message: `Successfully approved ${userIds.length} users.`
      });
      res.json(response);
    })
);

const bulkBlockUsers = asyncWrapper(
  async (
    req: TypedRequestBody<typeof BulkUserActionSchema>,
    res,
    next
  ) =>
    mongoose.connection.transaction(async (session) => {
      const { userIds } = req.body;
      const user = req.user;
      const { org } = req.params;

      await userService.bulkBlockUsers({
        session,
        userIds,
        user,
        org,
        reqAuth: req.auth
      });

      const response = createResponse({
        message: `Successfully blocked ${userIds.length} users.`
      });
      res.json(response);
    })
);

const bulkUnblockUsers = asyncWrapper(
  async (
    req: TypedRequestBody<typeof BulkUserActionSchema>,
    res,
    next
  ) =>
    mongoose.connection.transaction(async (session) => {
      const { userIds } = req.body;
      const { org } = req.params;
      const user = req.user;

      await userService.bulkUnblockUsers({
        session,
        userIds,
        user,
        org,
        reqAuth: req.auth
      });

      const response = createResponse({
        message: `Successfully unblocked ${userIds.length} users.`
      });
      res.json(response);
    })
);

const bulkArchiveUsers = asyncWrapper(
  async (
    req: TypedRequestBody<typeof BulkUserActionSchema>,
    res,
    next
  ) => {
    const { userIds } = req.body;
    const { org } = req.params;
    const user = req.user;

    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      throw createHttpError.NotFound('One or more users not found');
    }

    if (!isSuperAdmin(user)) {
      for (const targetUser of users) {
        const encryptedOrg = encryptFieldData(org);
        const orgMembership = targetUser.organizations?.find(
          (m) => m.organization.slug === encryptedOrg
        );
        if (!orgMembership) {
          throw createHttpError.NotFound(
            `User ${targetUser.full_name} does not belong to this organization`
          );
        }
      }
    }

    await userService.bulkArchiveUsers({
      userIds,
      user,
      org,
      reqAuth: req.auth
    });

    const response = createResponse({
      message: `Successfully archived ${userIds.length} users.`
    });
    res.json(response);
  }
);

const getAccess = asyncWrapper(
  async (
    req: TypedRequestParams<typeof GetAccessSchema>,
    res,
    next
  ) => {
    const result = await adminUserService.getAccess({
      reqAuth: req.auth
    });

    const response = createResponse({
      data: result
    });
    res.json(response);
  }
);

const getLearnerStats = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { search, page, limit } = req.query as {
    search?: string;
    page?: number;
    limit?: number;
  };

  const learnerStats = await adminUserService.getLearnerStats({
    orgSlug: org,
    search: search as string,
    page: page || 1,
    limit: limit || 10
  });

  const response = createResponse({
    data: learnerStats
  });
  res.json(response);
});

const getUserRecentServices = asyncWrapper(async (req, res, next) => {
  const { userId, org } = req.params;

  const userRecentServices =
    await adminUserService.getUserRecentServices({
      userId,
      orgSlug: org
    });

  const response = createResponse({
    data: userRecentServices
  });
  res.json(response);
});

const getLearnerExperience = asyncWrapper(async (req, res) => {
  const { org } = req.params;
  const { user } = req;
  const experience = await adminUserService.getLearnerExperience({
    orgSlug: org,
    learner: user.id
  });
  const response = createResponse({
    data: experience
  });
  res.json(response);
});

export default {
  getUsers,
  getTrainers,
  getLearners,
  getUserById,
  inviteUser,
  inviteOwnerBasic,
  inviteOwnerEnterprise,
  approveUser,
  blockUser,
  unblockUser,
  archiveUser,
  bulkApproveUsers,
  bulkArchiveUsers,
  bulkBlockUsers,
  bulkUnblockUsers,
  getAccess,
  getLearnerStats,
  getUserRecentServices,
  getLearnerExperience
};
