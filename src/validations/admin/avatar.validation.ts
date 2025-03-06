import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

const createAvatar = validateRequest({
  body: z.object({
    mesh_id: z.string(),
    gender: z.string()
  })
});

const updateAvatar = validateRequest({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    mesh_id: z.string().optional(),
    gender: z.string().optional()
  })
});

const deleteAvatar = validateRequest({
  params: z.object({
    id: z.string()
  })
});

export default {
  createAvatar,
  updateAvatar,
  deleteAvatar
};
