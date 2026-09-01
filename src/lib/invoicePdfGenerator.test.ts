import { describe, it, expect } from "vitest";
import { generateInvoicePdfBlob } from "./invoicePdfGenerator";
import type { Invoice } from "@/types";

describe("invoicePdfGenerator", () => {
  it("should generate a valid PDF blob and base64 string from invoice data", async () => {
    const mockInvoice: Invoice = {
      id: "inv-test-01",
      no_invoice: "INV/TNB/2026/09/0001",
      tanggal: "2026-09-01",
      customer: "Pelanggan Test Kopi",
      items: [
        {
          product_id: "prod-1",
          nama_barang: "Espresso Blend 1kg",
          harga: 125000,
          jumlah: 2,
          subtotal: 250000,
        },
      ],
      subtotal: 250000,
      diskon: 10000,
      total: 240000,
      jumlah_dibayar: 240000,
      sisa: 0,
      status: "LUNAS",
      stock_location: "Jogja",
      dibuat_oleh: "Owner Tanabrew",
    };

    const result = await generateInvoicePdfBlob(mockInvoice);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(100);
    expect(result.base64).toContain("data:application/pdf");
    expect(result.base64).toContain(";base64,");
    expect(result.fileName).toContain("Invoice-INV-TNB-2026-09-0001.pdf");
  });
});
