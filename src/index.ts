import app from './app';
import connectDb from './helpers/db';
import serverConfig from './config/server.config';

const startServer = async () => {
  try {
    await connectDb();
    app.listen(serverConfig.port, () => {
      console.log('Server listening on port:', serverConfig.port);
    });
  } catch (error) {
    if (error instanceof Error) {
      console.log('Failed to start the server:', error.message);
    }
  }
};

startServer();
