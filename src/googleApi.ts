import { google } from 'googleapis';
import dotEnv from 'dotenv';
import path from 'path';

dotEnv.config();

const { GOOGLE_SHEET_ID } = process.env;
const DATA_START_ROW_INDEX = 1;

type GroupColumn = {
  name: string,
  startRowIndex: number,
  endRowIndex: number,
};
type GroupColumns = {
  [name: string]: GroupColumn,
};

type CategoryColumn = {
  groupName: string,
  name: string,
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
      && merge.endRowIndex >= rowIndex;
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
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Лист1',
      majorDimension: 'COLUMNS',
    });

    const res2 = await this.sheets.spreadsheets.get({
      ranges: ['Лист1'],
      spreadsheetId: GOOGLE_SHEET_ID,
      includeGridData: true,
    });
    const sheet = res2.data.sheets[0];
    const merges = sheet.merges;
    const rowData = sheet.data[0].rowData;
    console.log(JSON.stringify(merges, null, 2));
    console.log(JSON.stringify(rowData, null, 2));

    let groupColumns: GroupColumns;
    let categoryColumns: CategoryColumns;
    rowData.forEach((row, rowIndex) => {
      if (rowIndex < DATA_START_ROW_INDEX) {
        return;
      }
      const groupName = row.values[0].formattedValue;
      if (groupName) {
        const merge = findRowMerge(merges as Merge[], rowIndex);
        groupColumns[groupName] = {
          name: groupName,
          startRowIndex: merge ? merge.startRowIndex : rowIndex,
          endRowIndex: merge ? merge.endRowIndex : rowIndex,
        };
      }
    });

    return res.data.values[0];
  }
}



export const exportData = async () => {
  const googleSheet = new GoogleSheet();
  await googleSheet.authenticate();
  const categoryColumns =  await googleSheet.getCategoryColumns();

  console.log(categoryColumns);
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
