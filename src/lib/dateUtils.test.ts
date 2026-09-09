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
  sortInvoicesForReport,
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

  it("should parse serialized Firestore timestamp objects with seconds or _seconds", () => {
    const epochSec = 1725940800; // 2026-09-10
    expect(getDateValue({ seconds: epochSec, nanoseconds: 0 })).toBe(epochSec * 1000);
    expect(getDateValue({ _seconds: epochSec, _nanoseconds: 0 })).toBe(epochSec * 1000);
  });

  it("should parse Indonesian date string with day name", () => {
    const parsed = parseDateInput("Kamis, 10 September 2026");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8); // September
    expect(parsed?.getDate()).toBe(10);
  });

  it("should fallback to printed_at if tanggal and created_at are not set", () => {
    const invoice: Invoice = {
      id: "inv-print-fallback",
      no_invoice: "",
      tanggal: "",
      customer: "Pelanggan Kopi",
      items: [],
      total: 50000,
      jumlah_dibayar: 50000,
      sisa: 0,
      status: "LUNAS",
      printed_at: new Date(2026, 8, 10, 14, 0, 0),
    };
    const dateVal = getInvoiceDateValue(invoice);
    const d = new Date(dateVal);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(10);
  });

  it("should sort invoices on the same date deterministically by created_at and no_invoice (asc)", () => {
    const inv1: Invoice = {
      id: "inv-c",
      no_invoice: "INV/TNB/2026/09/0003",
      tanggal: "2026-09-08",
      customer: "Pelanggan 3",
      items: [],
      total: 30000,
      jumlah_dibayar: 30000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 8, 14, 0, 0),
    };
    const inv2: Invoice = {
      id: "inv-a",
      no_invoice: "INV/TNB/2026/09/0001",
      tanggal: "2026-09-08",
      customer: "Pelanggan 1",
      items: [],
      total: 10000,
      jumlah_dibayar: 10000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 8, 9, 0, 0),
    };
    const inv3: Invoice = {
      id: "inv-b",
      no_invoice: "INV/TNB/2026/09/0002",
      tanggal: "2026-09-08",
      customer: "Pelanggan 2",
      items: [],
      total: 20000,
      jumlah_dibayar: 20000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 8, 11, 0, 0),
    };

    // Pass in scrambled array
    const scrambled = [inv1, inv3, inv2];
    const sortedAsc = sortInvoicesForReport(scrambled, "asc");

    // Ascending: chronological (0001 -> 0002 -> 0003)
    expect(sortedAsc.map((i) => i.no_invoice)).toEqual([
      "INV/TNB/2026/09/0001",
      "INV/TNB/2026/09/0002",
      "INV/TNB/2026/09/0003",
    ]);

    // Descending: newest first (0003 -> 0002 -> 0001)
    const sortedDesc = sortInvoicesForReport(scrambled, "desc");
    expect(sortedDesc.map((i) => i.no_invoice)).toEqual([
      "INV/TNB/2026/09/0003",
      "INV/TNB/2026/09/0002",
      "INV/TNB/2026/09/0001",
    ]);

    // Default without direction parameter should default to descending (newest first)
    const sortedDefault = sortInvoicesForReport(scrambled);
    expect(sortedDefault.map((i) => i.no_invoice)).toEqual([
      "INV/TNB/2026/09/0003",
      "INV/TNB/2026/09/0002",
      "INV/TNB/2026/09/0001",
    ]);
  });

  it("should sort invoices across different dates in chronological order (asc)", () => {
    const day1: Invoice = {
      id: "inv-day1",
      no_invoice: "INV/TNB/2026/09/0001",
      tanggal: "2026-09-01",
      customer: "Pelanggan 1",
      items: [],
      total: 10000,
      jumlah_dibayar: 10000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 1, 10, 0, 0),
    };
    const day5: Invoice = {
      id: "inv-day5",
      no_invoice: "INV/TNB/2026/09/0005",
      tanggal: "2026-09-05",
      customer: "Pelanggan 5",
      items: [],
      total: 50000,
      jumlah_dibayar: 50000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 5, 10, 0, 0),
    };
    const day10: Invoice = {
      id: "inv-day10",
      no_invoice: "INV/TNB/2026/09/0010",
      tanggal: "2026-09-10",
      customer: "Pelanggan 10",
      items: [],
      total: 100000,
      jumlah_dibayar: 100000,
      sisa: 0,
      status: "LUNAS",
      created_at: new Date(2026, 8, 10, 10, 0, 0),
    };

    const sorted = sortInvoicesForReport([day10, day1, day5], "asc");
    expect(sorted.map((i) => i.no_invoice)).toEqual([
      "INV/TNB/2026/09/0001",
      "INV/TNB/2026/09/0005",
      "INV/TNB/2026/09/0010",
    ]);
  });
});

