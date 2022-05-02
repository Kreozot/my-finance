import parsePdf from 'pdf-parse';
import fsExtra from 'fs-extra';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Transaction, DataProvider, Bank } from '../types';

dayjs.extend(customParseFormat);

const INITIAL_AMOUNT_REGEXP = /Prethodno stanje: ([0-9,]+)/;
const RECORD_START_REGEXP = /([0-9]{2}\.[0-9]{2}\.[0-9]{4}[0-9]{2}\.[0-9]{2}\.[0-9]{4})/gm;
const RECORD_REGEXP = /📓([0-9]{2}\.[0-9]{2}\.[0-9]{4})([0-9]{2}\.[0-9]{2}\.[0-9]{4})([0-9.]+,[0-9]{2})([0-9.]+,[0-9]{2})([^📓]+)/gmu;

function parseAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/\./g, '').replace(/,/g, '.'));
}

function getData(rawData: String): Transaction[] {
  const text = rawData.replace(RECORD_START_REGEXP, '📓$1');
  const matches = [...text.matchAll(RECORD_REGEXP)].reverse();
  // To compare with amount rest after current transaction (to differ income from outcome)
  let previousRestAmount = parseAmount(text.match(INITIAL_AMOUNT_REGEXP)[1]);

  function mapMatch(match: string[]): Transaction {
    const dateObj = dayjs(match[1], 'DD.MM.YYYY');
    const nameStr = match[5].replace(/\n/g, ' ').trim();
    const amount = parseAmount(match[3]);
    const restAmount = parseAmount(match[4]);
    const amountMultiplier = previousRestAmount > restAmount ? -1 : 1;
    previousRestAmount = restAmount;
    return {
      date: dateObj.toDate(),
      dateKey: dateObj.format('YYYY-MM'),
      amount: amount * amountMultiplier,
      currency: 'RSD',
      category: 'Не определено',
      name: nameStr,
      bank: Bank.Raiffeisen,
    };
  }

  return matches.map(mapMatch);
}

async function loadPdf(filePath: string) {
  const pdfFile = await fsExtra.readFile(filePath);
  const pdf = await parsePdf(pdfFile);
  fsExtra.writeFile(`${filePath}.txt`, pdf.text);
  return pdf.text;
}

export class RsRaiffeisenPdfProvider implements DataProvider {
  static async checkFile(filePath: string): Promise<boolean> {
    const pdf = await loadPdf(filePath);
    return INITIAL_AMOUNT_REGEXP.test(pdf);
  }

  async getDataFromFile(filePath: string): Promise<Transaction[]> {
    const pdf = await loadPdf(filePath);
    return getData(pdf);
  }
}
