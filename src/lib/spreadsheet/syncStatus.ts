import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Marks an invoice's spreadsheet synchronization status as PENDING in Firestore.
 */
export const markPending = async (invoiceId: string): Promise<void> => {
  const docRef = doc(db, "invoices", invoiceId);
  await updateDoc(docRef, {
    spreadsheetSyncStatus: "PENDING",
  });
};

/**
 * Marks an invoice's spreadsheet synchronization status as SYNCED in Firestore,
 * and sets the synced timestamp using Firestore serverTimestamp.
 */
export const markSynced = async (invoiceId: string): Promise<void> => {
  const docRef = doc(db, "invoices", invoiceId);
  await updateDoc(docRef, {
    spreadsheetSyncStatus: "SYNCED",
    spreadsheetSyncedAt: serverTimestamp(),
  });
};

/**
 * Marks an invoice's spreadsheet synchronization status as FAILED in Firestore.
 */
export const markFailed = async (invoiceId: string): Promise<void> => {
  const docRef = doc(db, "invoices", invoiceId);
  await updateDoc(docRef, {
    spreadsheetSyncStatus: "FAILED",
  });
};
