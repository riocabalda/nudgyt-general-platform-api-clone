import dotenv from 'dotenv';

dotenv.config();

const mailConfig = {
  zapierHookUrl: process.env.ZAPIER_HOOK_URL || '',
  supportEmail: process.env.SUPPORT_EMAIL ?? 'info@nudgyt.com'
};

export default mailConfig;
