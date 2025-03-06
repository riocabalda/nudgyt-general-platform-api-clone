import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const CreateTempleteSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  current_step: z.string().optional(),
  service_type: z.string().optional(),
  time_limit: z.string().optional(),
  characters: z.string().optional(),
  environment: z.string().optional()
});

export const EditTemplateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  current_step: z.string().optional(),
  service_type: z.string().optional(),
  time_limit: z.string().optional(),
  characters: z.string().optional(),
  environment: z.string().optional()
});

export const ShareTemplateSchema = z.object({
  organization_ids: z.array(z.string()).optional(),
  is_published: z.boolean().optional()
});

const createTemplate = validateRequest({
  body: CreateTempleteSchema
});

const editTemplate = validateRequest({
  body: EditTemplateSchema
});

const shareTemplate = validateRequest({
  body: ShareTemplateSchema
});

export default {
  createTemplate,
  editTemplate,
  shareTemplate
};
