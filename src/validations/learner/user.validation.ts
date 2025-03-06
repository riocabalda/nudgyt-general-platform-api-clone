import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const GetAccessSchema = z.object({
  org: z.string()
});

const getAccess = validateRequest({
  params: GetAccessSchema
});

export default {
  getAccess
};
