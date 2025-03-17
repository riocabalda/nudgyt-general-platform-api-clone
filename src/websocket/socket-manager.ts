import { Server } from 'socket.io';

// Socket.IO instance
let io: Server | null = null;

// Socket manager as a singleton object
export default {
  // Set the Socket.IO instance
  setIO: (socketIO: Server): void => {
    io = socketIO;
  },

  // Get the Socket.IO instance
  getIO: (): Server | null => {
    return io;
  }
};
