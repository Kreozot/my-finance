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
const NAME_BASE_REGEXP = /(.+)Основание [0-9A-Z]+\s/;
const NAME_PERCENT_REGEXP = /(Выплата % на ср\.остаток) /;
const NAME_TRANSFER_SBP_REGEXP = /Перевод [0-9A-Z]+ через Систему быстрых платежей (\S+\s\+?[0-9]+)/;

function mapCsvRow(row: string[]): Transaction {
  const dateObj = dayjs(row[CSV_FIELDS.DATE], 'DD.MM.YY');
  const amount = parseFloat(row[CSV_FIELDS.INCOME_AMOUNT])
    ? parseFloat(row[CSV_FIELDS.INCOME_AMOUNT].replace(/,/g, '.'))
    : -parseFloat(row[CSV_FIELDS.EXPENSE_AMOUNT].replace(/,/g, '.'));
  let name = row[CSV_FIELDS.NAME];
  let category = 'Не определено';
  let match;
  /* eslint-disable no-cond-assign */
  if (match = name.match(NAME_TRANSFER_REGEXP)) {
    category = 'Переводы';
    name = `Перевод в ${match[1].trim()}`;
  } else if (match = name.match(NAME_BASE_REGEXP)) {
    category = 'Заработная плата';
    name = match[1].trim();
  } else if (match = name.match(NAME_PERCENT_REGEXP)) {
    category = 'Прочее';
    name = match[1].trim();
  } else if (name === 'Перевод денежных средств') {
    category = 'Переводы';
  } else if (match = name.match(NAME_TRANSFER_SBP_REGEXP)) {
    category = 'Переводы';
    name = `Перевод через СБП ${match[1].trim()}`;
  }
  /* eslint-enable no-cond-assign */
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
