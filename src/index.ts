import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import fsExtra from 'fs-extra';
import path from 'path';
import { groupBy, mapValues, values, flatten } from 'lodash';
import {
  DataProvider, DateSumMap, GroupedTransactions, TableTransaction, Transaction, TransactionsSum,
} from './types';
import { TinkoffCsvDataProvider } from './providers/tinkoffCsv';
import { TinkoffOfxDataProvider } from './providers/tinkoffOfx';
import { exportData } from './googleApi';

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
    console.warn(`Отличающаяся валюта ${currency}`)
  }
  // TODO: Конвертация валюты
  return amount;
}

const groupTransactions = (transactions: Transaction[]): GroupedTransactions => {
  const dateGroups = groupBy(transactions, 'dateKey');
  const dateCategoryGroups = mapValues(dateGroups, (dateGroup) => {
    const categoryGroups = groupBy(dateGroup, 'category');
    const categoryNameGroups = mapValues(categoryGroups, (categoryGroup) => {
      const tempGroups = groupBy(categoryGroup, 'name');
      return mapValues(tempGroups, (transactions) => {
        const sum = transactions.reduce((result, transaction) => {
          return result + convertMoney(transaction.amount, transaction.currency);
        }, 0);
        return Math.round(sum);
      });
    });
    return categoryNameGroups;
  });

  return dateCategoryGroups;
};

const getTableTransactions = (transactions: Transaction[]): TableTransaction[] => {
  const categoryGroups = groupBy(transactions, 'category');
  const categoryNameGroups = mapValues(categoryGroups, (categoryGroup, category): TableTransaction[] => {
    const nameGroups = groupBy(categoryGroup, 'name');
    const categoryNameGroups = mapValues(nameGroups, (nameGroup, name): TableTransaction => {
      const dateGroups = groupBy(nameGroup, 'dateKey');
      const transactions: DateSumMap = mapValues(dateGroups, (transactions): number => {
        const sum = transactions.reduce((result, transaction) => {
          return result + convertMoney(transaction.amount, transaction.currency);
        }, 0);
        return Math.round(sum);
      });
      return {
        category,
        name,
        transactions,
      };
    });
    return values(categoryNameGroups);
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
}

const start = async () => {
  const filePath = await chooseFile();
  const dataProvider = getDataProvider(filePath);
  const transactions = await dataProvider.getDataFromFile(filePath);
  // const groups = groupTransactions(transactions);
  const tableIncome = getTableTransactions(transactions.filter((transaction) => transaction.amount > 0));
  const tableExpenses = getTableTransactions(transactions.filter((transaction) => transaction.amount < 0));

  // await exportData(groups);
  await fsExtra.ensureDir('out');
  await fsExtra.writeFile('out/transactions.json', JSON.stringify(transactions, null, 2));
  // await fsExtra.writeFile('out/groups.json', JSON.stringify(groups, null, 2));
  await fsExtra.writeFile('out/tableIncome.json', JSON.stringify(tableIncome, null, 2));
  await fsExtra.writeFile('out/tableExpenses.json', JSON.stringify(tableExpenses, null, 2));
};

start();
// exportData({});
