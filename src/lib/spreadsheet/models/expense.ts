export interface ExpenseRecord {
  expenseId: string;
  tanggalExpense: string;
  itemProduk: string;
  kategori: string;
  nominal: number;
  catatan: string;
  timestamp: string;
  tangal?: string;
}

export interface ExpenseSummary {
  totalToday: number;
  totalMonth: number;
  transactionCount: number;
  averageExpense: number;
}

export type ExpenseFilter = "hari_ini" | "7_hari" | "30_hari" | "semua";

export interface SpreadsheetExpenseResponse {
  success: boolean;
  records: ExpenseRecord[];
  message?: string;
}
