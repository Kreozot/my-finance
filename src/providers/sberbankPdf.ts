import parsePdf from 'pdf-parse';
import fsExtra from 'fs-extra';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Transaction, DataProvider, Bank } from '../types';

dayjs.extend(customParseFormat);

// eslint-disable-next-line no-irregular-whitespace -- Есть странный пробел в сумме в выгрузке
const PDF_TEXT_ITEM_REGEXP = /([0-9]{2}.[0-9]{2}.[0-9]{4})([0-9]{2}:[0-9]{2})\n[0-9]{2}.[0-9]{2}.[0-9]+-?\n(.+)\n(.+\n)?(.+\n)?(\+?[0-9\s ]+,[0-9]+)\n(\+?[0-9\s ]+,[0-9]+\s\$)?\n/gm;

function mapMatch(match: string[]): Transaction {
  const dateObj = dayjs(`${match[1]} ${match[2]}`, 'DD.MM.YYYY HH:mm');
  const nameStr = `${match[4].trim()} ${(match[5] || '').trim()}`.trim();
  const amountMultiplier = match[6][0] === '+' ? 1 : -1;
  // eslint-disable-next-line no-irregular-whitespace -- Тот самый странный пробел
  const amountStr = match[6].replace(/[  +]/g, '').replace(/,/g, '.');
  return {
    date: dateObj.toDate(),
    dateKey: dateObj.format('YYYY-MM'),
    amount: parseFloat(amountStr) * amountMultiplier,
    currency: 'RUB',
    category: match[3],
    name: nameStr,
    bank: Bank.Sberbank,
  };
}

function getData(rawData: parsePdf.Result): Transaction[] {
  const text = rawData.text.replace(/\n\n\nСтраница/gm, '\nСтраница');
  const matches = [...text.matchAll(PDF_TEXT_ITEM_REGEXP)];
  return matches.map(mapMatch);
}

async function loadPdf(filePath: string) {
  const pdfFile = await fsExtra.readFile(filePath);
  const pdf = await parsePdf(pdfFile);
  fsExtra.writeFile(`${filePath}.txt`, pdf.text);
  return pdf;
}

export class SberbankPdfDataProvider implements DataProvider {
  async getDataFromFile(filePath: string): Promise<Transaction[]> {
    const pdf = await loadPdf(filePath);
    return getData(pdf);
  }
}
