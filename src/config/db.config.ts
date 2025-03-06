import dotenv from 'dotenv';
import serverConfig from './server.config';

dotenv.config();

const dbConfig = {
  mongoDbUri:
    serverConfig.environment === 'development'
      ? process.env.MONGODB_LOCAL_URI
      : process.env.MONGODB_URI,
  dbName: process.env.MONGODB_NAME
};

export default dbConfig;
