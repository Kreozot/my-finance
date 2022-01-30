import { google } from 'googleapis';
import dotEnv from 'dotenv';
import path from 'path';

dotEnv.config();

const { GOOGLE_SHEET_ID } = process.env;

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
    console.log(res.data);
  }
}



export const exportData = async () => {
  const googleSheet = new GoogleSheet();
  await googleSheet.authenticate();
  await googleSheet.getCategoryColumns();
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
