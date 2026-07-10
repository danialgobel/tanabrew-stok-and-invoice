import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchExpenseRecords } from "./expenseService";
import { spreadsheetService } from "./spreadsheetService";
import { ExpenseRecord } from "./models/expense";

vi.mock("./spreadsheetService", () => {
  return {
    spreadsheetService: {
      get: vi.fn(),
    },
  };
});

describe("expenseService", () => {
  const mockRecords: ExpenseRecord[] = [
    {
      expenseId: "EXP0025",
      tanggalExpense: "2025-12-04",
      itemProduk: "green bean gayo wash + honey",
      kategori: "Bahan baku",
      nominal: 310000,
      catatan: "2kg",
      timestamp: "2025-12-04T05:00:00.000Z",
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

    const result = await fetchExpenseRecords();

    expect(spreadsheetService.get).toHaveBeenCalledWith("", { action: "expense" });
    expect(result).toEqual(mockRecords);
  });

  it("should return an empty array if success is false", async () => {
    vi.mocked(spreadsheetService.get).mockResolvedValue({
      success: false,
      records: [],
      message: "Error fetching",
    });

    const result = await fetchExpenseRecords();

    expect(spreadsheetService.get).toHaveBeenCalledWith("", { action: "expense" });
    expect(result).toEqual([]);
  });

  it("should return an empty array if records property is missing", async () => {
    vi.mocked(spreadsheetService.get).mockResolvedValue({
      success: true,
      message: "API running",
    });

    const result = await fetchExpenseRecords();

    expect(result).toEqual([]);
  });

  it("should throw an error if the underlying service get request fails", async () => {
    vi.mocked(spreadsheetService.get).mockRejectedValue(new Error("API failure"));

    await expect(fetchExpenseRecords()).rejects.toThrow("API failure");
  });
});
