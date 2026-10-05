import type { Product, Invoice, InvoiceItem } from "@/types";

export type ProductDivision = "Roastery" | "Warehouse";

export const ROASTERY_CATEGORIES = [
  "Kopi Biji (Beans)",
  "Kopi Bubuk / Drip",
] as const;

export const WAREHOUSE_CATEGORIES = [
  "Sirup & Bahan",
  "Alat & Kemasan",
  "Lainnya",
] as const;

/**
 * Memeriksa apakah sebuah kategori termasuk kategori Roastery bawaan
 */
export const isRoasteryCategory = (category?: string): boolean => {
  if (!category) return false;
  const catLower = category.toLowerCase().trim();
  return (
    catLower.includes("kopi biji") ||
    catLower.includes("beans") ||
    catLower.includes("bubuk") ||
    catLower.includes("drip") ||
    catLower.includes("roast") ||
    catLower.includes("espresso")
  );
};

/**
 * Menentukan divisi sebuah produk secara cerdas:
 * 1. Jika field `divisi` sudah diisi ("Roastery" / "Warehouse"), gunakan langsung.
 * 2. Jika belum (backward-compatibility untuk produk lama), deteksi dari kategori atau nama barang.
 */
export const getProductDivision = (product: {
  divisi?: ProductDivision;
  kategori?: string;
  nama_barang?: string;
}): ProductDivision => {
  if (product.divisi === "Roastery" || product.divisi === "Warehouse") {
    return product.divisi;
  }

  if (isRoasteryCategory(product.kategori)) {
    return "Roastery";
  }

  // Cek kata kunci pada nama barang jika kategori "Lainnya" atau belum diset
  const nameLower = (product.nama_barang || "").toLowerCase();
  if (
    nameLower.includes("beans") ||
    nameLower.includes("kopi") ||
    nameLower.includes("coffee") ||
    nameLower.includes("roast") ||
    nameLower.includes("arabica") ||
    nameLower.includes("robusta") ||
    nameLower.includes("espresso") ||
    nameLower.includes("drip")
  ) {
    return "Roastery";
  }

  return "Warehouse";
};

/**
 * Menentukan divisi item dalam invoice berdasarkan database produk atau fallback nama barang
 */
export const getItemDivision = (
  item: { nama_barang?: string; product_id?: string },
  products: Product[] = []
): ProductDivision => {
  if (item.product_id) {
    const matched = products.find((p) => p.id === item.product_id);
    if (matched) return getProductDivision(matched);
  }

  if (item.nama_barang) {
    const matchedByName = products.find(
      (p) => p.nama_barang.trim().toLowerCase() === item.nama_barang!.trim().toLowerCase()
    );
    if (matchedByName) return getProductDivision(matchedByName);
  }

  return getProductDivision({ nama_barang: item.nama_barang });
};

/**
 * Memfilter produk berdasarkan divisi
 */
export const filterProductsByDivision = (
  products: Product[],
  division: ProductDivision | "Semua"
): Product[] => {
  if (division === "Semua") return products;
  return products.filter((p) => getProductDivision(p) === division);
};

export interface FilteredInvoiceByDivisionResult {
  hasItems: boolean;
  filteredInvoice: Invoice;
  divisionTotal: number;
  divisionPcs: number;
}

/**
 * Memfilter item di dalam sebuah invoice berdasarkan divisi.
 * Mengembalikan objek invoice baru yang hanya berisi item dari divisi tersebut,
 * beserta rekalkulasi subtotal & kuantitas pcs khusus divisi tersebut.
 */
export const filterInvoiceByDivision = (
  invoice: Invoice,
  division: ProductDivision | "Semua",
  products: Product[] = []
): FilteredInvoiceByDivisionResult => {
  const items = invoice.items || [];
  if (division === "Semua") {
    const totalPcs = items.reduce(
      (sum, it) => sum + Number(it.jumlah ?? (it as any).quantity ?? 0),
      0
    );
    return {
      hasItems: true,
      filteredInvoice: invoice,
      divisionTotal: invoice.total || 0,
      divisionPcs: totalPcs,
    };
  }

  const matchingItems: InvoiceItem[] = items.filter(
    (it) => getItemDivision(it, products) === division
  );

  if (matchingItems.length === 0) {
    return {
      hasItems: false,
      filteredInvoice: { ...invoice, items: [] },
      divisionTotal: 0,
      divisionPcs: 0,
    };
  }

  const divisionSubtotal = matchingItems.reduce(
    (sum, it) =>
      sum +
      Number(
        it.subtotal ||
          (Number(it.jumlah || 0) * Number(it.harga || 0)) ||
          0
      ),
    0
  );

  const divisionPcs = matchingItems.reduce(
    (sum, it) => sum + Number(it.jumlah ?? (it as any).quantity ?? 0),
    0
  );

  // Proporsikan total jika ada diskon global di invoice asli
  const originalSubtotal = invoice.subtotal || invoice.total || divisionSubtotal;
  let divisionTotal = divisionSubtotal;
  if (originalSubtotal > 0 && invoice.diskon && invoice.diskon > 0) {
    const discountRatio = invoice.diskon / originalSubtotal;
    divisionTotal = Math.max(0, Math.round(divisionSubtotal * (1 - discountRatio)));
  }

  return {
    hasItems: true,
    filteredInvoice: {
      ...invoice,
      items: matchingItems,
      subtotal: divisionSubtotal,
      total: divisionTotal,
    },
    divisionTotal,
    divisionPcs,
  };
};

/**
 * Memfilter kumpulan invoice berdasarkan divisi.
 * Mengembalikan array invoice yang itemnya telah difilter sesuai divisi,
 * dan hanya menyertakan invoice yang memiliki item di divisi tersebut.
 */
export const filterInvoicesByDivision = (
  invoices: Invoice[],
  division: ProductDivision | "Semua",
  products: Product[] = []
): Invoice[] => {
  if (division === "Semua") return invoices;

  return invoices
    .map((inv) => {
      const res = filterInvoiceByDivision(inv, division, products);
      return res.hasItems ? res.filteredInvoice : null;
    })
    .filter((inv): inv is Invoice => inv !== null);
};

