import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

const createEnvironment = validateRequest({
  body: z.object({
    location: z.string(),
    description: z.string(),
    environment_id: z.string(),
    available_characters: z.array(z.string()),
    maximum_characters: z.number()
  })
});

const updateEnvironment = validateRequest({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    location: z.string().optional(),
    description: z.string().optional(),
    environment_id: z.string().optional(),
    available_characters: z.array(z.string()).optional(),
    maximum_characters: z.number().optional()
  })
});

export default {
  createEnvironment,
  updateEnvironment
};
