declare module 'ofx';

type OfxTransaction = {
  DTPOSTED: string,
  TRNAMT: string,
  NAME: string,
  MEMO: string,
  CURRENCY: {
    CURSYM: string,
  },
};

type OfxBankTransactionsList = {
  STMTTRN: OfxTransaction[],
  DTSTART: string,
  DTEND: string,
};

type Ofx = {
  OFX: {
    BANKMSGSRSV1: {
      STMTTRNRS: {
        STMTRS: {
          BANKTRANLIST: OfxBankTransactionsList,
        }
      }
    }
  }
};
