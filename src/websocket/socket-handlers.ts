import { Server, Socket } from 'socket.io';
import simulationService from '../services/learner/simulation.service';

export const setupSocketHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket & { payload?: any }) => {
    console.log('======= A user connected =======');
    socket.on('reconnect', () => {
      try {
        simulationService.resumeSimulationTime(
          socket.payload.simulationId
        );
      } catch (error) {
        console.log('Error resuming the simulation.', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('======= A user disconnected =======');
      try {
        simulationService.pauseSimulationTime(
          socket.payload.simulationId
        );
      } catch (error) {
        console.log('Error pausing the simulation.', error);
      }
    });
  });
};
