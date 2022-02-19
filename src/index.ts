import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import fsExtra from 'fs-extra';
import path from 'path';
import {
  isEqual, find, unionBy,
} from 'lodash';
import getHash from 'object-hash';

import {
  DataProvider, Transaction,
} from './types';
import { TinkoffCsvDataProvider } from './providers/tinkoffCsv';
import { TinkoffOfxDataProvider } from './providers/tinkoffOfx';
import { SberbankPdfDataProvider } from './providers/sberbankPdf';
import { AlfabankCsvDataProvider } from './providers/alfabankCsv';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const FILE_NAME_REGEXP = /\.(ofx|csv|pdf)$/;

const chooseFile = async () => {
  const { filePath } = await inquirer
    .prompt([
      {
        type: 'fuzzypath',
        name: 'filePath',
        message: 'Выберите OFX, PDF или CSV файл',
        itemType: 'file',
        rootPath: 'data/',
        excludeFilter: (nodePath: string) => !FILE_NAME_REGEXP.test(nodePath),
      },
    ]) as any;
  return path.join(filePath);
};

const getDataProvider = async (filePath: string): Promise<DataProvider> => {
  switch (path.extname(filePath)) {
    case '.ofx':
      console.log('Tinkoff OFX');
      return new TinkoffOfxDataProvider();
    case '.csv':
      if (await TinkoffCsvDataProvider.checkFile(filePath)) {
        console.log('Tinkoff CSV');
        return new TinkoffCsvDataProvider();
      }
      if (await AlfabankCsvDataProvider.checkFile(filePath)) {
        console.log('Alfabank OFX');
        return new AlfabankCsvDataProvider();
      }
      throw new Error('Неизвестный формат CSV-файла');
    case '.pdf':
      console.log('Sberbank PDF');
      return new SberbankPdfDataProvider();
    default:
      throw new Error('Поддерживаются только OFX, PDF или CSV файлы');
  }
};

const filterRevertTransactions = (transactions: Transaction[]) => {
  const revertedPairs: Transaction[] = [];
  // Проходим по массиву транзакций
  transactions.forEach((transaction1, index1) => {
    // Находим транзакцию отката для текущей среди тех, что идут после неё
    const revertTransaction = find(transactions, (transaction2) => {
      const isRevert = transaction1.amount === -transaction2.amount
        && transaction1.name === transaction2.name
        && transaction1.currency === transaction2.currency;
      // Если нашли транзакцию отката
      if (isRevert) {
        // Проверяем не была ли она уже найдена для какой-нибудь из предыдущих транзакций
        const isAlreadyFound = Boolean(find(
          revertedPairs,
          (reverted) => isEqual(transaction2, reverted),
        ));
        // Если нет, то возвращаем её
        return !isAlreadyFound;
      }
      return false;
    }, index1 + 1);
    // Если нашли транзакцию отката
    if (revertTransaction) {
      // Запоминаем обе транзакции
      revertedPairs.push(transaction1, revertTransaction);
    }
  });

  const filteredTransactions = transactions.filter((transaction) => {
    return !revertedPairs.some((duplicateTransaction) => {
      return isEqual(transaction, duplicateTransaction);
    });
  });

  console.log(`Отфильтровано ${revertedPairs.length} транзакций с возвратом`);
  return {
    transactions: filteredTransactions,
    duplicates: revertedPairs,
  };
};

const loadExistingTransactions = async (): Promise<Transaction[]> => {
  try {
    const file = await fsExtra.readFile('out/allTransactions.json');
    return JSON.parse(String(file)) as Transaction[];
  } catch (err) {
    console.warn(err);
  }
  return [];
};

const addHash = (transactions: Transaction[]): Transaction[] => {
  transactions.forEach((transaction) => {
    // eslint-disable-next-line no-param-reassign
    transaction.hash = getHash(transaction, { algorithm: 'sha1' });
  });
  return transactions;
};

const start = async () => {
  const filePath = await chooseFile();
  const dataProvider = await getDataProvider(filePath);
  console.log('Загрузка предыдущих данных');
  const existingTransactions = await loadExistingTransactions();
  console.log('Парсинг файла', filePath);
  const newTransactions = await dataProvider.getDataFromFile(filePath);
  addHash(newTransactions);
  console.log('Поиск и фильтрация возвращённых транзакций');
  const { transactions, duplicates } = filterRevertTransactions(newTransactions);
  console.log('Объединение данных');
  const allTransactions = unionBy(existingTransactions, transactions, 'hash');

  console.log('Сохранение данных');
  await fsExtra.ensureDir('out');
  await Promise.all([
    fsExtra.writeFile('out/duplicates.json', JSON.stringify(duplicates, null, 2)),
    fsExtra.writeFile('out/transactions.json', JSON.stringify(transactions, null, 2)),
    fsExtra.writeFile('out/allTransactions.json', JSON.stringify(allTransactions, null, 2)),
  ]);
};

start();
