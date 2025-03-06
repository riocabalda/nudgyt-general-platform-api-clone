import dotenv from 'dotenv';

dotenv.config();

const convaiConfig = {
  convaiApiUrl: process.env.CONVAI_API_URL || 'https://api.convai.com',
  convaiApiKey: process.env.CONVAI_API_KEY || ''
};

export default convaiConfig;
