import dotenv from 'dotenv';

dotenv.config();

const seederConfig = {
  superAdminEmail:
    process.env.SUPERADMIN_EMAIL || 'superadmin@nudgyt.com',
  superAdminPassword: process.env.SUPERADMIN_PASSWORD || 'P@ssword1'
};

export default seederConfig;
