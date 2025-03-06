import z from 'zod';
import { validateRequest } from 'zod-express-middleware';
import messages from '../../constants/response-messages';
import roles from '../../constants/roles';

export const GetUserByIdSchema = z.object({
  userId: z.string()
});

export const BulkUserActionSchema = z.object({
  userIds: z
    .array(z.string())
    .min(1, 'At least one user must be selected')
});

export const CreateUserSchema = z.object({
  full_name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.string()
});

export const InviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum([roles.ADMIN, roles.TRAINER, roles.LEARNER], {
    message: messages.USER_TYPE_INVALID
  }),
  organization: z.string()
});
export const InviteOwnerBasicSchema = z.object({
  organizationName: z.string(),
  email: z.string().email()
});
export const InviteOwnerEnterpriseSchema = z.object({
  monthlyAmount: z.coerce.number(),
  userSeats: z.coerce.number(),
  organizationName: z.string(),
  email: z.string().email(),
  platformUrl: z.string().url()
});

export const ArchiveUserParamsSchema = z.object({
  userId: z.string()
});
export const ArchiveUserBodySchema = z.object({
  transfer_to_user_id: z.string().optional()
});

export const GetAccessSchema = z.object({
  org: z.string()
});

export const GetUserRecentServicesSchema = z.object({
  userId: z.string()
});

const getUserById = validateRequest({
  params: GetUserByIdSchema
});

const createUser = validateRequest({
  body: CreateUserSchema
});

const inviteUser = validateRequest({
  body: InviteUserSchema
});
const inviteOwnerBasic = validateRequest({
  body: InviteOwnerBasicSchema
});
const inviteOwnerEnterprise = validateRequest({
  body: InviteOwnerEnterpriseSchema
});

const archiveUser = validateRequest({
  body: ArchiveUserBodySchema,
  params: ArchiveUserParamsSchema
});

const bulkApproveUsers = validateRequest({
  body: BulkUserActionSchema
});

const bulkBlockUsers = validateRequest({
  body: BulkUserActionSchema
});

const bulkUnblockUsers = validateRequest({
  body: BulkUserActionSchema
});

const bulkArchiveUsers = validateRequest({
  body: BulkUserActionSchema.extend({
    transfer_to_user_id: z.string().optional()
  })
});

const getAccess = validateRequest({
  params: GetAccessSchema
});

const getUserRecentServices = validateRequest({
  params: GetUserRecentServicesSchema
});

export default {
  getUserById,
  createUser,
  inviteUser,
  inviteOwnerBasic,
  inviteOwnerEnterprise,
  archiveUser,
  bulkApproveUsers,
  bulkBlockUsers,
  bulkUnblockUsers,
  bulkArchiveUsers,
  getAccess,
  getUserRecentServices
};
