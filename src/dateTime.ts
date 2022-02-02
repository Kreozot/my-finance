const MS_PER_DAY = 86400000;

/**
 * Converts a Lotus serial format to a JS UTC date.
 * @param serial {number}
 * @return {Date}
 */
export function serialToDateUTC(serial: number) {
  const intPart = Math.floor(serial);
  const fracPart = serial - intPart;
  const time = Math.round(fracPart * MS_PER_DAY);
  const date = new Date(Date.UTC(1899, 11, 30 + intPart) + time);
  return date;
}

/**
 * Converts a JS Date to Lotus serial format.
 * @param date {Date}
 * @return {number}
 */
export function utcDateToSerial(date: Date) {
  const dateSansTime = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const intPart = Math.round((dateSansTime.getTime() - Date.UTC(1899, 11, 30)) / MS_PER_DAY);
  const fracPart = (date.getTime() - dateSansTime.getTime()) / MS_PER_DAY;
  return intPart + fracPart;
}
