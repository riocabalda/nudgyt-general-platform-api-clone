import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

function dayjsUTCDate() {
  dayjs.extend(utc); // TODO Move this outside? Seems to be needed only once...
  return dayjs.utc().format();
}

export default dayjsUTCDate;
