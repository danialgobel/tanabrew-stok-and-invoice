import { spreadsheetService } from "./spreadsheetService";
import { ExpenseRecord, SpreadsheetExpenseResponse } from "./models/expense";

/** In-memory cache with 60-second TTL to speed up repeated loads */
let _expenseCache: ExpenseRecord[] | null = null;
let _expenseCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

const invalidateExpenseCache = () => {
  _expenseCache = null;
  _expenseCacheTime = 0;
};

/**
 * Fetches all expense records from the Google Spreadsheet endpoint.
 * Returns cached data if fetched within the last 60 seconds.
 */
export const fetchExpenseRecords = async (forceRefresh = false): Promise<ExpenseRecord[]> => {
  const now = Date.now();
  if (!forceRefresh && _expenseCache && now - _expenseCacheTime < CACHE_TTL_MS) {
    console.log("[Expense]\nCACHE HIT — returning cached data");
    return _expenseCache;
  }

  const response = await spreadsheetService.get<SpreadsheetExpenseResponse>("", {
    action: "expense",
  });

  if (response && response.success && Array.isArray(response.records)) {
    _expenseCache = response.records;
    _expenseCacheTime = now;
    return response.records;
  }

  return [];
};

/**
 * Adds a new expense record to the Google Spreadsheet.
 * Invalidates cache so next fetch gets fresh data.
 */
export const addExpenseRecord = async (payload: Omit<ExpenseRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "add_expense",
    ...payload,
  });
  invalidateExpenseCache();
};

/**
 * Edits an existing expense record in the Google Spreadsheet.
 * Invalidates cache so next fetch gets fresh data.
 */
export const editExpenseRecord = async (payload: Omit<ExpenseRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "edit_expense",
    ...payload,
  });
  invalidateExpenseCache();
};
