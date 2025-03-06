import dotenv from 'dotenv';

dotenv.config();

const authConfig = {
  authIgnorePaths: [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/register',
    '/api/auth/resend-email-verification',
    '/api/auth/verify-email',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/public',
    '/images/*'
  ]
};

export default authConfig;
