import { describe, it, expect } from "vitest";
import {
  getProductDivision,
  getItemDivision,
  filterProductsByDivision,
  filterInvoiceByDivision,
  filterInvoicesByDivision,
} from "./productDivision";
import type { Product, Invoice } from "@/types";

describe("productDivision helper", () => {
  const mockProducts: Product[] = [
    {
      id: "prod-1",
      nama_barang: "Aceh Gayo Winey 200g",
      kategori: "Kopi Biji (Beans)",
      stok_jogja: 10,
      stok_lombok: 5,
      total_stok: 15,
      harga: 110000,
    },
    {
      id: "prod-2",
      nama_barang: "Drip Bag Flores Bajawa 5s",
      kategori: "Kopi Bubuk / Drip",
      stok_jogja: 20,
      stok_lombok: 0,
      total_stok: 20,
      harga: 45000,
    },
    {
      id: "prod-3",
      nama_barang: "Vanilla Syrup 750ml",
      kategori: "Sirup & Bahan",
      stok_jogja: 8,
      stok_lombok: 8,
      total_stok: 16,
      harga: 85000,
    },
    {
      id: "prod-4",
      nama_barang: "Paper Cup 8oz + Lid",
      kategori: "Alat & Kemasan",
      stok_jogja: 50,
      stok_lombok: 20,
      total_stok: 70,
      harga: 1500,
    },
    {
      id: "prod-5",
      nama_barang: "Custom Espresso Beans Blend",
      divisi: "Roastery",
      kategori: "Lainnya",
      stok_jogja: 5,
      stok_lombok: 5,
      total_stok: 10,
      harga: 120000,
    },
  ];

  it("determines product division correctly with explicit field", () => {
    expect(getProductDivision({ divisi: "Roastery", kategori: "Lainnya" })).toBe("Roastery");
    expect(getProductDivision({ divisi: "Warehouse", kategori: "Kopi Biji (Beans)" })).toBe("Warehouse");
  });

  it("determines product division correctly via fallback category and keywords", () => {
    expect(getProductDivision({ kategori: "Kopi Biji (Beans)", nama_barang: "Gayo" })).toBe("Roastery");
    expect(getProductDivision({ kategori: "Kopi Bubuk / Drip", nama_barang: "Sachet" })).toBe("Roastery");
    expect(getProductDivision({ kategori: "Sirup & Bahan", nama_barang: "Caramel" })).toBe("Warehouse");
    expect(getProductDivision({ kategori: "Alat & Kemasan", nama_barang: "Cup" })).toBe("Warehouse");
    // Fallback keyword in name
    expect(getProductDivision({ kategori: "Lainnya", nama_barang: "Special Roast Coffee" })).toBe("Roastery");
    expect(getProductDivision({ kategori: "Lainnya", nama_barang: "Stiker Logo" })).toBe("Warehouse");
  });

  it("filters products by division correctly", () => {
    const roasteryList = filterProductsByDivision(mockProducts, "Roastery");
    const warehouseList = filterProductsByDivision(mockProducts, "Warehouse");
    const allList = filterProductsByDivision(mockProducts, "Semua");

    expect(roasteryList.map((p) => p.id)).toEqual(["prod-1", "prod-2", "prod-5"]);
    expect(warehouseList.map((p) => p.id)).toEqual(["prod-3", "prod-4"]);
    expect(allList.length).toBe(mockProducts.length);
  });

  it("filters invoice items by division correctly", () => {
    const mockInvoice: Invoice = {
      id: "inv-001",
      no_invoice: "INV/TNB/2026/10/0001",
      tanggal: "2026-10-06",
      customer: "Kedai Kopi Senja",
      items: [
        {
          product_id: "prod-1",
          nama_barang: "Aceh Gayo Winey 200g",
          harga: 110000,
          jumlah: 2,
          subtotal: 220000,
        },
        {
          product_id: "prod-3",
          nama_barang: "Vanilla Syrup 750ml",
          harga: 85000,
          jumlah: 1,
          subtotal: 85000,
        },
      ],
      subtotal: 305000,
      total: 305000,
      jumlah_dibayar: 305000,
      sisa: 0,
      status: "LUNAS",
    };

    const roasteryResult = filterInvoiceByDivision(mockInvoice, "Roastery", mockProducts);
    expect(roasteryResult.hasItems).toBe(true);
    expect(roasteryResult.filteredInvoice.items.length).toBe(1);
    expect(roasteryResult.filteredInvoice.items[0].nama_barang).toBe("Aceh Gayo Winey 200g");
    expect(roasteryResult.divisionTotal).toBe(220000);
    expect(roasteryResult.divisionPcs).toBe(2);

    const warehouseResult = filterInvoiceByDivision(mockInvoice, "Warehouse", mockProducts);
    expect(warehouseResult.hasItems).toBe(true);
    expect(warehouseResult.filteredInvoice.items.length).toBe(1);
    expect(warehouseResult.filteredInvoice.items[0].nama_barang).toBe("Vanilla Syrup 750ml");
    expect(warehouseResult.divisionTotal).toBe(85000);
    expect(warehouseResult.divisionPcs).toBe(1);

    const semuaResult = filterInvoiceByDivision(mockInvoice, "Semua", mockProducts);
    expect(semuaResult.hasItems).toBe(true);
    expect(semuaResult.filteredInvoice.items.length).toBe(2);
    expect(semuaResult.divisionTotal).toBe(305000);
    expect(semuaResult.divisionPcs).toBe(3);

    const invoicesList: Invoice[] = [
      mockInvoice,
      {
        id: "inv-002",
        no_invoice: "INV/TNB/2026/10/0002",
        customer: "Kedai Warehouse Only",
        items: [
          {
            product_id: "prod-3",
            nama_barang: "Vanilla Syrup 750ml",
            harga: 85000,
            jumlah: 2,
            subtotal: 170000,
          },
        ],
        subtotal: 170000,
        total: 170000,
        status: "LUNAS",
      },
    ];

    const roasteryInvoices = filterInvoicesByDivision(invoicesList, "Roastery", mockProducts);
    expect(roasteryInvoices.length).toBe(1);
    expect(roasteryInvoices[0].id).toBe("inv-001");

    const warehouseInvoices = filterInvoicesByDivision(invoicesList, "Warehouse", mockProducts);
    expect(warehouseInvoices.length).toBe(2);

    const allInvoices = filterInvoicesByDivision(invoicesList, "Semua", mockProducts);
    expect(allInvoices.length).toBe(2);
  });
});
