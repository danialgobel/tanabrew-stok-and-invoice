import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { syncInvoiceToSpreadsheet } from "./invoiceSync";
import { spreadsheetService } from "./spreadsheetService";
import { getDoc } from "firebase/firestore";
import { markSynced, markFailed } from "./syncStatus";

vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn().mockImplementation((_db, _collection, id) => `mock-doc-ref-${id}`),
    getDoc: vi.fn(),
  };
});

vi.mock("@/lib/firebase", () => {
  return {
    db: {},
  };
});

vi.mock("./spreadsheetService", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    spreadsheetService: {
      post: vi.fn(),
    },
  };
});

vi.mock("./syncStatus", () => {
  return {
    markSynced: vi.fn(),
    markFailed: vi.fn(),
    markPending: vi.fn(),
  };
});

describe("invoiceSync", () => {
  const mockDate = new Date("2026-07-10T19:15:00.000Z");

  const mockInvoiceData = {
    no_invoice: "INV/TNB/2026/07/0001",
    customer: "John Doe",
    total: 150000,
    nomor_rekening: "-",
    status: "LUNAS",
    items: [
      { nama_barang: "Kopi Gayo", harga: 50000, jumlah: 2, subtotal: 100000 },
      { nama_barang: "Kopi Toraja", harga: 50000, jumlah: 1, subtotal: 50000 },
    ],
    dibuat_oleh: "Admin Tana",
    dibuat_oleh_role: "admin",
    created_at: {
      toDate: () => mockDate,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully fetch invoice, map payload, call service.post, and markSynced", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockInvoiceData,
    } as any);

    const mockResponse = {
      success: true,
      action: "invoice_sync",
      invoiceNumber: "INV/TNB/2026/07/0001",
      message: "Invoice synced successfully",
    };
    vi.mocked(spreadsheetService.post).mockResolvedValue(mockResponse);

    const result = await syncInvoiceToSpreadsheet("invoice-id-123");

    expect(getDoc).toHaveBeenCalledTimes(1);
    expect(spreadsheetService.post).toHaveBeenCalledTimes(1);
    expect(markSynced).toHaveBeenCalledWith("invoice-id-123");
    expect(markFailed).not.toHaveBeenCalled();

    expect(result).toEqual({
      success: true,
      data: mockResponse,
    });
  });

  it("should handle error, call markFailed, and return success false if getDoc fails", async () => {
    vi.mocked(getDoc).mockRejectedValue(new Error("Firestore database error"));

    const result = await syncInvoiceToSpreadsheet("invoice-id-123");

    expect(spreadsheetService.post).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("invoice-id-123");
    expect(markSynced).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: "Firestore database error",
    });
  });
});
