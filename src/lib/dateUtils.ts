import type { Invoice } from "@/types";

export type DateFilter = "semua" | "hari_ini" | "bulan_ini" | "custom";

const indonesianMonths: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4, may: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, aug: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9, oct: 9,
  november: 10, nov: 10,
  desember: 11, des: 11, dec: 11,
};

/**
 * Format a Date object into 'YYYY-MM-DD' in local timezone.
 */
export const toInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Returns today's date in 'YYYY-MM-DD' in local timezone.
 */
export const todayInputValue = (): string => toInputDate(new Date());

/**
 * Converts any stored date value (string, Timestamp, Date) into valid 'YYYY-MM-DD' for input fields.
 */
export const toValidDateInputValue = (value?: unknown): string => {
  if (!value) return todayInputValue();
  if (value instanceof Date) return toInputDate(value);
  if (typeof value === "string") {
    const parsed = parseDateInput(value);
    if (parsed) return toInputDate(parsed);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  }
  const time = getDateValue(value);
  if (time) return toInputDate(new Date(time));
  return todayInputValue();
};

/**
 * Safely parse a date string into a Date object in local time.
 * Supports:
 * - 'YYYY-MM-DD'
 * - 'DD/MM/YYYY' or 'DD-MM-YYYY'
 * - Indonesian month names like '29 Agustus 2026'
 * - ISO date strings
 */
export const parseDateInput = (value?: string | null): Date | null => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Format YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  // Format DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  // Format with Indonesian month name: "29 Agustus 2026"
  const textParts = trimmed.split(/[\s,]+/);
  if (textParts.length >= 3) {
    const day = Number(textParts[0]);
    const mName = textParts[1]?.toLowerCase() || "";
    const year = Number(textParts[2]);
    if (day >= 1 && day <= 31 && indonesianMonths[mName] !== undefined && year >= 1900) {
      return new Date(year, indonesianMonths[mName], day, 12, 0, 0);
    }
  }

  // Fallback to Date.parse
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
};

/**
 * Extract numerical epoch timestamp from various date representations
 * (Firestore Timestamp object, Date instance, number, or string).
 */
export const getDateValue = (value: unknown): number => {
  if (!value) return 0;

  // Firestore Timestamp object
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate().getTime();
  }

  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsedDate = parseDateInput(value);
    if (parsedDate) return parsedDate.getTime();
  }

  return 0;
};

/**
 * Get the authoritative date value for an invoice.
 * PRIORITIZES invoice.tanggal (the operational invoice date inputted by user),
 * then falls back to invoice.created_at (system creation timestamp),
 * and finally to the invoice number INV/TNB/YYYY/MM/XXXX pattern.
 */
export const getInvoiceDateValue = (invoice: Invoice): number => {
  // 1. Primary: invoice.tanggal (the user-specified transaction date)
  if (invoice.tanggal) {
    const tanggalTime = getDateValue(invoice.tanggal);
    if (tanggalTime) return tanggalTime;
  }

  // 2. Secondary: invoice.created_at (server timestamp)
  const createdTime = getDateValue(invoice.created_at);
  if (createdTime) return createdTime;

  // 3. Fallback: Parse from invoice number INV/TNB/YYYY/MM/XXXX
  if (invoice.no_invoice) {
    const parts = invoice.no_invoice.split("/");
    if (parts.length >= 4) {
      const year = Number(parts[2]);
      const month = Number(parts[3]);
      if (year >= 2000 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1, 12, 0, 0).getTime();
      }
    }
  }

  return 0;
};

/**
 * Format a Date or date string to Indonesian full date (e.g. "1 September 2026").
 */
export const formatFullDate = (date: Date): string =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

/**
 * Format a Date to Month & Year (e.g. "September 2026").
 */
export const formatMonthYear = (date: Date): string =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);

/**
 * Format any date input to display string (e.g. "1 September 2026").
 */
export const formatDisplayDate = (value: unknown, fallback = "-"): string => {
  if (!value) return fallback;

  if (value instanceof Date) {
    return formatFullDate(value);
  }

  if (typeof value === "string") {
    const parsed = parseDateInput(value);
    if (parsed) return formatFullDate(parsed);
    return value;
  }

  const time = getDateValue(value);
  if (!time) return fallback;

  return formatFullDate(new Date(time));
};

/**
 * Format invoice date for display, printing, and reports.
 * Prioritizes invoice.tanggal over invoice.created_at.
 */
export const formatInvoiceDate = (invoice: Invoice, fallback = "-"): string => {
  if (invoice.tanggal) {
    return formatDisplayDate(invoice.tanggal, fallback);
  }
  if (invoice.created_at) {
    return formatDisplayDate(invoice.created_at, fallback);
  }
  return fallback;
};

/**
 * Format date & time (e.g. "1 Sep 2026, 20.48").
 */
export const formatDateTime = (value: unknown, fallback = "-"): string => {
  if (!value) return fallback;

  const time = getDateValue(value);
  if (!time) return typeof value === "string" ? value : fallback;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
};

/**
 * Get date range for filtering invoices/reports in local timezone.
 */
export const getDateRange = (filter: DateFilter, startDate?: string, endDate?: string) => {
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (filter === "hari_ini") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  if (filter === "bulan_ini") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  if (filter === "custom") {
    if (startDate) {
      const parsedStart = parseDateInput(startDate);
      if (parsedStart) {
        start = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0);
      }
    }
    if (endDate) {
      const parsedEnd = parseDateInput(endDate);
      if (parsedEnd) {
        end = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
      }
    }
  }

  return { start, end };
};

/**
 * Test whether an invoice matches a given date filter.
 */
export const matchesDateFilter = (
  invoice: Invoice,
  filter: DateFilter,
  startDate?: string,
  endDate?: string,
): boolean => {
  if (filter === "semua") return true;

  const time = getInvoiceDateValue(invoice);
  if (!time) return false;

  const { start, end } = getDateRange(filter, startDate, endDate);
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
};

/**
 * Get human-readable label for a period filter.
 */
export const getPeriodLabel = (filter: DateFilter, startDate?: string, endDate?: string): string => {
  if (filter === "hari_ini") return formatFullDate(new Date());
  if (filter === "bulan_ini") return formatMonthYear(new Date());
  if (filter === "custom") {
    const startLabel = startDate ? formatDisplayDate(startDate) : "-";
    const endLabel = endDate ? formatDisplayDate(endDate) : "-";
    return `${startLabel} - ${endLabel}`;
  }
  return "Semua Tanggal";
};
