export function adjustAndFormatDateRange(
  startDate: string | Date,
  endDate: string | Date
) {
  // Create Date objects from the start and end date strings
  let start = new Date(startDate);
  let end = new Date(endDate);

  // Adjust start date to the beginning of the day (12:00:00 AM)
  start.setHours(0, 0, 0, 0);

  // Adjust end date to the end of the day (11:59:59 PM)
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end
  };
}

export function getPreviousDateByCount(
  date: string | Date,
  count: number | string
) {
  const setDate = new Date(date);
  setDate.setDate(setDate.getDate() - Number(count));

  return setDate;
}

