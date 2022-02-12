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
  CURRENCY: 2,
  DATE: 3,
  NAME: 5,
  INCOME_AMOUNT: 6,
  EXPENSE_AMOUNT: 7,
};
const NAME_TRANSFER_REGEXP = /[0-9]+\++[0-9]+\s+[0-9]+\\(?:[A-Za-z0-9 ]+\\){3}([A-Za-z0-9 ]+ )/;

function mapCsvRow(row: string[]): Transaction {
  const dateObj = dayjs(row[CSV_FIELDS.DATE], 'DD.MM.YY');
  const amount = parseFloat(row[CSV_FIELDS.INCOME_AMOUNT])
    ? parseFloat(`${row[CSV_FIELDS.INCOME_AMOUNT]}.${row[CSV_FIELDS.EXPENSE_AMOUNT]}`)
    : -parseFloat(row[CSV_FIELDS.EXPENSE_AMOUNT]);
  let name = row[CSV_FIELDS.NAME];
  let category = 'Не определено';
  const transferMatch = name.match(NAME_TRANSFER_REGEXP);
  if (transferMatch) {
    category = 'Переводы на карту';
    name = `Перевод в ${transferMatch[1].trim()}`;
  }
  return {
    date: dateObj.toDate(),
    dateKey: dateObj.format('YYYY-MM'),
    amount,
    currency: row[CSV_FIELDS.CURRENCY] === 'RUR' ? 'RUB' : row[CSV_FIELDS.CURRENCY],
    category,
    name,
  };
}

function getData(rawData: string[][]): Transaction[] {
  return rawData.map(mapCsvRow);
}

async function loadCsv(filePath: string) {
  const csvFile = await fsExtra.readFile(filePath);
  const csvString = iconv.decode(csvFile, 'win1251');
  const csv = await parseCsv(csvString, { delimiter: ';' });
  return csv;
}

export async function getDataFromCsvFile(filePath: string): Promise<Transaction[]> {
  const csv = await loadCsv(filePath);
  return getData(csv);
}

export class AlfabankCsvDataProvider implements DataProvider {
  static async checkFile(filePath: string): Promise<boolean> {
    const csv = await loadCsv(filePath);
    return csv[0][0] === 'Тип счёта';
  }

  async getDataFromFile(filePath: string): Promise<Transaction[]> {
    const csv = await loadCsv(filePath);
    return getData(csv.slice(1));
  }
}
