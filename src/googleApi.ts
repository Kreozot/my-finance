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

export const exportData = async () => {
  const sheets = await authenticateSheets();
  console.log(1);
  const spreadsheet = await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: 'Лист1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [
          'test'
        ]
      ]
    }
  });

  console.log(2);
}
