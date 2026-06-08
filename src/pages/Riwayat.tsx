import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Activity, Eye, FileText, Package, Printer, RotateCcw, Search, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import AnimatedNotification from "@/components/AnimatedNotification";
import ConfirmDialog from "@/components/ConfirmDialog";
import PullToRefresh from "@/components/PullToRefresh";
import { CardSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { openReportWindow, printInvoiceReport, printStockReport, printTanabrewReport, writeReportError } from "@/lib/reportPrint";
import type { ActivityLog, Invoice, InvoiceItem, StockMovement } from "@/types";

type ActiveTab = "invoice" | "stok" | "aktivitas";
type PayStatusFilter = "semua" | "LUNAS" | "BELUM LUNAS";
type PrintStatusFilter = "semua" | "belum" | "sudah";
type DateFilter = "semua" | "hari_ini" | "bulan_ini" | "custom";
type ReportType = "invoice" | "stok" | "gabungan";

type ActionNotice = {
  id: number;
  title: string;
  description?: string;
};

const paymentInstructions = [
  "Transfer ke Seabank a.n. AHMAD FARID MUSADDAD",
  "No. Rekening 9011 2193 2420",
  "Transfer ke BSI a.n. AHMAD FARID MUSADDAD",
  "No. Rekening 7196999501",
];

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayInputValue = () => toInputDate(new Date());

const parseInputDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const formatFullDate = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

const formatMonthYear = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const getDateValue = (value: unknown) => {
  if (!value) return 0;

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) return value.getTime();

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const getInvoiceDateValue = (invoice: Invoice) => getDateValue(invoice.created_at) || getDateValue(invoice.tanggal);

const formatDate = (value: unknown, fallback?: string) => {
  if (!value) return fallback || "-";
  if (typeof value === "string") return value;

  const time = getDateValue(value);
  if (!time) return fallback || "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(time));
};

const formatInvoiceDate = (invoice: Invoice) => formatDate(invoice.created_at, invoice.tanggal);

const formatRole = (role?: string) => {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return role || "Tidak diketahui";
};

const actionLabel = (action?: string) => {
  switch (action) {
    case "CREATE_PRODUCT":
      return "Tambah Produk";
    case "UPDATE_PRODUCT":
      return "Edit Produk";
    case "DELETE_PRODUCT":
      return "Hapus Produk";
    case "CREATE_INVOICE":
      return "Buat Invoice";
    case "PRINT_INVOICE":
      return "Cetak Invoice";
    case "UPDATE_PAYMENT_STATUS":
      return "Tandai Lunas";
    default:
      return action || "-";
  }
};

const movementLabel = (movementType?: string) => {
  switch (movementType) {
    case "STOCK_IN":
      return "Stok Masuk";
    case "STOCK_EDIT":
      return "Edit Stok";
    case "STOCK_OUT_INVOICE":
      return "Stok Keluar Invoice";
    case "PRODUCT_CREATE":
      return "Produk Dibuat";
    case "PRODUCT_DELETE":
      return "Produk Dihapus";
    default:
      return movementType || "Mutasi Stok";
  }
};

const statusClass = (status?: string) =>
  status === "LUNAS" ? "text-primary" : status === "BELUM LUNAS" ? "text-destructive" : "text-foreground";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getDateRange = (filter: DateFilter, startDate: string, endDate: string) => {
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
    start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    end = endDate ? new Date(`${endDate}T23:59:59`) : null;
  }

  return { start, end };
};

const matchesDateFilter = (invoice: Invoice, filter: DateFilter, startDate: string, endDate: string) => {
  if (filter === "semua") return true;

  const time = getInvoiceDateValue(invoice);
  if (!time) return false;

  const { start, end } = getDateRange(filter, startDate, endDate);
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
};

const getPeriodLabel = (filter: DateFilter, startDate: string, endDate: string) => {
  if (filter === "hari_ini") return formatFullDate(new Date());
  if (filter === "bulan_ini") return formatMonthYear(new Date());
  if (filter === "custom") {
    const startLabel = startDate ? formatFullDate(parseInputDate(startDate) || new Date(startDate)) : "-";
    const endLabel = endDate ? formatFullDate(parseInputDate(endDate) || new Date(endDate)) : "-";
    return `${startLabel} - ${endLabel}`;
  }
  return "Semua Tanggal";
};

const getStockStatus = (total?: number) => {
  const value = total || 0;
  if (value === 0) return "Habis";
  if (value > 0 && value <= 3) return "Menipis";
  return "Aman";
};

