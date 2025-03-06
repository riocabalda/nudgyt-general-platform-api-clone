import moment from 'moment-timezone';

// Convert datetime string to seconds since midnight
export function datetimeToSeconds(datetime: string): number {
  const date = new Date(datetime);
  const midnight = new Date(date.toDateString() + ' 00:00:00'); // Midnight of the same day
  return (date.getTime() - midnight.getTime()) / 1000;
}

// Convert seconds to HH:MM:SS format
export function convertMilliseconds(
  ms: number | undefined | null,
  isFullHour = true
): {
  timeString: string;
  totalMinutes: number;
} {
  // Ensure ms is a positive number
  if (!ms) {
    return { timeString: '00:00:00', totalMinutes: 0 };
  }

  // Calculate total seconds from milliseconds
  const totalSeconds = Math.floor(ms / 1000);

  // Calculate hours, minutes, and seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Format hours, minutes, and seconds with leading zeros if needed
  const hoursFormatted =
    hours > 0 || isFullHour
      ? hours.toString().padStart(2, '0') + ':'
      : '';
  const minutesFormatted =
    hours > 0
      ? minutes.toString().padStart(2, '0')
      : minutes.toString().padStart(2, '0');
  const secondsFormatted = seconds.toString().padStart(2, '0');

  if (
    isNaN(Number(hoursFormatted.replace(':', ''))) ||
    isNaN(Number(minutesFormatted.replace(':', ''))) ||
    isNaN(Number(secondsFormatted.replace(':', '')))
  ) {
    return { timeString: '00:00:00', totalMinutes: 0 };
  }

  // Create the time string
  const timeString = `${hoursFormatted}${minutesFormatted}:${secondsFormatted}`;

  // Calculate total minutes
  const totalMinutes = hours * 60 + minutes + seconds / 60;

  return { timeString, totalMinutes };
}

export function calculateActiveTime(
  start: Date,
  end: Date,
  paused?: any[],
  resumed?: any[]
): number {
  let totalActiveSeconds =
    datetimeToSeconds(end.toString()) -
    datetimeToSeconds(start.toString());

  if (paused && resumed) {
    for (let i = 0; i < paused?.length; i++) {
      const pauseStart = datetimeToSeconds(paused[i].toString());
      const resumeStart = datetimeToSeconds(resumed[i].toString());
      totalActiveSeconds -= resumeStart - pauseStart;
    }
  }

  return totalActiveSeconds;
}

// Function to calculate percentage change
export function calculatePercentageChange(
  oldValue: number,
  newValue: number
): string {
  if (oldValue === 0) {
    return '0%';
  }

  const percentageChange = ((newValue - oldValue) / oldValue) * 100;

  if (!percentageChange) return '0%';

  return percentageChange.toFixed(2) + '%';
}

export function isChangeDirectionIncrease(
  percentageChange: number
): boolean | null {
  if (percentageChange > 0) {
    return true;
  } else if (percentageChange < 0) {
    return false;
  } else {
    return null;
  }
}

export function calcTimeDiffInMillisec(
  startDateTime: string,
  endDateTime: string
): number {
  // Parse the UTC datetime strings into moment objects
  const startMoment = moment.utc(startDateTime);
  const endMoment = moment.utc(endDateTime);

  // Calculate the difference in milliseconds
  const diffMilliseconds: number = endMoment.diff(startMoment);

  return diffMilliseconds;
}

export function getSimulationUsedTime(simulation: any) {
  if (simulation.resumed_at?.length) {
    let timeUsed = 0;
    const parsedResumeValues = simulation.resumed_at;
    const parsedPauseValues = simulation.paused_at;

    timeUsed += calcTimeDiffInMillisec(
      simulation.started_at as string,
      parsedPauseValues[0]
    );

    parsedResumeValues.forEach((resumedAt: any, i: number) => {
      if (!!parsedPauseValues[i + 1]) {
        timeUsed += calcTimeDiffInMillisec(
          resumedAt,
          parsedPauseValues[i + 1]
        );
      } else {
        if (
          simulation.ended_at === null &&
          simulation.cancelled_at === null
        ) {
          timeUsed += calcTimeDiffInMillisec(
            resumedAt,
            moment.utc().toISOString()
          );
        } else {
          timeUsed += calcTimeDiffInMillisec(
            resumedAt,
            simulation.ended_at || simulation.cancelled_at
          );
        }
      }
    });
    return timeUsed;
  }
  if (simulation.paused_at?.length) {
    const parsedPauseValues = simulation.paused_at;
    const timeUsed = calcTimeDiffInMillisec(
      simulation.started_at as string,
      parsedPauseValues[0]
    );
    return timeUsed;
  }
  if (
    simulation.ended_at !== null ||
    simulation.cancelled_at !== null
  ) {
    const timeUsed = calcTimeDiffInMillisec(
      simulation.started_at as string,
      simulation.ended_at || simulation.cancelled_at
    );
    return timeUsed;
  }
  if (simulation.started_at !== null) {
    const timeUsed = calcTimeDiffInMillisec(
      simulation.started_at,
      moment.utc().toISOString()
    );
    return timeUsed;
  }
  return 0;
}

export function getDateRange(
  timeFrame:
    | 'seven-days'
    | 'today'
    | 'yesterday'
    | 'weekly'
    | 'monthly'
    | 'yearly'
) {
  let endDate = moment().endOf('day'); // End of the current day
  let startDate;

  switch (timeFrame) {
    case 'today':
      startDate = moment().startOf('day'); // Start of today
      break;
    case 'yesterday':
      startDate = moment().subtract(1, 'days').startOf('day'); // Start of yesterday
      endDate = moment().subtract(1, 'days').endOf('day'); // End of yesterday
      break;
    case 'seven-days':
      startDate = moment().subtract(7, 'days').startOf('day'); // Start of 7 days ago
      break;
    case 'weekly':
      startDate = moment().subtract(1, 'weeks').startOf('week'); // Start of the past week from today
      break;
    case 'monthly':
      startDate = moment().subtract(1, 'months').startOf('month'); // Start of the past month from today
      break;
    case 'yearly':
      startDate = moment().subtract(1, 'years').startOf('year'); // Start of the past year from today
      break;
    default:
      throw new Error('Invalid time frame');
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

export function calculateTotalUsedTime(simulation: any): number {
  let totalUsedTime = 0;
  const { started_at, ended_at, paused_at, resumed_at, cancelled_at } =
    simulation;

  // If the simulation has ended or is cancelled, calculate the active time
  if (ended_at || cancelled_at) {
    let activeTime = calcTimeDiffInMillisec(
      started_at,
      ended_at || cancelled_at
    );

    // If there are pauses, subtract the paused time
    if (paused_at && paused_at.length > 0) {
      for (let i = 0; i < paused_at.length; i++) {
        const pauseStart = paused_at[i];
        const resumeStart = resumed_at[i] || ended_at || cancelled_at; // Use ended or cancelled time if no resume

        activeTime -= calcTimeDiffInMillisec(pauseStart, resumeStart);
      }
    }

    totalUsedTime += activeTime; // Add to total used time
  } else if (started_at) {
    // If the simulation is still ongoing, calculate time until now
    const activeTime = calcTimeDiffInMillisec(
      started_at,
      new Date().toISOString()
    );
    totalUsedTime += activeTime; // Add to total used time
  }

  return totalUsedTime; // Returns total used time in milliseconds
}
