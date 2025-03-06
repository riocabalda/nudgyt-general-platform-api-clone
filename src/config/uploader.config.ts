import dotenv from 'dotenv';
import z from 'zod';

dotenv.config();

const sizes = {
  '5 MB': 5 * 1024 * 1024
};

const EnvSchema = z.object({
  MAX_FILE_SIZE: z.coerce.number().optional()
});
const env = EnvSchema.parse(process.env);

const uploaderConfig = {
  MAX_FILE_SIZE: env.MAX_FILE_SIZE ?? sizes['5 MB']
};

export default uploaderConfig;
