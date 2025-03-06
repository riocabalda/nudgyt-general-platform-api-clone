import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  adjustAndFormatDateRange,
  getPreviousDateByCount
} from './adjust-format-date';

export function getPeriodBetweenDates(
  startDate: string,
  endDate: string
) {
  dayjs.extend(utc);
  const isToday = startDate === endDate;

  startDate = dayjs.utc(startDate).format();
  endDate = dayjs.utc(endDate).format();

  // date today, endDate also means Today date of the current period
  const currentDay = new Date(endDate);

  // the start day of the current period
  const currentStartDayPeriod = new Date(startDate);

  // get the number of days between the current start date and end date
  let daysBetween: number =
    (currentDay.getTime() - currentStartDayPeriod.getTime()) /
    (1000 * 60 * 60 * 24);
  daysBetween = isToday ? 1 : daysBetween;

  // the start day of the previous period to currentStartDayPeriod (which is the start day of the current period)
  const previousStartDate = getPreviousDateByCount(
    currentStartDayPeriod,
    daysBetween
  );
  const previousEndDate = getPreviousDateByCount(
    currentStartDayPeriod,
    1
  );

  const { start: currentPeriodStartDate, end: currentPeriodEndDate } =
    adjustAndFormatDateRange(startDate, endDate);
  const { start: previousPeriodStartDate, end: previousPeriodEndDate } =
    adjustAndFormatDateRange(previousStartDate, previousEndDate);

  return {
    current: {
      start: currentPeriodStartDate,
      end: currentPeriodEndDate
    },
    previous: {
      start: previousPeriodStartDate,
      end: previousPeriodEndDate
    }
  };
}

export function isCurrentOrPreviousPeriod(
  dateTime: string | Date,
  period: {
    current: { start: Date; end: Date };
    previous: { start: Date; end: Date };
  }
) {

  const isCurrentPeriod =
    dateTime >= period.current.start.toISOString() && dateTime <= period.current.end.toISOString();
  const isPreviousPeriod =
    dateTime >= period.previous.start.toISOString() &&
    dateTime <= period.previous.end.toISOString();

  return { isCurrentPeriod, isPreviousPeriod };
}
