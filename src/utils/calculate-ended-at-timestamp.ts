import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import dayjsUTCDate from './dayjs-utc-date';
import { SimulationType } from '../models/simulation.model';
import { ServiceLevelType } from '../models/service-level.model';
import { getSimulationUsedTime } from './metric-date-and-time-helpers';
export default function calculateEndedAtTimestamp(
  simulationData: SimulationType,
  serviceLevel: ServiceLevelType
): string {
  let endedAtTimestamp = dayjsUTCDate();

  // Check if the service level has a time limit
  if (serviceLevel.time_limit && serviceLevel.time_limit !== -1) {
    // Calculate how much time has been used in the simulation so far
    const timeUsedInMilliseconds =
      getSimulationUsedTime(simulationData);

    // Get the maximum time allowed for this service level
    const timeLimitInMilliseconds = serviceLevel.time_limit;

    // Calculate how much time is remaining (negative if time limit exceeded)
    const timeRemainingInMilliseconds =
      timeLimitInMilliseconds - timeUsedInMilliseconds;

    // If time limit has been reached or exceeded
    if (timeRemainingInMilliseconds <= 0) {
      // Calculate the exact time when the time limit was reached
      const timeExceededBy = Math.abs(timeRemainingInMilliseconds);

      // Use dayjs to determine the exact timestamp when the time limit was reached
      // by subtracting the excess time from the current moment
      dayjs.extend(utc);
      const timeWhenLimitReached = dayjs
        .utc()
        .subtract(timeExceededBy, 'millisecond');
      endedAtTimestamp = timeWhenLimitReached.format();
    }
  }

  return endedAtTimestamp;
}
