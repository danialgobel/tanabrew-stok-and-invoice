export interface Product {
  id?: string;
  nama_barang: string;
  kategori?: string;
  stok_jogja: number;
  stok_lombok: number;
  total_stok: number;
  harga: number;
  harga_b2b?: number;
  dibuat_oleh?: string;
  dibuat_oleh_uid?: string;
  dibuat_oleh_role?: string;
  diedit_oleh?: string;
  diedit_oleh_uid?: string;
  diedit_oleh_role?: string;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface InvoiceItem {
  product_id?: string;
  nama_barang: string;
  harga: number;
  jumlah: number;
  subtotal: number;
}

export interface Invoice {
  id?: string;
  tanggal: string;
  no_invoice: string;
  customer: string;
  nomor_rekening?: string;
  stock_location?: "Jogja" | "Lombok";
  
  items: InvoiceItem[];
  subtotal?: number;
  diskon?: number;
  total: number;
  jumlah_dibayar: number;
  sisa: number;
  status: string;
  dibuat_oleh?: string;
  dibuat_oleh_uid?: string;
  dibuat_oleh_role?: string;
  created_at?: unknown;
  is_printed?: boolean;
  printed_at?: unknown;
  printed_by?: string;
  printed_by_uid?: string;
  printed_by_role?: string;
  print_count?: number;
  paid_at?: unknown;
  paid_by?: string;
  paid_by_uid?: string;
  paid_by_role?: string;
  updated_at?: unknown;
}

export interface ActivityLog {
  id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  description?: string;
  created_at?: unknown;
}

export interface StockMovement {
  id?: string;
  product_id?: string;
  product_name?: string;
  movement_type?: "STOCK_IN" | "STOCK_EDIT" | "STOCK_OUT_INVOICE" | "PRODUCT_CREATE" | "PRODUCT_DELETE" | "TRANSFER_STOCK";
  location?: "Jogja" | "Lombok" | "Semua" | "System";
  quantity_change?: number;
  stock_before?: number;
  stock_after?: number;
  source?: "manual" | "invoice" | "product_create" | "product_update" | "product_delete";
  reference_id?: string;
  reference_label?: string;
  description?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  created_at?: unknown;
}
