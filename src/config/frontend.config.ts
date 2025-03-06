import dotenv from 'dotenv';
import serverConfig from './server.config';

dotenv.config();

const frontendConfig = {
  url:
    serverConfig.environment === 'development'
      ? process.env.FRONTEND_LOCAL_URL
      : process.env.FRONTEND_PROD_URL
};

export default frontendConfig;
