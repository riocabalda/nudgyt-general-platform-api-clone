import { Server, Socket } from 'socket.io';
import simulationService from '../services/learner/simulation.service';

export const setupSocketHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket & { payload?: any }) => {
    socket.on('disconnect', () => {
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
