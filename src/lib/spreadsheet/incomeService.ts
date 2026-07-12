import { spreadsheetService } from "./spreadsheetService";
import { IncomeRecord, SpreadsheetIncomeResponse } from "./models/income";

/** In-memory cache with 60-second TTL to speed up repeated loads */
let _incomeCache: IncomeRecord[] | null = null;
let _incomeCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

const invalidateIncomeCache = () => {
  _incomeCache = null;
  _incomeCacheTime = 0;
};

/**
 * Fetches all income records from the Google Spreadsheet endpoint.
 * Returns cached data if fetched within the last 60 seconds.
 */
export const fetchIncomeRecords = async (forceRefresh = false): Promise<IncomeRecord[]> => {
  const now = Date.now();
  if (!forceRefresh && _incomeCache && now - _incomeCacheTime < CACHE_TTL_MS) {
    console.log("[Income]\nCACHE HIT — returning cached data");
    return _incomeCache;
  }

  console.log("[Income]\nREQUEST");

  const response = await spreadsheetService.get<SpreadsheetIncomeResponse>("", {
    action: "income",
  });

  console.log("[Income]\nRESPONSE\n", JSON.stringify(response));

  if (response && response.success && Array.isArray(response.records)) {
    console.log("[Income]\nRECORD COUNT\n", response.records.length);
    console.log("[Income]\nPARSER RESULT\nSuccess");
    _incomeCache = response.records;
    _incomeCacheTime = now;
    return response.records;
  }

  console.log("[Income]\nRECORD COUNT\n0");
  console.log("[Income]\nPARSER RESULT\nFailed (or success: false / records empty)");
  return [];
};

/**
 * Adds a new income record to the Google Spreadsheet.
 * Invalidates cache so next fetch gets fresh data.
 */
export const addIncomeRecord = async (payload: Omit<IncomeRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "add_income",
    ...payload,
  });
  invalidateIncomeCache();
};

/**
 * Edits an existing income record in the Google Spreadsheet.
 * Invalidates cache so next fetch gets fresh data.
 */
export const editIncomeRecord = async (payload: Omit<IncomeRecord, "timestamp">): Promise<void> => {
  await spreadsheetService.post("", {
    action: "edit_income",
    ...payload,
  });
  invalidateIncomeCache();
};
