import { parse } from 'csv-parse';
import iconv from 'iconv-lite';
import { promisify } from 'util';
import fsExtra from 'fs-extra';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Transaction, DataProvider } from '../types';

dayjs.extend(customParseFormat);
const parseCsv = promisify(parse) as (csv: string, params: any) => Promise<string[][]>;

const CSV_FIELDS = {
  DATETIME: 0,
  CARD_NUMBER: 2,
  STATUS: 3,
  SUMM: 6,
  CURRENCY: 7,
  CATEGORY: 9,
  DESCRIPTION: 11,
};

function mapCsvRow(row: string[]): Transaction {
  const dateObj = dayjs(row[CSV_FIELDS.DATETIME], 'DD.MM.YYYY HH:mm:ss');
  return {
    date: dateObj.toDate(),
    dateKey: dateObj.format('YYYY-MM'),
    amount: parseFloat(row[CSV_FIELDS.SUMM].replace(/ /g, '').replace(/,/g, '.')),
    currency: row[CSV_FIELDS.CURRENCY],
    category: row[CSV_FIELDS.CATEGORY],
    name: row[CSV_FIELDS.DESCRIPTION],
  };
}

function getData(rawData: string[][]): Transaction[] {
  return rawData
    .filter((row) => row[CSV_FIELDS.STATUS] !== 'FAILED')
    .map(mapCsvRow);
}

async function loadCsv(filePath: string) {
  const csvFile = await fsExtra.readFile(filePath);
  const csvString = iconv.decode(csvFile, 'win1251');
  const csv = await parseCsv(csvString, { delimiter: ';' });
  return csv.slice(1);
}

export async function getDataFromCsvFile(filePath: string): Promise<Transaction[]> {
  const csv = await loadCsv(filePath);
  return getData(csv);
}

export class TinkoffCsvDataProvider implements DataProvider {
  async getDataFromFile(filePath: string): Promise<Transaction[]> {
    const csv = await loadCsv(filePath);
    return getData(csv);
  }
}
