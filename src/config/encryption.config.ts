import dotenv from 'dotenv';
import z from 'zod';

dotenv.config();

const EnvSchema = z.object({
  JWT_SECRET_KEY: z.string(),
  JWT_DEFAULT_EXPIRATION_SECS: z.coerce.number().optional(),

  REFRESH_TOKEN_COOKIE_KEY: z.string().optional(),

  ACCESS_TOKEN_EXPIRATION_SECS: z.coerce.number().optional(),
  REFRESH_TOKEN_EXPIRATION_SECS: z.coerce.number().optional(),

  AES_ENCRYPTION_KEY: z.string()
});
const env = EnvSchema.parse(process.env);

const encryptionConfig = {
  jwtSecret: env.JWT_SECRET_KEY,
  jwtExpiration: env.JWT_DEFAULT_EXPIRATION_SECS ?? 3600,

  refreshTokenCookieKey: env.REFRESH_TOKEN_COOKIE_KEY ?? 'nudgyt-rtkn',

  accessTokenExpiration: env.ACCESS_TOKEN_EXPIRATION_SECS ?? 15 * 60, // 15 minutes
  refreshTokenExpiration:
    env.REFRESH_TOKEN_EXPIRATION_SECS ?? 7 * 24 * 60 * 60, // 7 days

  aesEncryptionKey: env.AES_ENCRYPTION_KEY
};

export default encryptionConfig;
