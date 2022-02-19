import fsExtra from 'fs-extra';
import path from 'path';
import {
  isEqual, find, unionBy,
} from 'lodash';
import getHash from 'object-hash';
import FileHound from 'filehound';

import {
  DataProvider, Transaction,
} from './types';
import { TinkoffCsvDataProvider } from './providers/tinkoffCsv';
import { SberbankPdfDataProvider } from './providers/sberbankPdf';
import { AlfabankCsvDataProvider } from './providers/alfabankCsv';

const getDataProvider = async (filePath: string): Promise<DataProvider> => {
  switch (path.extname(filePath)) {
    case '.csv':
      if (await TinkoffCsvDataProvider.checkFile(filePath)) {
        console.log('Tinkoff CSV');
        return new TinkoffCsvDataProvider();
      }
      if (await AlfabankCsvDataProvider.checkFile(filePath)) {
        console.log('Alfabank CSV');
        return new AlfabankCsvDataProvider();
      }
      throw new Error('Неизвестный формат CSV-файла');
    case '.pdf':
      console.log('Sberbank PDF');
      return new SberbankPdfDataProvider();
    default:
      throw new Error('Поддерживаются только PDF или CSV файлы');
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
    if (err.code !== 'ENOENT') {
      console.warn(err);
    }
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

const getFilesList = async (): Promise<string[]> => {
  const files: string[] = await FileHound.create()
    .paths('data/')
    .ext(['csv', 'pdf'])
    .find();
  return files;
};

const getTransactionsFromFile = async (filePath: string): Promise<Transaction[]> => {
  const dataProvider = await getDataProvider(filePath);
  console.log('Парсинг файла', filePath);
  const newTransactions = await dataProvider.getDataFromFile(filePath);
  addHash(newTransactions);
  console.log('Поиск и фильтрация возвращённых транзакций');
  const { transactions, duplicates } = filterRevertTransactions(newTransactions);

  console.log('Сохранение данных');
  const name = path.basename(filePath);
  await fsExtra.ensureDir('out');
  if (duplicates.length) {
    await fsExtra.writeFile(`out/duplicates-${name}.json`, JSON.stringify(duplicates, null, 2));
  }
  await fsExtra.writeFile(`out/transactions-${name}.json`, JSON.stringify(transactions, null, 2));
  return transactions;
};

const start = async () => {
  const files = await getFilesList();
  console.log(files);
  const transactionArrays = await Promise.all(files.map((filePath) => getTransactionsFromFile(filePath)));
  console.log('Загрузка предыдущих данных');
  let allTransactions = await loadExistingTransactions();
  console.log('Объединение данных');
  transactionArrays.forEach((transactions) => {
    allTransactions = unionBy(allTransactions, transactions, 'hash');
  });
  await fsExtra.writeFile('out/allTransactions.json', JSON.stringify(allTransactions, null, 2));
};

start();
