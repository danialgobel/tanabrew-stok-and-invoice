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
    catLower.includes("espresso") ||
    catLower.includes("filter")
  );
};

/**
 * Menentukan divisi sebuah produk secara cerdas:
 * 1. Jika field `divisi` sudah diisi ("Roastery" / "Warehouse"), gunakan langsung.
 * 2. Jika kategori jelas termasuk Roastery / Warehouse, gunakan kategori.
 * 3. Fallback cerdas berdasarkan kata kunci nama barang.
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

  // Jika kategori master produk secara spesifik termasuk Warehouse
  if (product.kategori && (
    product.kategori.includes("Sirup") ||
    product.kategori.includes("Bahan") ||
    product.kategori.includes("Alat") ||
    product.kategori.includes("Kemasan")
  )) {
    return "Warehouse";
  }

  // Cek kata kunci pada nama barang
  const nameLower = (product.nama_barang || "").toLowerCase().trim();

  // Kata kunci spesifik Warehouse (kemasan, cup, sirup, peralatan, dll.)
  const warehouseKeywords = [
    "sirup", "syrup", "cup", "lid", "sedotan", "straw", "paper cup",
    "plastik", "botol", "bottle", "kemasan", "packaging", "pouch",
    "dus", "box", "sealer", "kertas saring", "tissue", "tisue",
    "tamper", "pitcher", "milk jug", "timbangan", "scale", "dripper",
    "server", "teko", "kettle", "celemek", "apron", "cleaner", "descaler",
    "gula", "sugar", "creamer", "krimer", "susu", "milk", "powder",
    "cokelat", "chocolate", "matcha", "tea", "teh", "flavor", "flavour",
    "sauce", "saus", "monin", "torani", "davinci", "denali", "dripp",
    "toffin", "stiker", "sticker", "sendok", "garpu", "fork", "spoon"
  ];
  if (warehouseKeywords.some((kw) => nameLower.includes(kw))) {
    return "Warehouse";
  }

  // Kata kunci spesifik Roastery (biji kopi sangrai, single origin, proses, varietas)
  const roasteryKeywords = [
    "beans", "kopi", "coffee", "roast", "arabica", "robusta", "espresso", "drip",
    "filter", "honey", "natural", "washed", "wash", "wine", "anaerobic", "full wash",
    "dry process", "gayo", "kerinci", "toraja", "mandheling", "mandailing", "sidikalang",
    "bajawa", "flores", "bali", "kintamani", "java", "papua", "wamena", "colombia",
    "ethiopia", "kenya", "brazil", "blend", "single origin", "geisha", "bourbon",
    "typica", "catimor", "decaf", "v60", "kalita", "aeropress", "french press",
    "chemex", "syphon", "grind", "biji", "sangrai", "origin"
  ];
  if (roasteryKeywords.some((kw) => nameLower.includes(kw))) {
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
  // 1. Cocokkan berdasarkan product_id jika ada
  if (item.product_id && Array.isArray(products) && products.length > 0) {
    const matched = products.find((p) => p.id === item.product_id);
    if (matched) return getProductDivision(matched);
  }

  // 2. Cocokkan berdasarkan nama barang pada master data produk
  if (item.nama_barang && Array.isArray(products) && products.length > 0) {
    const itemNameClean = item.nama_barang.trim().toLowerCase();

    // 2a. Pencocokan nama persis (exact match)
    const matchedByName = products.find(
      (p) => (p.nama_barang || "").trim().toLowerCase() === itemNameClean
    );
    if (matchedByName) return getProductDivision(matchedByName);

    // 2b. Pencocokan nama toleran / bagian (fuzzy / partial match)
    const matchedFuzzy = products.find((p) => {
      const pName = (p.nama_barang || "").trim().toLowerCase();
      if (!pName) return false;
      return itemNameClean.includes(pName) || pName.includes(itemNameClean);
    });
    if (matchedFuzzy) return getProductDivision(matchedFuzzy);
  }

  // 3. Fallback cerdas berdasarkan nama barang
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

