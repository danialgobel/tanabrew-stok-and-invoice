import { spreadsheetService } from "./spreadsheetService";
import { ExpenseRecord, SpreadsheetExpenseResponse } from "./models/expense";

/**
 * Fetches all expense records from the Google Spreadsheet endpoint.
 * Adheres strictly to the backend contract:
 * {
 *   success: boolean;
 *   records: ExpenseRecord[];
 *   message?: string;
 * }
 */
export const fetchExpenseRecords = async (): Promise<ExpenseRecord[]> => {
  const response = await spreadsheetService.get<SpreadsheetExpenseResponse>("", {
    action: "expense",
  });

  if (response && response.success && Array.isArray(response.records)) {
    return response.records;
  }

  return [];
};

/**
 * Adds a new expense record to the Google Spreadsheet.
 */
export const addExpenseRecord = async (payload: Omit<ExpenseRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "add_expense",
    ...payload,
  });
};

/**
 * Edits an existing expense record in the Google Spreadsheet.
 */
export const editExpenseRecord = async (payload: Omit<ExpenseRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "edit_expense",
    ...payload,
  });
};
