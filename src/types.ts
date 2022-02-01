export type Transaction = {
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
};

export type TransactionsSum = {
  /** Сумма */
  sum: number,
  /** Код валюты */
  currency: string,
}

export interface DataProvider {
  getDataFromFile: (filePath: string) => Promise<Transaction[]>;
};

export type GroupedTransactions = {
  [dateKey: string]: {
      [groupName: string]: {
          [categoryName: string]: number;
      };
  };
};
