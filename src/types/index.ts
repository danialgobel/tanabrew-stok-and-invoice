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
  
  items: InvoiceItem[];
  total: number;
  jumlah_dibayar: number;
  sisa: number;
  status: string;
}
