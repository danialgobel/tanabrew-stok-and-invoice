export interface IncomeRecord {
  invoiceNumber: string;
  tanggalInvoice: string;
  jamInvoice: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdBy: string;
  role: string;
  timestamp: string;
  produkJasa?: string;
  catatan?: string;
}

export interface IncomeSummary {
  totalToday: number;
  totalMonth: number;
  invoiceCount: number;
  averageValue: number;
}

export type IncomeFilter = "hari_ini" | "7_hari" | "30_hari" | "semua";

export interface SpreadsheetIncomeResponse {
  success: boolean;
  records: IncomeRecord[];
  message?: string;
}
