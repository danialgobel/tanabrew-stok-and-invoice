import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchIncomeRecords } from "./incomeService";
import { spreadsheetService } from "./spreadsheetService";
import { IncomeRecord } from "./models/income";

vi.mock("./spreadsheetService", () => {
  return {
    spreadsheetService: {
      get: vi.fn(),
    },
  };
});

describe("incomeService refactored", () => {
  const mockRecords: IncomeRecord[] = [
    {
      invoiceNumber: "INV-001",
      tanggalInvoice: "2026-07-10",
      jamInvoice: "12:00:00",
      customerName: "Jane Doe",
      total: 100000,
      paymentMethod: "-",
      paymentStatus: "LUNAS",
      createdBy: "Staff 1",
      role: "staff",
      timestamp: "2026-07-10T05:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully fetch and return records on success: true", async () => {
    vi.mocked(spreadsheetService.get).mockResolvedValue({
      success: true,
      records: mockRecords,
      message: "Fetched successfully",
    });

    const result = await fetchIncomeRecords();

    expect(spreadsheetService.get).toHaveBeenCalledWith("", { action: "income" });
    expect(result).toEqual(mockRecords);
  });

  it("should return an empty array if success is false", async () => {
    vi.mocked(spreadsheetService.get).mockResolvedValue({
      success: false,
      records: [],
      message: "API error",
    });

    const result = await fetchIncomeRecords();

    expect(spreadsheetService.get).toHaveBeenCalledWith("", { action: "income" });
    expect(result).toEqual([]);
  });

  it("should return an empty array if records property is missing or invalid", async () => {
    vi.mocked(spreadsheetService.get).mockResolvedValue({
      success: true,
      message: "API running",
    });

    const result = await fetchIncomeRecords();

    expect(result).toEqual([]);
  });

  it("should throw an error if the underlying service get request fails", async () => {
    vi.mocked(spreadsheetService.get).mockRejectedValue(new Error("Network error"));

    await expect(fetchIncomeRecords()).rejects.toThrow("Network error");
  });
});
