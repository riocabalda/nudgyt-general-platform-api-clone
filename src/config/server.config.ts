import dotenv from 'dotenv';

dotenv.config();

const serverConfig = {
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  port: process.env.PORT,
  environment: process.env.NODE_ENV || 'development',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000'
};

export default serverConfig;
