export type Transaction = {
  hash?: string,
  /** Дата и время */
  date: Date,
  /** Ключ даты для группировки данных (год-месяц) */
  dateKey: string,
  /** Сумма */
  amount: number,
  /** Название */
  name: string,
  /** Категория */
  category: string,
  /** Код валюты */
  currency: string,
  /** Банк, где выполнена операция */
  bank: Bank,
};

export type TransactionsSum = {
  /** Сумма */
  sum: number,
  /** Код валюты */
  currency: string,
};

export interface DataProvider {
  getDataFromFile: (filePath: string) => Promise<Transaction[]>;
}

export type GroupedTransactions = {
  [dateKey: string]: {
    [category: string]: {
      [name: string]: number,
    },
  },
};

export type DateSumMap = {
  [dateKey: string]: number,
};

export type TableTransaction = {
  category: string,
  name: string,
  transactions: DateSumMap,
};

export enum Bank {
  Tinkoff = 'tinkoff',
  Sberbank = 'sberbank',
  Alfabank = 'alfabank',
}