const buildInvoicePrintHtml = (invoice: Invoice, autoPrint: boolean) => {
  const itemsHtml = (invoice.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-top:1px solid #ddd;">${escapeHtml(item.nama_barang)}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:right;">${escapeHtml(formatCurrency(item.harga))}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:center;">${escapeHtml(item.jumlah)}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:right;">${escapeHtml(formatCurrency(item.subtotal))}</td>
      </tr>`,
    )
    .join("");

  const script = autoPrint
    ? `<script>
    window.addEventListener('load', function(){
      setTimeout(function(){ window.focus(); window.print(); }, 500);
    });
  <\/script>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.no_invoice)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color:#111; margin:0; padding:16px; font-size:13px; }
  .print-toolbar { position:sticky; top:0; z-index:20; display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:-16px -16px 16px; padding:10px 16px; background:#f1f8e9; border-bottom:1px solid #c8e6c9; }
  .back-button { min-height:42px; border:0; border-radius:10px; background:#2E7D32; color:#fff; padding:0 14px; font-size:15px; font-weight:700; cursor:pointer; }
  .back-button:active { transform:translateY(1px); }
  .back-note { display:none; font-size:12px; color:#49624c; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .head img { width:140px; height:auto; }
  .info { text-align:right; line-height:1.5; }
  .info span { color:#666; }
  h2 { text-align:center; color:#2E7D32; margin:8px 0 16px; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  thead th { background:#A5D6A7; padding:8px; text-align:left; font-weight:600; }
  thead th.r { text-align:right; } thead th.c { text-align:center; }
  .sum { border-top:1px solid #ddd; padding-top:8px; }
  .row { display:flex; justify-content:space-between; padding:2px 0; }
  .bold { font-weight:700; }
  .green { color:#2E7D32; }
  .red { color:#c0392b; }
  .foot { border-top:1px solid #ddd; padding-top:8px; margin-top:12px; font-size:11px; color:#555; }
  .foot b { color:#111; display:block; margin-bottom:4px; }
  @media print { .no-print { display:none !important; } }
</style></head><body>
  <div class="print-toolbar no-print">
    <button type="button" class="back-button" onclick="kembaliTanabrew()">&larr; Kembali ke Tanabrew</button>
    <span id="back-note" class="back-note">Gunakan tombol kembali browser untuk kembali ke Tanabrew.</span>
  </div>
  <div class="head">
    <img src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png" alt="Tanabrew" />
    <div class="info">
      <div><span>No Invoice:</span> ${escapeHtml(invoice.no_invoice)}</div>
      <div><span>Tanggal:</span> ${escapeHtml(formatInvoiceDate(invoice))}</div>
      <div><span>Customer:</span> ${escapeHtml(invoice.customer)}</div>
      <div><span>Nomor Rekening:</span> ${escapeHtml(invoice.nomor_rekening || "-")}</div>
    </div>
  </div>
  <h2>INVOICE</h2>
  <table>
    <thead><tr><th>Nama Barang</th><th class="r">Harga</th><th class="c">Jumlah</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(invoice.subtotal))}</span></div>
    ${(invoice.diskon || 0) > 0 ? `<div class="row"><span>Diskon</span><span>- ${escapeHtml(formatCurrency(invoice.diskon))}</span></div>` : ""}
    <div class="row bold"><span>Total</span><span>${escapeHtml(formatCurrency(invoice.total))}</span></div>
    <div class="row"><span>Jumlah Dibayar</span><span>${escapeHtml(formatCurrency(invoice.jumlah_dibayar))}</span></div>
    <div class="row"><span>Sisa Pembayaran</span><span>${escapeHtml(formatCurrency(invoice.sisa))}</span></div>
    <div class="row bold"><span>Status</span><span class="${invoice.status === "LUNAS" ? "green" : "red"}">${escapeHtml(invoice.status)}</span></div>
    <div class="row"><span>Dibuat Oleh</span><span>${escapeHtml(invoice.dibuat_oleh || "Tidak diketahui")}</span></div>
  </div>
  <div class="foot">
    <b>Instruksi Pembayaran</b>
    <div>Transfer ke Seabank a.n. AHMAD FARID MUSADDAD</div>
    <div>No. Rekening 9011 2193 2420</div>
    <div style="margin-top:6px;">Transfer ke BSI a.n. AHMAD FARID MUSADDAD</div>
    <div>No. Rekening 7196999501</div>
  </div>
  <script>
    function kembaliTanabrew(){
      var note = document.getElementById('back-note');
      try {
        window.close();
        setTimeout(function(){
          if (window.closed) return;
          if (window.history.length > 1) {
            window.history.back();
            return;
          }
          if (note) note.style.display = 'inline';
        }, 160);
      } catch (error) {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        if (note) note.style.display = 'inline';
      }
    }
  <\/script>
  ${script}
</body></html>`;
};

const Riwayat = () => {
  const { toast } = useToast();
  const { currentUser, userProfile } = useAuth();
  const { products } = useProducts();
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoice");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingMoreInvoices, setLoadingMoreInvoices] = useState(false);
  const [invoiceError, setInvoiceError] = useState(false);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [invoiceCursor, setInvoiceCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingStockMovements, setLoadingStockMovements] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [payStatusFilter, setPayStatusFilter] = useState<PayStatusFilter>("semua");
  const [printStatusFilter, setPrintStatusFilter] = useState<PrintStatusFilter>("semua");
  const [dateFilter, setDateFilter] = useState<DateFilter>("semua");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportPeriod, setReportPeriod] = useState<DateFilter>("bulan_ini");
  const [reportStartDate, setReportStartDate] = useState(todayInputValue());
  const [reportEndDate, setReportEndDate] = useState(todayInputValue());
  const [loadingReport, setLoadingReport] = useState<ReportType | null>(null);

  useEffect(() => {
    if (!actionNotice) return;

    const timer = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const showActionNotice = (title: string, description?: string) => {
    setActionNotice({ id: Date.now(), title, description });
  };

  const loadInvoices = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoadingInvoices(true);
        setInvoiceError(false);
      } else {
        setLoadingMoreInvoices(true);
      }

      try {
        const invoiceQuery = reset || !invoiceCursor
          ? query(collection(db, "invoices"), orderBy("created_at", "desc"), firestoreLimit(20))
          : query(collection(db, "invoices"), orderBy("created_at", "desc"), startAfter(invoiceCursor), firestoreLimit(20));
        const snap = await getDocs(invoiceQuery);
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));

        setInvoices((prev) => (reset ? data : [...prev, ...data]));
        setInvoiceCursor(snap.docs[snap.docs.length - 1] || null);
        setHasMoreInvoices(snap.docs.length === 20);
      } catch {
        setInvoiceError(true);
        toast({ title: "Error", description: "Gagal memuat riwayat invoice.", variant: "destructive" });
      } finally {
        setLoadingInvoices(false);
        setLoadingMoreInvoices(false);
      }
    },
    [invoiceCursor, toast],
  );

  useEffect(() => {
    void loadInvoices(true);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "activity_logs"),
      (snap) => {
        const data = snap.docs.map((logDoc) => ({ id: logDoc.id, ...logDoc.data() } as ActivityLog));
        data.sort((a, b) => getDateValue(b.created_at) - getDateValue(a.created_at));
        setActivityLogs(data);
        setLoadingLogs(false);
      },
      () => {
        toast({ title: "Error", description: "Gagal memuat riwayat aktivitas.", variant: "destructive" });
        setLoadingLogs(false);
      },
    );

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "stock_movements"),
      (snap) => {
        const data = snap.docs.map((movementDoc) => ({ id: movementDoc.id, ...movementDoc.data() } as StockMovement));
        data.sort((a, b) => getDateValue(b.created_at) - getDateValue(a.created_at));
        setStockMovements(data);
        setLoadingStockMovements(false);
      },
      () => {
        toast({ title: "Error", description: "Gagal memuat riwayat mutasi stok.", variant: "destructive" });
        setLoadingStockMovements(false);
      },
    );

    return () => unsubscribe();
  }, [toast]);

  const filteredInvoices = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchesSearch = !keyword
        || (invoice.no_invoice || "").toLowerCase().includes(keyword)
        || (invoice.customer || "").toLowerCase().includes(keyword);
      const matchesPayStatus = payStatusFilter === "semua" || invoice.status === payStatusFilter;
      const matchesPrintStatus = printStatusFilter === "semua"
        || (printStatusFilter === "sudah" && invoice.is_printed === true)
        || (printStatusFilter === "belum" && invoice.is_printed !== true);
      const matchesDate = matchesDateFilter(invoice, dateFilter, startDate, endDate);

      return matchesSearch && matchesPayStatus && matchesPrintStatus && matchesDate;
    });
  }, [dateFilter, endDate, invoices, payStatusFilter, printStatusFilter, searchTerm, startDate]);

  const reportInvoices = useMemo(
    () => invoices.filter((invoice) => matchesDateFilter(invoice, reportPeriod, reportStartDate, reportEndDate)),
    [invoices, reportEndDate, reportPeriod, reportStartDate],
  );

  const reportSummary = useMemo(() => {
    const stokHabis = products.filter((product) => (product.total_stok || 0) === 0).length;
    const stokMenipis = products.filter((product) => (product.total_stok || 0) > 0 && (product.total_stok || 0) <= 3).length;

    return {
      totalInvoice: reportInvoices.length,
      totalPemasukan: reportInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
      invoiceBelumLunas: reportInvoices.filter((invoice) => invoice.status === "BELUM LUNAS").length,
      stokHabis,
      stokMenipis,
    };
  }, [products, reportInvoices]);

  const isAdmin = userProfile?.role === "admin";

  const handleSafeRefresh = useCallback(() => {
    window.setTimeout(() => window.location.reload(), 320);
  }, []);

  const resetInvoiceFilters = () => {
    setSearchTerm("");
    setPayStatusFilter("semua");
    setPrintStatusFilter("semua");
    setDateFilter("semua");
    setStartDate("");
    setEndDate("");
  };

  const getInvoiceFilterLabel = () => {
    const labels = [
      searchTerm.trim() ? `Pencarian: ${searchTerm.trim()}` : "",
      payStatusFilter !== "semua" ? `Status bayar: ${payStatusFilter}` : "",
      printStatusFilter !== "semua" ? `Status cetak: ${printStatusFilter === "sudah" ? "Sudah Dicetak" : "Belum Dicetak"}` : "",
      dateFilter !== "semua" ? `Tanggal: ${getPeriodLabel(dateFilter, startDate, endDate)}` : "",
    ].filter(Boolean);

    return labels.length ? labels.join(" | ") : "Semua invoice";
  };

  const fetchAllInvoicesForReport = async () => {
    const snap = await getDocs(collection(db, "invoices"));
    return snap.docs
      .map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice))
      .sort((a, b) => getInvoiceDateValue(b) - getInvoiceDateValue(a));
  };

  const getFilteredInvoiceReportData = (sourceInvoices: Invoice[]) => {
    const keyword = searchTerm.trim().toLowerCase();

    return sourceInvoices.filter((invoice) => {
      const matchesSearch = !keyword
        || (invoice.no_invoice || "").toLowerCase().includes(keyword)
        || (invoice.customer || "").toLowerCase().includes(keyword);
      const matchesPayStatus = payStatusFilter === "semua" || invoice.status === payStatusFilter;
      const matchesPrintStatus = printStatusFilter === "semua"
        || (printStatusFilter === "sudah" && invoice.is_printed === true)
        || (printStatusFilter === "belum" && invoice.is_printed !== true);
      const matchesDate = matchesDateFilter(invoice, dateFilter, startDate, endDate);

      return matchesSearch && matchesPayStatus && matchesPrintStatus && matchesDate;
    });
  };

  const getCombinedReportData = (sourceInvoices: Invoice[]) => {
    if (reportPeriod === "custom" && reportStartDate && reportEndDate && reportStartDate > reportEndDate) {
      throw new Error("Rentang tanggal tidak valid.");
    }

    return sourceInvoices.filter((invoice) => matchesDateFilter(invoice, reportPeriod, reportStartDate, reportEndDate));
  };

  const handlePrintInvoiceReport = async () => {
    const reportWindow = openReportWindow();
    if (!reportWindow) {
      toast({ title: "Error", description: "Gagal membuka jendela cetak. Izinkan pop-up untuk situs ini.", variant: "destructive" });
      return;
    }

    setLoadingReport("invoice");

    try {
      const reportData = getFilteredInvoiceReportData(await fetchAllInvoicesForReport());
      const ok = printInvoiceReport({
        invoices: reportData,
        periodLabel: dateFilter === "semua" ? "Semua Tanggal" : getPeriodLabel(dateFilter, startDate, endDate),
        filterLabel: getInvoiceFilterLabel(),
        printedBy: userProfile?.name || currentUser?.email || "-",
        roleLabel: formatRole(userProfile?.role),
      }, reportWindow);

      if (!ok) {
        toast({ title: "Error", description: "Gagal membuka jendela cetak laporan invoice.", variant: "destructive" });
      }
    } catch {
      writeReportError(reportWindow, "Gagal menyiapkan laporan invoice.");
      toast({ title: "Error", description: "Gagal menyiapkan laporan invoice.", variant: "destructive" });
    } finally {
      setLoadingReport(null);
    }
  };

  const handlePrintStockReport = () => {
    const reportWindow = openReportWindow();
    if (!reportWindow) {
      toast({ title: "Error", description: "Gagal membuka jendela cetak. Izinkan pop-up untuk situs ini.", variant: "destructive" });
      return;
    }

    setLoadingReport("stok");

    try {
      const ok = printStockReport({
        products,
        filterLabel: "Semua stok",
        printedBy: userProfile?.name || currentUser?.email || "-",
        roleLabel: formatRole(userProfile?.role),
      }, reportWindow);

      if (!ok) {
        toast({ title: "Error", description: "Gagal membuka jendela cetak laporan stok.", variant: "destructive" });
      }
    } catch {
      writeReportError(reportWindow, "Gagal menyiapkan laporan stok.");
      toast({ title: "Error", description: "Gagal menyiapkan laporan stok.", variant: "destructive" });
    } finally {
      setLoadingReport(null);
    }
  };

  const handlePrintCombinedReport = async () => {
    const reportWindow = openReportWindow();
    if (!reportWindow) {
      toast({ title: "Error", description: "Gagal membuka jendela cetak. Izinkan pop-up untuk situs ini.", variant: "destructive" });
      return;
    }

    setLoadingReport("gabungan");

    try {
      const reportData = getCombinedReportData(await fetchAllInvoicesForReport());
      const summary = {
        totalInvoice: reportData.length,
        totalPemasukan: reportData.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
        invoiceBelumLunas: reportData.filter((invoice) => invoice.status === "BELUM LUNAS").length,
        stokHabis: products.filter((product) => (product.total_stok || 0) === 0).length,
        stokMenipis: products.filter((product) => (product.total_stok || 0) > 0 && (product.total_stok || 0) <= 3).length,
      };

      const ok = printTanabrewReport({
        invoices: reportData,
        products,
        periodLabel: getPeriodLabel(reportPeriod, reportStartDate, reportEndDate),
        printedBy: userProfile?.name || currentUser?.email || "-",
        roleLabel: formatRole(userProfile?.role),
        summary,
      }, reportWindow);

      if (!ok) {
        toast({ title: "Error", description: "Gagal membuka jendela cetak laporan gabungan.", variant: "destructive" });
      }
    } catch (error) {
      const description = error instanceof Error && error.message
        ? error.message
        : "Gagal menyiapkan laporan gabungan.";
      writeReportError(reportWindow, description);
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setLoadingReport(null);
    }
  };

  const handleMarkInvoicePaid = async () => {
    if (!paymentTarget?.id) {
      toast({ title: "Error", description: "Data invoice tidak lengkap.", variant: "destructive" });
      return;
    }

    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat menandai invoice lunas.", variant: "destructive" });
      return;
    }

    setPayingInvoiceId(paymentTarget.id);

    try {
      await updateDoc(doc(db, "invoices", paymentTarget.id), {
        jumlah_dibayar: paymentTarget.total || 0,
        sisa: 0,
        status: "LUNAS",
        paid_at: serverTimestamp(),
        paid_by: userProfile.name,
        paid_by_uid: currentUser.uid,
        paid_by_role: userProfile.role,
        updated_at: serverTimestamp(),
      });

      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "UPDATE_PAYMENT_STATUS",
        targetType: "invoice",
        targetId: paymentTarget.id,
        targetName: paymentTarget.no_invoice,
        description: `Invoice ${paymentTarget.no_invoice} ditandai lunas oleh ${userProfile.name}.`,
      });

      const paidInvoice: Invoice = {
        ...paymentTarget,
        jumlah_dibayar: paymentTarget.total || 0,
        sisa: 0,
        status: "LUNAS",
        paid_at: new Date(),
        paid_by: userProfile.name,
        paid_by_uid: currentUser.uid,
        paid_by_role: userProfile.role,
        updated_at: new Date(),
      };

      setInvoices((prev) => prev.map((invoice) => (invoice.id === paidInvoice.id ? paidInvoice : invoice)));
      setSelectedInvoice((prev) => (prev?.id === paidInvoice.id ? paidInvoice : prev));
      setPaymentTarget(null);
      showActionNotice("Invoice berhasil ditandai lunas", `No Invoice: ${paidInvoice.no_invoice}`);
      toast({ title: "Berhasil", description: `Invoice ${paidInvoice.no_invoice} sudah LUNAS.` });
    } catch {
      toast({ title: "Error", description: "Gagal menandai invoice lunas.", variant: "destructive" });
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const updateInvoicePrintStatus = async (invoice: Invoice) => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat mencetak ulang invoice.", variant: "destructive" });
      return;
    }

    if (!invoice.id) {
      toast({ title: "Error", description: "Data invoice tidak lengkap.", variant: "destructive" });
      return;
    }

    try {
      await updateDoc(doc(db, "invoices", invoice.id), {
        is_printed: true,
        printed_at: serverTimestamp(),
        printed_by: userProfile.name,
        printed_by_uid: currentUser.uid,
        printed_by_role: userProfile.role,
        print_count: increment(1),
      });
      setInvoices((prev) =>
        prev.map((item) =>
          item.id === invoice.id
            ? {
                ...item,
                is_printed: true,
                printed_by: userProfile.name,
                printed_by_uid: currentUser.uid,
                printed_by_role: userProfile.role,
                print_count: (item.print_count || 0) + 1,
              }
            : item,
        ),
      );
    } catch {
      toast({ title: "Error", description: "Gagal memperbarui status cetak invoice.", variant: "destructive" });
      return;
    }

    try {
      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "PRINT_INVOICE",
        targetType: "invoice",
        targetId: invoice.id,
        targetName: invoice.no_invoice,
        description: `${userProfile.name} mencetak ulang invoice ${invoice.no_invoice}`,
      });
    } catch {
      toast({ title: "Perhatian", description: "Status cetak tersimpan, tetapi log aktivitas gagal dibuat." });
    }

    showActionNotice("Invoice diproses untuk dicetak", "Status cetak diperbarui");
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat mencetak ulang invoice.", variant: "destructive" });
      return;
    }

    const popup = window.open("", "_blank");
    if (popup) {
      popup.document.open();
      popup.document.write(buildInvoicePrintHtml(invoice, true));
      popup.document.close();
    } else {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.opacity = "0";
      document.body.appendChild(iframe);

      const idoc = iframe.contentWindow?.document;
      if (!idoc) {
        document.body.removeChild(iframe);
        toast({ title: "Error", description: "Gagal membuka cetak ulang", variant: "destructive" });
        return;
      }

      idoc.open();
      idoc.write(buildInvoicePrintHtml(invoice, false));
      idoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 700);
    }

    await updateInvoicePrintStatus(invoice);
  };

  const tabs = [
    { key: "invoice" as const, label: "Invoice", icon: FileText },
    { key: "stok" as const, label: "Stok", icon: Package },
    { key: "aktivitas" as const, label: "Aktivitas", icon: Activity },
  ];

  const renderItemRows = (items: InvoiceItem[]) =>
    items.map((item, idx) => (
      <tr key={`${item.nama_barang}-${idx}`} className="border-t border-border">
        <td className="px-2 py-2">{item.nama_barang}</td>
        <td className="px-2 py-2 text-right">{formatCurrency(item.harga)}</td>
        <td className="px-2 py-2 text-center">{item.jumlah}</td>
        <td className="px-2 py-2 text-right">{formatCurrency(item.subtotal)}</td>
      </tr>
    ));

  return (
    <>
    <PullToRefresh onRefresh={handleSafeRefresh} disabled={Boolean(selectedInvoice || paymentTarget)} />

    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      {actionNotice && (
        <AnimatedNotification
          key={actionNotice.id}
          title={actionNotice.title}
          description={actionNotice.description}
        />
      )}

      <h1 className="text-lg font-bold text-primary mb-4">Riwayat</h1>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "invoice" && (
        <div key="invoice" className="tanabrew-tab-panel space-y-3">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-primary">Cetak / Export Laporan</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Laporan bisa dicetak atau disimpan sebagai PDF dari browser.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Periode Laporan Gabungan</label>
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as DateFilter)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="bulan_ini">Bulan Ini</option>
                <option value="hari_ini">Hari Ini</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {reportPeriod === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handlePrintInvoiceReport}
                disabled={loadingReport !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Printer size={16} />
                {loadingReport === "invoice" ? "Menyiapkan Laporan..." : "Cetak Laporan Invoice"}
              </button>
              <button
                onClick={handlePrintStockReport}
                disabled={loadingReport !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Printer size={16} />
                {loadingReport === "stok" ? "Menyiapkan Laporan..." : "Cetak Laporan Stok"}
              </button>
              <button
                onClick={handlePrintCombinedReport}
                disabled={loadingReport !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Printer size={16} />
                {loadingReport === "gabungan" ? "Menyiapkan Laporan..." : "Cetak Laporan Gabungan"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-primary/5 px-3 py-2">
                <p className="text-muted-foreground">Total Invoice</p>
                <p className="font-bold text-primary">{reportSummary.totalInvoice}</p>
              </div>
              <div className="rounded-lg bg-primary/5 px-3 py-2">
                <p className="text-muted-foreground">Total Pemasukan</p>
                <p className="font-bold text-primary">{formatCurrency(reportSummary.totalPemasukan)}</p>
              </div>
              <div className="rounded-lg bg-primary/5 px-3 py-2">
                <p className="text-muted-foreground">Belum Lunas</p>
                <p className="font-bold text-destructive">{reportSummary.invoiceBelumLunas}</p>
              </div>
              <div className="rounded-lg bg-primary/5 px-3 py-2">
                <p className="text-muted-foreground">Stok Bermasalah</p>
                <p className="font-bold text-primary">{reportSummary.stokHabis + reportSummary.stokMenipis}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari no invoice atau customer"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={payStatusFilter}
                onChange={(e) => setPayStatusFilter(e.target.value as PayStatusFilter)}
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="semua">Semua Bayar</option>
                <option value="LUNAS">Lunas</option>
                <option value="BELUM LUNAS">Belum Lunas</option>
              </select>
              <select
                value={printStatusFilter}
                onChange={(e) => setPrintStatusFilter(e.target.value as PrintStatusFilter)}
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="semua">Semua Cetak</option>
                <option value="belum">Belum Dicetak</option>
                <option value="sudah">Sudah Dicetak</option>
              </select>
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="semua">Semua Tanggal</option>
              <option value="hari_ini">Hari Ini</option>
              <option value="bulan_ini">Bulan Ini</option>
              <option value="custom">Custom</option>
            </select>
            {dateFilter === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={resetInvoiceFilters}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground"
              >
                <RotateCcw size={15} />
                Reset Filter
              </button>
            </div>
          </div>

          {loadingInvoices ? (
            <>
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
            </>
          ) : invoiceError ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-destructive">Gagal memuat riwayat invoice.</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Tidak ada invoice sesuai filter.</p>
          ) : (
            filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="tanabrew-card-enter rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary truncate">{invoice.no_invoice || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate">Customer: {invoice.customer || "-"}</p>
                  </div>
                  <span className={`text-xs font-bold ${statusClass(invoice.status)}`}>{invoice.status || "-"}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">{formatCurrency(invoice.total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tanggal</p>
                    <p className="font-semibold text-foreground">{formatInvoiceDate(invoice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dibuat Oleh</p>
                    <p className="font-semibold text-foreground truncate">{invoice.dibuat_oleh || "Tidak diketahui"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Role Pembuat</p>
                    <p className="font-semibold text-foreground">{formatRole(invoice.dibuat_oleh_role)}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status Cetak</span>
                    <span className={`font-semibold ${invoice.is_printed ? "text-primary" : "text-destructive"}`}>
                      {invoice.is_printed ? "Sudah Dicetak" : "Belum Dicetak"}
                    </span>
                  </div>
                  {invoice.is_printed && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Dicetak Oleh</span>
                        <span className="font-semibold text-foreground truncate">{invoice.printed_by || "Tidak diketahui"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Waktu Cetak</span>
                        <span className="font-semibold text-foreground">{formatDate(invoice.printed_at)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Jumlah Cetak</span>
                        <span className="font-semibold text-foreground">{invoice.print_count || 0}x</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedInvoice(invoice)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Eye size={14} />
                    Lihat
                  </button>
                  <button
                    onClick={() => handlePrintInvoice(invoice)}
                    disabled={!isAdmin}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={14} />
                    Cetak Ulang
                  </button>
                </div>
                {isAdmin && invoice.status === "BELUM LUNAS" && (
                  <button
                    onClick={() => setPaymentTarget(invoice)}
                    disabled={payingInvoiceId === invoice.id}
                    className="mt-2 w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {payingInvoiceId === invoice.id ? "Memproses..." : "Tandai Lunas"}
                  </button>
                )}
                {!isAdmin && (
                  <p className="mt-2 text-center text-xs text-destructive">Hanya admin yang dapat mencetak ulang invoice.</p>
                )}
              </div>
            ))
          )}

          {!loadingInvoices && hasMoreInvoices && (
            <button
              onClick={() => loadInvoices(false)}
              disabled={loadingMoreInvoices}
              className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {loadingMoreInvoices ? "Memuat..." : "Muat Lagi"}
            </button>
          )}
          {!loadingInvoices && !hasMoreInvoices && invoices.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">Semua data sudah ditampilkan.</p>
          )}
        </div>
      )}

      {activeTab === "stok" && (
        <div key="stok" className="tanabrew-tab-panel space-y-3">
          {loadingStockMovements ? (
            <>
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
              <CardSkeleton lines={4} />
            </>
          ) : stockMovements.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Belum ada mutasi stok.</p>
          ) : (
            stockMovements.map((movement) => {
              const quantity = movement.quantity_change || 0;
              const isPositive = quantity >= 0;

              return (
              <div key={movement.id} className="tanabrew-card-enter rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">{movementLabel(movement.movement_type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(movement.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                    isPositive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                  }`}>
                    {isPositive ? "+" : ""}{quantity}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p><span className="text-muted-foreground">Produk:</span><br /><span className="font-semibold">{movement.product_name || "-"}</span></p>
                  <p><span className="text-muted-foreground">Lokasi:</span><br /><span className="font-semibold">{movement.location || "-"}</span></p>
                  <p><span className="text-muted-foreground">Stok Sebelum:</span><br /><span className="font-semibold">{movement.stock_before ?? "-"}</span></p>
                  <p><span className="text-muted-foreground">Stok Sesudah:</span><br /><span className="font-semibold">{movement.stock_after ?? "-"}</span></p>
                  <p><span className="text-muted-foreground">User:</span><br /><span className="font-semibold">{movement.user_name || "Tidak diketahui"}</span></p>
                  <p><span className="text-muted-foreground">Role:</span><br /><span className="font-semibold">{formatRole(movement.user_role)}</span></p>
                </div>
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{movement.description || "-"}</p>
              </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "aktivitas" && (
        <div key="aktivitas" className="tanabrew-tab-panel space-y-3">
          {loadingLogs ? (
            <>
              <CardSkeleton lines={3} />
              <CardSkeleton lines={3} />
              <CardSkeleton lines={3} />
            </>
          ) : activityLogs.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="tanabrew-card-enter rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary">{actionLabel(log.action)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    {formatRole(log.user_role)}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <p><span className="text-muted-foreground">User:</span> <span className="font-semibold">{log.user_name || "Tidak diketahui"}</span></p>
                  <p><span className="text-muted-foreground">Target:</span> <span className="font-semibold">{log.target_type || "-"} - {log.target_name || "-"}</span></p>
                  <p className="text-muted-foreground">{log.description || "-"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto tanabrew-card-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Detail Invoice</h2>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 rounded-full hover:bg-muted">
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex justify-between items-start gap-3 mb-4">
                <img
                  src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png"
                  alt="Tanabrew"
                  style={{ width: 120, height: "auto" }}
                />
                <div className="text-right space-y-1 text-xs">
                  <p><span className="text-muted-foreground">No Invoice:</span> {selectedInvoice.no_invoice}</p>
                  <p><span className="text-muted-foreground">Tanggal:</span> {formatInvoiceDate(selectedInvoice)}</p>
                  <p><span className="text-muted-foreground">Customer:</span> {selectedInvoice.customer}</p>
                  <p><span className="text-muted-foreground">Nomor Rekening:</span> {selectedInvoice.nomor_rekening || "-"}</p>
                </div>
              </div>

              <h3 className="text-center text-lg font-bold text-primary mb-4">INVOICE</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs mb-4">
                  <thead>
                    <tr className="bg-primary/50 text-primary-foreground">
                      <th className="px-2 py-2 text-left font-medium">Nama Barang</th>
                      <th className="px-2 py-2 text-right font-medium">Harga</th>
                      <th className="px-2 py-2 text-center font-medium">Jumlah</th>
                      <th className="px-2 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>{renderItemRows(selectedInvoice.items || [])}</tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm border-t border-border pt-3 mb-4">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(selectedInvoice.subtotal)}</span></div>
                {(selectedInvoice.diskon || 0) > 0 && (
                  <div className="flex justify-between"><span>Diskon</span><span>- {formatCurrency(selectedInvoice.diskon)}</span></div>
                )}
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(selectedInvoice.total)}</span></div>
                <div className="flex justify-between"><span>Jumlah Dibayar</span><span>{formatCurrency(selectedInvoice.jumlah_dibayar)}</span></div>
                <div className="flex justify-between"><span>Sisa Pembayaran</span><span>{formatCurrency(selectedInvoice.sisa)}</span></div>
                <div className="flex justify-between font-bold">
                  <span>Status</span>
                  <span className={statusClass(selectedInvoice.status)}>{selectedInvoice.status}</span>
                </div>
                <div className="flex justify-between"><span>Dibuat Oleh</span><span>{selectedInvoice.dibuat_oleh || "Tidak diketahui"}</span></div>
                {selectedInvoice.paid_by && (
                  <>
                    <div className="flex justify-between"><span>Dilunasi Oleh</span><span>{selectedInvoice.paid_by}</span></div>
                    <div className="flex justify-between"><span>Waktu Lunas</span><span>{formatDate(selectedInvoice.paid_at)}</span></div>
                  </>
                )}
              </div>

              <div className="rounded-lg bg-muted px-3 py-2 text-xs mb-4">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status Cetak</span>
                  <span className={`font-semibold ${selectedInvoice.is_printed ? "text-primary" : "text-destructive"}`}>
                    {selectedInvoice.is_printed ? "Sudah Dicetak" : "Belum Dicetak"}
                  </span>
                </div>
                {selectedInvoice.is_printed && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Dicetak Oleh</span>
                      <span className="font-semibold text-foreground">{selectedInvoice.printed_by || "Tidak diketahui"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Waktu Cetak</span>
                      <span className="font-semibold text-foreground">{formatDate(selectedInvoice.printed_at)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Jumlah Cetak</span>
                      <span className="font-semibold text-foreground">{selectedInvoice.print_count || 0}x</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Instruksi Pembayaran</p>
                {paymentInstructions.map((line, idx) => (
                  <p key={idx} className={idx === 2 ? "mt-2" : ""}>{line}</p>
                ))}
              </div>
            </div>

            <button
              onClick={() => handlePrintInvoice(selectedInvoice)}
              disabled={!isAdmin}
              className="mt-4 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
              Cetak Ulang
            </button>
            {!isAdmin && (
              <p className="mt-2 text-center text-xs text-destructive">Hanya admin yang dapat mencetak ulang invoice.</p>
            )}
            {isAdmin && selectedInvoice.status === "BELUM LUNAS" && (
              <button
                onClick={() => setPaymentTarget(selectedInvoice)}
                disabled={payingInvoiceId === selectedInvoice.id}
                className="mt-2 w-full rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {payingInvoiceId === selectedInvoice.id ? "Memproses..." : "Tandai Lunas"}
              </button>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(paymentTarget)}
        title="Tandai invoice sebagai lunas?"
        description="Status pembayaran invoice ini akan diubah menjadi LUNAS dan sisa pembayaran menjadi Rp 0."
        confirmLabel="Tandai Lunas"
        loading={Boolean(paymentTarget?.id && payingInvoiceId === paymentTarget.id)}
        onCancel={() => setPaymentTarget(null)}
        onConfirm={() => void handleMarkInvoicePaid()}
      />
    </div>
    </>
  );
};

export default Riwayat;
