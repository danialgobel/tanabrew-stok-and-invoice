import { describe, it, expect } from "vitest";
import {
  toInputDate,
  todayInputValue,
  toValidDateInputValue,
  parseDateInput,
  getDateValue,
  getInvoiceDateValue,
  formatDisplayDate,
  formatInvoiceDate,
  getDateRange,
  matchesDateFilter,
} from "./dateUtils";
import type { Invoice } from "@/types";

describe("dateUtils", () => {
  it("should format date to YYYY-MM-DD input string", () => {
    const d = new Date(2026, 7, 25); // 25 Aug 2026
    expect(toInputDate(d)).toBe("2026-08-25");
  });

  it("should convert any date format into YYYY-MM-DD for input fields", () => {
    expect(toValidDateInputValue("2026-08-15")).toBe("2026-08-15");
    expect(toValidDateInputValue("15/08/2026")).toBe("2026-08-15");
    expect(toValidDateInputValue("15 Agustus 2026")).toBe("2026-08-15");
    expect(toValidDateInputValue(new Date(2026, 7, 15))).toBe("2026-08-15");
  });

  it("should prioritize invoice.tanggal over invoice.created_at in getInvoiceDateValue", () => {
    const invoice: Invoice = {
      id: "inv-1",
      no_invoice: "INV/TNB/2026/08/0001",
      tanggal: "2026-08-15", // August 15, 2026
      customer: "Pelanggan Kopi",
      items: [],
      subtotal: 50000,
      diskon: 0,
      total: 50000,
      jumlah_dibayar: 50000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 1, 10, 0, 0), // September 1, 2026 (created later)
    };

    const dateVal = getInvoiceDateValue(invoice);
    const invoiceDate = new Date(dateVal);

    expect(invoiceDate.getFullYear()).toBe(2026);
    expect(invoiceDate.getMonth()).toBe(7); // Must be August (month 7), NOT September (month 8)
    expect(invoiceDate.getDate()).toBe(15);
  });

  it("should correctly format invoice date in Indonesian", () => {
    const invoice: Invoice = {
      id: "inv-1",
      no_invoice: "INV/TNB/2026/08/0001",
      tanggal: "2026-08-15",
      customer: "Pelanggan Kopi",
      items: [],
      subtotal: 50000,
      diskon: 0,
      total: 50000,
      jumlah_dibayar: 50000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 1, 10, 0, 0),
    };

    const formatted = formatInvoiceDate(invoice);
    expect(formatted).toContain("15");
    expect(formatted).toContain("Agustus");
    expect(formatted).toContain("2026");
  });

  it("should match date filter based on invoice.tanggal", () => {
    const augustInvoice: Invoice = {
      id: "inv-aug",
      no_invoice: "INV/TNB/2026/08/0001",
      tanggal: "2026-08-15",
      customer: "Pelanggan Kopi",
      items: [],
      subtotal: 50000,
      diskon: 0,
      total: 50000,
      jumlah_dibayar: 50000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 1, 10, 0, 0), // Saved on Sep 1
    };

    // Custom filter for August 1 to August 31
    expect(matchesDateFilter(augustInvoice, "custom", "2026-08-01", "2026-08-31")).toBe(true);
    // Custom filter for September 1 to September 30 should be false
    expect(matchesDateFilter(augustInvoice, "custom", "2026-09-01", "2026-09-30")).toBe(false);
  });
});
