import { google } from 'googleapis';
import dotEnv from 'dotenv';
import path from 'path';

dotEnv.config();

const { GOOGLE_SHEET_ID } = process.env;
const DATA_START_ROW_INDEX = 1;
const GROUP_COLUMN_INDEX = 0;
const CATEGORY_COLUMN_INDEX = 1;

type GroupColumn = {
  // name: string,
  startRowIndex: number,
  endRowIndex: number,
};
type GroupColumns = {
  [name: string]: GroupColumn,
};

type CategoryColumn = {
  // name: string,
  rowIndex: number,
};
type CategoryColumns = {
  [name: string]: CategoryColumn,
};

type CategoryStructure = {
  [groupName: string]: GroupColumn & {
    categories: CategoryColumns,
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

class GoogleSheet {
  sheets: Awaited<ReturnType<typeof authenticateSheets>>;
  spreadsheetId: string;

  constructor(spreadsheetId = GOOGLE_SHEET_ID) {
    this.spreadsheetId = spreadsheetId;
  }

  async authenticate() {
    this.sheets = await authenticateSheets();
  }

  async getCategoryColumns() {
    const res = await this.sheets.spreadsheets.get({
      ranges: ['Лист1'],
      spreadsheetId: GOOGLE_SHEET_ID,
      includeGridData: true,
    });
    const sheet = res.data.sheets[0];
    const merges = sheet.merges;
    const rowData = sheet.data[0].rowData;
    console.log(JSON.stringify(merges, null, 2));
    console.log(JSON.stringify(rowData, null, 2));

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
            throw new Error(`Неправильный работа с объединениями ячеек в группе категорий для строки ${rowIndex} (категория ${categoryName}, группа ${result.lastGroupName} с диапазоном ${lastGroup.startRowIndex} - ${lastGroup.endRowIndex})`);
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



export const exportData = async () => {
  const googleSheet = new GoogleSheet();
  await googleSheet.authenticate();
  const categoryColumns =  await googleSheet.getCategoryColumns();

  console.log(JSON.stringify(categoryColumns, null, 2));
  // const sheets = await authenticateSheets();
  // console.log(1);
  // const range = await sheets.spreadsheets.values.get({

  // })
  // const spreadsheet = await sheets.spreadsheets.values.update({
  //   spreadsheetId: GOOGLE_SHEET_ID,
  //   range: 'Лист1',
  //   valueInputOption: 'USER_ENTERED',
  //   requestBody: {
  //     values: [
  //       [
  //         'test'
  //       ]
  //     ]
  //   }
  // });

  console.log(2);
}
