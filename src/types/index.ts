export interface Product {
  id?: string;
  nama_barang: string;
  stok_jogja: number;
  stok_lombok: number;
  total_stok: number;
  harga: number;
}

export interface InvoiceItem {
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
