import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { spreadsheetService, SpreadsheetResponse, SpreadsheetSyncResponse, SpreadsheetError } from "./spreadsheetService";
import { markSynced, markFailed } from "./syncStatus";

export interface SpreadsheetInvoiceItem {
  nama_barang: string;
  harga: number;
  jumlah: number;
  subtotal: number;
}

export interface SpreadsheetInvoicePayload {
  invoiceNumber: string;
  tanggalInvoice: string;
  jamInvoice: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  totalItems: number;
  items: SpreadsheetInvoiceItem[];
  createdBy: string;
  role: string;
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  data?: SpreadsheetSyncResponse;
}

/**
 * Formats a Date object as a local date string (YYYY-MM-DD) to prevent timezone offset shifts.
 */
const formatLocalDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Formats a Date object as a local time string (HH:mm:ss).
 */
const formatLocalTime = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

/**
 * Classifies the error thrown during synchronization for logging purposes.
 */
const getErrorReason = (error: unknown): string => {
  if (error instanceof SpreadsheetError) {
    if (error.status === 408) {
      return "Timeout";
    }
    return `HTTP Error (${error.status})`;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.toLowerCase().includes("timeout")) {
      return "Timeout";
    }
    return error.message;
  }
  return "Network Error";
};

/**
 * Fetches the newly created invoice from Firestore, parses its Firestore serverTimestamp,
 * maps the full invoice payload, and synchronizes it to Google Spreadsheet via SpreadsheetService.
 *
 * This operation is fully fail-safe and logs synchronization metrics for traceability.
 */
export const syncInvoiceToSpreadsheet = async (invoiceId: string): Promise<SyncResult> => {
  const startTime = performance.now();
  let currentNoInvoice = "Unknown";

  try {
    // 1. Fetch the invoice document from Firestore to get the finalized serverTimestamp and invoice data
    const invoiceDocRef = doc(db, "invoices", invoiceId);
    const invoiceDocSnap = await getDoc(invoiceDocRef);

    if (!invoiceDocSnap.exists()) {
      throw new Error(`Invoice with ID ${invoiceId} not found in Firestore.`);
    }

    const invoiceData = invoiceDocSnap.data();
    currentNoInvoice = String(invoiceData.no_invoice || "Unknown");

    // Print developer log at start of synchronization
    console.log(`[Spreadsheet]\nSTART\nInvoice ${currentNoInvoice}`);
    console.log("[Spreadsheet]\nPOST");

    // 2. Parse and format the Firestore server timestamp (created_at)
    const createdAtTimestamp = invoiceData.created_at;
    let invoiceDate = new Date();
    if (createdAtTimestamp && typeof createdAtTimestamp.toDate === "function") {
      invoiceDate = createdAtTimestamp.toDate();
    } else if (createdAtTimestamp instanceof Date) {
      invoiceDate = createdAtTimestamp;
    } else if (createdAtTimestamp && typeof createdAtTimestamp.seconds === "number") {
      invoiceDate = new Date(createdAtTimestamp.seconds * 1000);
    } else if (typeof createdAtTimestamp === "string" || typeof createdAtTimestamp === "number") {
      invoiceDate = new Date(createdAtTimestamp);
    }

    const tanggalInvoice = formatLocalDate(invoiceDate);
    const jamInvoice = formatLocalTime(invoiceDate);
    const timestamp = invoiceDate.toISOString();

    // 3. Map the payload (incorporates invoiceNumber for duplicate protection)
    const payload: SpreadsheetInvoicePayload = {
      invoiceNumber: currentNoInvoice,
      tanggalInvoice,
      jamInvoice,
      customerName: String(invoiceData.customer || "-"),
      total: Number(invoiceData.total) || 0,
      paymentMethod: String(invoiceData.nomor_rekening || "-"),
      paymentStatus: String(invoiceData.status || "BELUM LUNAS"),
      totalItems: Array.isArray(invoiceData.items)
        ? invoiceData.items.reduce((sum: number, item: any) => sum + (Number(item.jumlah) || 0), 0)
        : 0,
      items: Array.isArray(invoiceData.items)
        ? invoiceData.items.map((item: any) => ({
            nama_barang: String(item.nama_barang || ""),
            harga: Number(item.harga) || 0,
            jumlah: Number(item.jumlah) || 0,
            subtotal: Number(item.subtotal) || 0,
          }))
        : [],
      createdBy: String(invoiceData.dibuat_oleh || "-"),
      role: String(invoiceData.dibuat_oleh_role || "-"),
      timestamp,
    };

    // 4. Send to Spreadsheet Service
    const response = await spreadsheetService.post<SpreadsheetResponse<SpreadsheetSyncResponse> | SpreadsheetSyncResponse>("", payload);
    
    // Parse response format (supports directly returned standard response or wrapped response)
    let syncResponse: SpreadsheetSyncResponse;
    if ("success" in response) {
      syncResponse = response;
    } else {
      // Fallback parser for standard response format
      syncResponse = {
        success: response.status === "success",
        action: "invoice_sync",
        invoiceNumber: currentNoInvoice,
        message: response.message || "Synced successfully",
      };
    }

    // 5. Update Firestore status to SYNCED
    await markSynced(invoiceId);

    // Compute execution duration and print success log
    const duration = Math.round(performance.now() - startTime);
    console.log(`[Spreadsheet]\nSUCCESS\nDuration: ${duration} ms`);

    return {
      success: true,
      data: syncResponse,
    };
  } catch (error: unknown) {
    // 6. Update Firestore status to FAILED in case of any exceptions
    try {
      await markFailed(invoiceId);
    } catch (dbError) {
      console.warn("Failed to mark sync status as FAILED in Firestore:", dbError);
    }

    // Parse and log fail-safe errors
    const reason = getErrorReason(error);
    console.warn(`[Spreadsheet]\nFAILED\nReason:\n${reason}`);

    return {
      success: false,
      error: reason,
    };
  }
};
