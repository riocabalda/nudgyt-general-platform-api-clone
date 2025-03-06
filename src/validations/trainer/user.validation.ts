import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const GetAccessSchema = z.object({
  org: z.string()
});

export const GetUserRecentServicesSchema = z.object({
  userId: z.string()
});

const getAccess = validateRequest({
  params: GetAccessSchema
});

const getUserRecentServices = validateRequest({
  params: GetUserRecentServicesSchema
});

export default {
  getAccess,
  getUserRecentServices
};
