import { spreadsheetService } from "./spreadsheetService";
import { IncomeRecord, SpreadsheetIncomeResponse } from "./models/income";

/**
 * Fetches all income records from the Google Spreadsheet endpoint.
 * Adheres strictly to the backend contract:
 * {
 *   success: boolean;
 *   records: IncomeRecord[];
 *   message?: string;
 * }
 */
export const fetchIncomeRecords = async (): Promise<IncomeRecord[]> => {
  console.log("[Income]\nREQUEST");
  
  const response = await spreadsheetService.get<SpreadsheetIncomeResponse>("", {
    action: "income",
  });

  console.log("[Income]\nRESPONSE\n", JSON.stringify(response));

  if (response && response.success && Array.isArray(response.records)) {
    console.log("[Income]\nRECORD COUNT\n", response.records.length);
    console.log("[Income]\nPARSER RESULT\nSuccess");
    return response.records;
  }

  console.log("[Income]\nRECORD COUNT\n0");
  console.log("[Income]\nPARSER RESULT\nFailed (or success: false / records empty)");
  return [];
};

/**
 * Adds a new income record to the Google Spreadsheet.
 */
export const addIncomeRecord = async (payload: Omit<IncomeRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "add_income",
    ...payload,
  });
};

/**
 * Edits an existing income record in the Google Spreadsheet.
 */
export const editIncomeRecord = async (payload: Omit<IncomeRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "edit_income",
    ...payload,
  });
};
