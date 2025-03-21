import { Server, ServerOptions } from 'socket.io';
import frontendConfig from '../config/frontend.config';
import { authenticateWs } from '../middlewares/authenticate-ws';
import socketManager from './socket-manager';

const socketConfig: Partial<ServerOptions> = {
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  cors: {
    origin: frontendConfig.url,
    methods: ['GET', 'POST']
  }
};

export const createSocketServer = (httpServer: any): Server => {
  const io = new Server(httpServer, socketConfig);

  io.use((socket, next) => {
    authenticateWs(socket as any, next);
  });

  // Store the io instance in the socket manager
  socketManager.setIO(io);

  return io;
};
