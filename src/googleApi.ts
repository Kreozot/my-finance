import { google } from 'googleapis';
import dotEnv from 'dotenv';
import path from 'path';
import a1 from '@flighter/a1-notation';

import { GroupedTransactions } from './types';
import dayjs from 'dayjs';
import { serialToDateUTC } from './dateTime';

dotEnv.config();

const { GOOGLE_SHEET_ID } = process.env;
const DATA_START_ROW_INDEX = 1;
const GROUP_COLUMN_INDEX = 0;
const CATEGORY_COLUMN_INDEX = 1;
const DATE_START_COLUMN_INDEX = 2;
const DATE_ROW_INDEX = 0;
const LIST_NAME = 'Лист1';

type GroupRow = {
  // name: string,
  startRowIndex: number,
  endRowIndex: number,
};
type GroupRows = {
  [name: string]: GroupRow,
};

type CategoryRow = {
  // name: string,
  rowIndex: number,
};
type CategoryColumns = {
  [name: string]: CategoryRow,
};

type CategoryStructure = {
  [groupName: string]: GroupRow & {
    categories: CategoryColumns,
  },
};

type DateColumns = {
  [dateKey: string]: {
    columnIndex: number,
  },
};

type Merge = {
  startRowIndex: number,
  endRowIndex: number,
  startColumnIndex: number,
  endColumnIndex: number,
}

const authenticateSheets = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../google.secret.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();

  return google.sheets({
    version: 'v4',
    auth: authClient
  });
}

const findRowMerge = (merges: Merge[], rowIndex: number) => {
  return merges.find((merge) => {
    return merge.startRowIndex <= rowIndex
    // Google указывает endRowIndex как индекс следующей за объединением строки
      && merge.endRowIndex > rowIndex;
  });
};

const getRangeNotation = (
  rowStartIndex: number, colStartIndex: number,
  rowEndIndex?: number, colEndIndex?: number
): string => {
  if (typeof rowStartIndex === 'undefined' || typeof colStartIndex === 'undefined') {
    throw new Error('Не задано начало диапазона');
  }
  if (typeof rowEndIndex === 'undefined' && typeof colEndIndex === 'undefined') {
    throw new Error('Должна быть задана хотя бы одна координата конца диапазона');
  }

  const colStartName = a1.toCol(colStartIndex + 1);
  if (typeof colEndIndex === 'undefined') {
    return `'${LIST_NAME}'!${colStartName}${rowStartIndex + 1}:${rowEndIndex + 1}`;
  }
  if (typeof rowEndIndex === 'undefined') {
    const colEndName = a1.toCol(colEndIndex + 1);
    return `'${LIST_NAME}'!${colStartName}${rowStartIndex + 1}:${colEndName}`;
  }
  const colEndName = a1.toCol(colEndIndex + 1);
  return `'${LIST_NAME}'!${colStartName}${rowStartIndex + 1}:${colEndName}${rowEndIndex + 1}`;
}

class GoogleSheet {
  sheets: Awaited<ReturnType<typeof authenticateSheets>>;
  spreadsheetId: string;

  constructor(spreadsheetId = GOOGLE_SHEET_ID) {
    this.spreadsheetId = spreadsheetId;
  }

  async authenticate() {
    this.sheets = await authenticateSheets();
  }

  async getDateColumns(): Promise<DateColumns> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: getRangeNotation(DATE_ROW_INDEX, DATE_START_COLUMN_INDEX, DATE_ROW_INDEX),
      majorDimension: 'ROWS',
      valueRenderOption: 'FORMULA',
    });
    const dates = res.data.values[0].map(serialToDateUTC);
    return dates.reduce((result, date, index) => {
      const dateKey = dayjs(date).format('YYYY-MM');
      result[dateKey] = {
        columnIndex: DATE_START_COLUMN_INDEX + index,
      };
      return result;
    }, {} as DateColumns);
  }

  async getCategoryStructure(): Promise<CategoryStructure> {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      ranges: [LIST_NAME],
      // TODO: Исправить работу с индексами строк при использовании диапазона
      // ranges: [getRangeNotation(DATA_START_ROW_INDEX, GROUP_COLUMN_INDEX, undefined, CATEGORY_COLUMN_INDEX)],
      includeGridData: true,
    });
    const sheet = res.data.sheets[0];
    const merges = sheet.merges;
    const rowData = sheet.data[0].rowData;

    const { categoryStructure } = rowData.reduce(
      (result, row, rowIndex) => {
        if (rowIndex < DATA_START_ROW_INDEX) {
          return result;
        }

        const groupName = row.values[GROUP_COLUMN_INDEX].formattedValue;
        const categoryName = row.values[CATEGORY_COLUMN_INDEX].formattedValue;
        // Если есть значение ячейки в колонке группы, значит это начало группы
        if (typeof groupName !== 'undefined') {
          result.lastGroupName = groupName;
          const merge = findRowMerge(merges as Merge[], rowIndex);
          result.categoryStructure[groupName] = {
            startRowIndex: merge ? merge.startRowIndex : rowIndex,
            // -1 Потому что Google почему-то указывает endRowIndex от следующей строки
            endRowIndex: merge ? merge.endRowIndex - 1 : rowIndex,
            categories: {
              [categoryName]: {
                rowIndex,
              },
            },
          };
        // Иначе это продолжение предыдущей группы
        } else {
          const lastGroup = result.categoryStructure[result.lastGroupName];
          if (lastGroup.startRowIndex <= rowIndex
            && lastGroup.endRowIndex >= rowIndex) {
            lastGroup.categories[categoryName] = {
              rowIndex,
            };
          } else {
            throw new Error(`Неправильная работа с объединениями ячеек в группе категорий для строки ${rowIndex} (категория ${categoryName}, группа ${result.lastGroupName} с диапазоном ${lastGroup.startRowIndex} - ${lastGroup.endRowIndex})`);
          }
        }
        return result;
      },
      {
        categoryStructure: {},
        lastGroupName: '',
      } as {
        /** Структура категорий */
        categoryStructure: CategoryStructure,
        /** Название последней группы для передачи между итерациями */
        lastGroupName: string
      }
    );

    return categoryStructure;
  }
}



export const exportData = async (transactions: GroupedTransactions) => {
  const googleSheet = new GoogleSheet();
  await googleSheet.authenticate();
  const categoryStructure =  await googleSheet.getCategoryStructure();
  const dateColumns = await googleSheet.getDateColumns();
  console.log(categoryStructure);
  console.log(dateColumns);
  // console.log(JSON.stringify(categoryStructure, null, 2));
  // const sheets = await authenticateSheets();
  // console.log(1);
  // const range = await sheets.spreadsheets.values.get({

  // })
  // const spreadsheet = await sheets.spreadsheets.values.update({
  //   spreadsheetId: GOOGLE_SHEET_ID,
  //   range: LIST_NAME,
  //   valueInputOption: 'USER_ENTERED',
  //   requestBody: {
  //     values: [
  //       [
  //         'test'
  //       ]
  //     ]
  //   }
  // });
}
