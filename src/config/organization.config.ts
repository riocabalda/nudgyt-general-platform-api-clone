import dotenv from 'dotenv';
import z from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PUBLIC_ORGANIZATION_NAME: z.string().min(1).optional(),
  ORGANIZATION_CODE_LENGTH: z.coerce.number().optional()
});
const env = EnvSchema.parse(process.env);

const organizationConfig = {
  PUBLIC_ORGANIZATION_NAME: env.PUBLIC_ORGANIZATION_NAME ?? 'Public',
  ORGANIZATION_CODE_LENGTH: env.ORGANIZATION_CODE_LENGTH ?? 6
};

export default organizationConfig;
