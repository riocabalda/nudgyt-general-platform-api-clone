import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const CreateServiceLevelSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  current_step: z.string().optional(),
  service_type: z.string().optional(),
  time_limit: z.string().optional(),
  characters: z.string().optional(),
  environment: z.string().optional(),
  cover_image: z.string().optional(),
  template_id: z.string().optional()
});

export const UpdateServiceLevelSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  current_step: z.string().optional(),
  service_type: z.string().optional(),
  time_limit: z.string().optional(),
  characters: z.string().optional(),
  environment: z.string().optional(),
  cover_image: z.string().optional()
});

const createService = validateRequest({
  body: CreateServiceLevelSchema
});

const updateService = validateRequest({
  body: UpdateServiceLevelSchema
});

export default {
  createService,
  updateService
};
