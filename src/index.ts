import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import fsExtra from 'fs-extra';
import path from 'path';
import {
  groupBy, mapValues, values, flatten,
  uniqWith, isEqual, find,
} from 'lodash';

import {
  DataProvider, DateSumMap, TableTransaction, Transaction,
} from './types';
import { TinkoffCsvDataProvider } from './providers/tinkoffCsv';
import { TinkoffOfxDataProvider } from './providers/tinkoffOfx';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const OUT_CURRENCY = 'RUB';

const chooseFile = async () => {
  const { filePath } = await inquirer
    .prompt([
      {
        type: 'fuzzypath',
        name: 'filePath',
        message: 'Выберите OFX или CSV файл',
        itemType: 'file',
        rootPath: 'data/',
        excludeFilter: (nodePath: string) => !/\.(ofx|csv)$/.test(nodePath),
      },
    ]) as any;
  return path.join(filePath);
};

const convertMoney = (amount: number, currency: string): number => {
  if (currency !== OUT_CURRENCY) {
    console.warn(`Отличающаяся валюта ${currency}`);
  }
  // TODO: Конвертация валюты
  return amount;
};

// TODO: Группировать по категории и имени в один проход
const getTableTransactions = (originalTransactions: Transaction[]): TableTransaction[] => {
  const categoryGroups = groupBy(originalTransactions, 'category');
  const categoryNameGroups = mapValues(categoryGroups, (categoryGroup, category): TableTransaction[] => {
    const nameGroups = groupBy(categoryGroup, 'name');
    const nameDateGroups = mapValues(nameGroups, (nameGroup, name): TableTransaction => {
      const dateGroups = groupBy(nameGroup, 'dateKey');
      const transactionsSummary: DateSumMap = mapValues(dateGroups, (transactions): number => {
        const sum = transactions.reduce((result, transaction) => {
          return result + convertMoney(transaction.amount, transaction.currency);
        }, 0);
        return Math.round(sum);
      });
      return {
        category,
        name,
        transactions: transactionsSummary,
      };
    });
    return values(nameDateGroups);
  });

  return flatten(values(categoryNameGroups));
};

const getDataProvider = (filePath: string): DataProvider => {
  switch (path.extname(filePath)) {
    case '.ofx':
      return new TinkoffOfxDataProvider();
    case '.csv':
      return new TinkoffCsvDataProvider();
    default:
      throw new Error('Поддерживаются только OFX или CSV файлы');
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
        && transaction1.category === transaction2.category
        && transaction1.currency === transaction2.currency;
      // Если нашли транзакцию отката
      if (isRevert) {
        // Проверяем не была ли она уже найдена для какой-нибудь из предыдущих транзакций
        const isAlreadyFound = Boolean(find(
          revertedPairs,
          (reverted) => isEqual(transaction2, reverted),
        ));
        // Если нет, то запоминаем индекс этой транзакции
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

const start = async () => {
  const filePath = await chooseFile();
  const dataProvider = getDataProvider(filePath);
  const allTransactions = await dataProvider.getDataFromFile(filePath);
  const { transactions, duplicates } = filterRevertTransactions(allTransactions);
  const tableIncome = getTableTransactions(transactions.filter((transaction) => transaction.amount > 0));
  const tableExpenses = getTableTransactions(transactions.filter((transaction) => transaction.amount < 0));

  await fsExtra.ensureDir('out');
  await fsExtra.writeFile('out/duplicates.json', JSON.stringify(duplicates, null, 2));
  await fsExtra.writeFile('out/transactions.json', JSON.stringify(transactions, null, 2));
  await fsExtra.writeFile('out/tableIncome.json', JSON.stringify(tableIncome, null, 2));
  await fsExtra.writeFile('out/tableExpenses.json', JSON.stringify(tableExpenses, null, 2));
};

start();
// exportData({});
