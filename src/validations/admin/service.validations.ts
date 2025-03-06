import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const GetServiceStatsSchema = z.object({
  org: z.string()
});

const getServiceStats = validateRequest({
  params: GetServiceStatsSchema
});

export default {
  getServiceStats
};
