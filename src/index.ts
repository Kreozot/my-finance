import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import ofx from 'ofx';
import fsExtra from 'fs-extra';
import path from 'path';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const loadFile = async (filePath: string) => {
  const file = await fsExtra.readFile(filePath);
  return String(file);
};

const parseOfx = async (ofxString: string) => {
  return ofx.parse(ofxString);
};

const loadOfx = async (filePath: string) => {
  const ofxFile = await loadFile(filePath);
  const ofx = await parseOfx(ofxFile);
  return ofx;
};

const chooseFile = async () => {
  const { filePath } = await inquirer
    .prompt([
      {
        type: 'fuzzypath',
        name: 'filePath',
        message: 'Select OFX file',
        itemType: 'file',
        excludeFilter: (nodePath: string) => !/\.ofx$/.test(nodePath),
      },
    ]) as any;
  console.log(`Выбранный файл: ${filePath}`);
  return path.join(filePath);
};

const parseDateTime = (dateTimeStr: string) => {
  return dateTimeStr;
};

const parseAmount = (amountStr: string) => {
  return parseInt(amountStr, 10);
};

const processOfx = (ofx: any) => {
  const BANKTRANLIST = ofx.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST;
  const startDate = parseDateTime(BANKTRANLIST.DTSTART);
  const endDate = parseDateTime(BANKTRANLIST.DTEND);
  const transactions = BANKTRANLIST.STMTTRN.map((STMTTRN: any) => {
    return {
      date: parseDateTime(STMTTRN.DTPOSTED),
      amount: parseAmount(STMTTRN.TRNAMT),
      name: STMTTRN.NAME,
      category: STMTTRN.MEMO,
      currency: STMTTRN.CURRENCY.CURSYM,
    };
  });
  return transactions;
};

const start = async () => {
  const filePath = await chooseFile();
  const ofx = await loadOfx(filePath);
  const transactions = processOfx(ofx);
  await fsExtra.ensureDir('out');
  await fsExtra.writeFile('out/transactions.json', JSON.stringify(transactions, null, 2));
};

start();
