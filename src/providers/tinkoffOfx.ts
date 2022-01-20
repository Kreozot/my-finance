import ofx from 'ofx';
import fsExtra from 'fs-extra';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Transaction } from '../types';

dayjs.extend(customParseFormat);

const loadFile = async (filePath: string) => {
  const file = await fsExtra.readFile(filePath);
  return String(file);
};

const parseOfx = async (ofxString: string) => {
  return ofx.parse(ofxString) as Ofx;
};

const loadOfx = async (filePath: string) => {
  const ofxFile = await loadFile(filePath);
  const ofx = await parseOfx(ofxFile);
  return ofx;
};

const parseDateTime = (dateTimeStr: string) => {
  const modifiedDateTimeStr = dateTimeStr.replace(/\[([+-]?)([0-9]+):[A-Z]+\]$/, ' $1');
  return dayjs(modifiedDateTimeStr, 'YYYYMMDDHHmmss.SSS ZZ').toDate(); //"20220108131638.000[+3:MSK]"
};

const parseAmount = (amountStr: string) => {
  return parseInt(amountStr, 10);
};

const loadTransactions = (ofxTransactions: OfxTransaction[]) => {
  return ofxTransactions.map((STMTTRN) => {
    return {
      date: parseDateTime(STMTTRN.DTPOSTED),
      amount: parseAmount(STMTTRN.TRNAMT),
      name: STMTTRN.NAME,
      category: STMTTRN.MEMO,
      currency: STMTTRN.CURRENCY.CURSYM,
    } as Transaction;
  });
};

const processOfx = (ofx: Ofx) => {
  const { BANKTRANLIST } = ofx.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
  // const startDate = parseDateTime(BANKTRANLIST.DTSTART);
  // const endDate = parseDateTime(BANKTRANLIST.DTEND);
  const transactions = loadTransactions(BANKTRANLIST.STMTTRN);
  return transactions;
};

export const getDataFromOfxFile = async (filePath: string): Promise<Transaction[]> => {
  const ofx = await loadOfx(filePath);
  return processOfx(ofx);
}
