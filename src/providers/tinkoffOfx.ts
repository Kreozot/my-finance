import ofxModule from 'ofx';
import fsExtra from 'fs-extra';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Transaction, DataProvider, Bank } from '../types';

dayjs.extend(customParseFormat);

const loadFile = async (filePath: string) => {
  const file = await fsExtra.readFile(filePath);
  return String(file);
};

const parseOfx = async (ofxString: string) => {
  return ofxModule.parse(ofxString) as Ofx;
};

const loadOfx = async (filePath: string) => {
  const ofxFile = await loadFile(filePath);
  const ofx = await parseOfx(ofxFile);
  return ofx;
};

const parseDateTime = (dateTimeStr: string) => {
  const modifiedDateTimeStr = dateTimeStr.replace(/\[([+-]?)([0-9]+):[A-Z]+\]$/, ' $1');
  return dayjs(modifiedDateTimeStr, 'YYYYMMDDHHmmss.SSS ZZ'); // "20220108131638.000[+3:MSK]"
};

const parseAmount = (amountStr: string) => {
  return parseInt(amountStr, 10);
};

const loadTransactions = (ofxTransactions: OfxTransaction[]): Transaction[] => {
  return ofxTransactions.map((STMTTRN) => {
    const dateObj = parseDateTime(STMTTRN.DTPOSTED);
    return {
      date: dateObj.toDate(),
      dateKey: dateObj.format('YYYY-MM'),
      amount: parseAmount(STMTTRN.TRNAMT),
      name: STMTTRN.NAME,
      category: STMTTRN.MEMO,
      currency: STMTTRN.CURRENCY.CURSYM,
      bank: Bank.Tinkoff,
    } as Transaction;
  });
};

const processOfx = (ofx: Ofx) => {
  const { BANKTRANLIST } = ofx.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
  const transactions = loadTransactions(BANKTRANLIST.STMTTRN);
  return transactions;
};

export class TinkoffOfxDataProvider implements DataProvider {
  async getDataFromFile(filePath: string): Promise<Transaction[]> {
    const ofx = await loadOfx(filePath);
    return processOfx(ofx);
  }
}
