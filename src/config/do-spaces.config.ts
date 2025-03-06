import dotenv from 'dotenv';
import z from 'zod';

dotenv.config();

/**
 * New requirement for AWS SDK v3
 *
 * Needs to be present, but is not actually used (apparently)
 *
 * https://docs.digitalocean.com/products/spaces/how-to/use-aws-sdks/
 */
const DO_DEFAULT_REGION = 'us-east-1';

const EnvSchema = z.object({
  DO_SPACES_API_KEY: z.string().min(1),
  DO_SPACES_SECRET_KEY: z.string().min(1),
  DO_SPACES_ENDPOINT: z.string().min(1),
  DO_SPACES_BUCKET: z.string().min(1),
  DO_SPACES_DIRECTORY: z.string().min(1),
  DO_SPACES_REGION: z.string().min(1).optional()
});
const env = EnvSchema.parse(process.env);

const DOSpacesConfig = {
  apiKey: env.DO_SPACES_API_KEY,
  secretKey: env.DO_SPACES_SECRET_KEY,
  endPoint: env.DO_SPACES_ENDPOINT,
  bucket: env.DO_SPACES_BUCKET,
  directory: env.DO_SPACES_DIRECTORY,
  region: env.DO_SPACES_REGION ?? DO_DEFAULT_REGION
};

export default DOSpacesConfig;
