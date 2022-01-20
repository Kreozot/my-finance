import inquirer from 'inquirer';
import inquirerFuzzyPath from 'inquirer-fuzzy-path';
import ofx from 'ofx';
import fsExtra from 'fs-extra';
import path from 'path';
import { groupBy } from 'lodash';
import { Transaction } from './types';

inquirer.registerPrompt('fuzzypath', inquirerFuzzyPath);

const chooseFile = async () => {
  const { filePath } = await inquirer
    .prompt([
      {
        type: 'fuzzypath',
        name: 'filePath',
        message: 'Select OFX file',
        itemType: 'file',
        excludeFilter: (nodePath: string) => !/\.(ofx|csv)$/.test(nodePath),
      },
    ]) as any;
  console.log(`Выбранный файл: ${filePath}`);
  return path.join(filePath);
};

const groupTransactions = (transactions: Transaction[]) => {
  const nameGroups = groupBy(transactions, 'name');
  const categoryGroups = groupBy(transactions, 'category');
  return categoryGroups;
};

const start = async () => {
  const filePath = await chooseFile();
  const transactions =

  const groups = groupTransactions(transactions);
  await fsExtra.ensureDir('out');
  await fsExtra.writeFile('out/transactions.json', JSON.stringify(transactions, null, 2));
};

start();
