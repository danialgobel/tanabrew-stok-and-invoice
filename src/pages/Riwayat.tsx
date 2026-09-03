import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { Activity, Download, Edit, Eye, FileText, Package, Printer, RotateCcw, Search, Trash2, X, Smartphone, Receipt, Share2, Copy, ExternalLink } from "lucide-react";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import { triggerHaptic } from "@/lib/haptics";
import AnimatedNotification from "@/components/AnimatedNotification";
import ConfirmDialog from "@/components/ConfirmDialog";
import PullToRefresh from "@/components/PullToRefresh";
import { CardSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { sendTanabrewNotification } from "@/lib/notificationSender";
import { openReportWindow, printInvoiceReport, printStockReport, printTanabrewReport, writeReportError } from "@/lib/reportPrint";
import { deleteInvoiceWithStock } from "@/lib/invoiceNumber";
import { downloadCsv, monthFileStamp } from "@/lib/csvExport";
import { generateInvoicePdfBlob } from "@/lib/invoicePdfGenerator";
import { sendInvoiceToWhatsApp } from "@/lib/whatsappClient";
import type { ActivityLog, Invoice, InvoiceItem, StockMovement } from "@/types";
import {
  type DateFilter,
  todayInputValue,
  formatFullDate,
  formatMonthYear,
  formatDisplayDate,
  formatInvoiceDate,
  formatDateTime,
  getDateValue,
  getInvoiceDateValue,
  getDateRange,
  matchesDateFilter,
  getPeriodLabel,
} from "@/lib/dateUtils";

type ActiveTab = "invoice" | "stok" | "aktivitas";
type PayStatusFilter = "semua" | "LUNAS" | "BELUM LUNAS";
type PrintStatusFilter = "semua" | "belum" | "sudah";
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

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatRole = (role?: string) => {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return role || "Tidak diketahui";
};

const formatDate = (value: unknown) => formatDateTime(value);

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

  const detectedPhoneMatch = invoice.customer?.match(/(?:08|\+62|62)[0-9]{8,13}/);
  let cleanDetectedPhone = detectedPhoneMatch ? detectedPhoneMatch[0].replace(/[^0-9]/g, "") : "";
  if (cleanDetectedPhone.startsWith("0")) {
    cleanDetectedPhone = "62" + cleanDetectedPhone.slice(1);
  }

  const itemsSummary = (invoice.items || [])
    .map((item) => `• ${item.nama_barang} (${item.jumlah} pcs) - Rp ${formatCurrency(item.subtotal)}`)
    .join("\n");

  const waMsg = `*FAKTUR / INVOICE TANABREW*\n` +
    `No. Invoice: ${invoice.no_invoice}\n` +
    `Tanggal: ${formatInvoiceDate(invoice)}\n` +
    `Customer: ${invoice.customer}\n` +
    `Gudang: ${invoice.stock_location || "Jogja"}\n\n` +
    `*Rincian Belanja:*\n${itemsSummary}\n\n` +
    `*Total Tagihan: Rp ${formatCurrency(invoice.total)}*\n` +
    `Jumlah Dibayar: Rp ${formatCurrency(invoice.jumlah_dibayar)}\n` +
    `Status: *${invoice.status}*\n\n` +
    `Terima kasih telah mempercayakan kebutuhan kopi Anda di Tanabrew! ☕`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.no_invoice)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color:#111; margin:0; padding:16px; font-size:13px; }
  .print-toolbar { position:sticky; top:0; z-index:20; display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:-16px -16px 16px; padding:10px 16px; background:#f1f8e9; border-bottom:1px solid #c8e6c9; }
  .back-button { min-height:42px; border:0; border-radius:10px; background:#2E7D32; color:#fff; padding:0 14px; font-size:14px; font-weight:700; cursor:pointer; }
  .back-button:active { transform:translateY(1px); }
  .wa-button { min-height:42px; border:0; border-radius:10px; background:#128C7E; color:#fff; padding:0 14px; font-size:14px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
  .wa-button:active { transform:translateY(1px); }
  .print-btn { min-height:42px; border:1px solid #a5d6a7; border-radius:10px; background:#fff; color:#2E7D32; padding:0 14px; font-size:14px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
  .print-btn:active { transform:translateY(1px); }
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
    <button type="button" class="back-button" onclick="kembaliTanabrew()">&larr; Kembali ke Riwayat</button>
    <button type="button" class="wa-button" onclick="kirimKeWhatsApp()">📱 Kirim ke WhatsApp</button>
    <button type="button" class="print-btn" onclick="window.print()">🖨️ Cetak Ulang</button>
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
      if (window.AndroidBridge && window.AndroidBridge.closePrintPreview) {
        window.AndroidBridge.closePrintPreview();
        return;
      }
      try {
        if (window.opener) {
          window.close();
          return;
        }
        if (window.history && window.history.length > 1) {
          window.history.back();
          return;
        }
      } catch (e) {}
      window.location.href = '/riwayat';
    }

    function kirimKeWhatsApp(){
      var msg = ${JSON.stringify(waMsg)};
      var phone = ${JSON.stringify(cleanDetectedPhone)};
      if (window.AndroidBridge && window.AndroidBridge.onWhatsAppShareRequested) {
        window.AndroidBridge.onWhatsAppShareRequested(msg, phone);
        return;
      }
      var target = phone ? "https://wa.me/" + phone + "?text=" + encodeURIComponent(msg) : "https://wa.me/?text=" + encodeURIComponent(msg);
      window.location.href = target;
    }
  <\/script>
  ${script}
</body></html>`;
};

const Riwayat = () => {
  const { toast } = useToast();
  const { currentUser, userProfile } = useAuth();
  const { products } = useProducts();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const isOwner = userProfile?.role === "owner";
  const isDev = userProfile?.role === "webdev";
  const isOwnerOrDev = isOwner || isDev;
  const isAdmin = userProfile?.role === "admin" || isOwnerOrDev;
  const canPrint = isAdmin;

  const initialTab = useMemo<ActiveTab>(() => {
    const paramTab = searchParams.get("tab") as ActiveTab | null;
    if (paramTab === "invoice" || paramTab === "stok" || paramTab === "aktivitas") {
      return paramTab;
    }
    const stateTab = (location.state as { tab?: ActiveTab } | null)?.tab;
    if (stateTab === "invoice" || stateTab === "stok" || stateTab === "aktivitas") {
      return stateTab;
    }
    return "invoice";
  }, [searchParams, location.state]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  useEffect(() => {
    const paramTab = searchParams.get("tab") as ActiveTab | null;
    if (paramTab === "invoice" || paramTab === "stok" || paramTab === "aktivitas") {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  };

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
  // Desktop: klik kartu → update kolom kanan (tidak buka modal)
  const [desktopSelectedInvoice, setDesktopSelectedInvoice] = useState<Invoice | null>(null);
  // Mobile: klik kartu/Detail → buka popup modal
  const [mobileModalInvoice, setMobileModalInvoice] = useState<Invoice | null>(null);
  // Compatibility alias agar kode existing (delete/payment) tetap berjalan
  const selectedInvoice = mobileModalInvoice;
  const setSelectedInvoice = setMobileModalInvoice;
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const isDesktop = () => typeof window !== "undefined" && window.innerWidth >= 1024;

  const handleSelectInvoice = (invoice: Invoice) => {
    triggerHaptic(8);
    if (isDesktop()) {
      // Desktop: tampilkan di kolom kanan, scroll ke atas jika perlu
      setDesktopSelectedInvoice(invoice);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
    } else {
      // Mobile/Tablet: buka popup modal bottom-sheet instan tanpa lompat scroll
      setMobileModalInvoice(invoice);
    }
  };
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
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
  const [sendingWaInvoiceId, setSendingWaInvoiceId] = useState<string | null>(null);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<string | null>(null);
  const [waShareInvoice, setWaShareInvoice] = useState<Invoice | null>(null);
  const [waPhone, setWaPhone] = useState("");
  const [waCustomText, setWaCustomText] = useState("");
  const [sharingPdf, setSharingPdf] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!actionNotice) return;

    const timer = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const showActionNotice = (title: string, description?: string) => {
    setActionNotice({ id: Date.now(), title, description });
  };

  const sendInvoiceNotification = (
    type: "CREATE_INVOICE" | "PRINT_INVOICE" | "UPDATE_PAYMENT_STATUS",
    invoice: Invoice,
  ) => {
    if (!currentUser || !userProfile || !invoice.id) return;

    void sendTanabrewNotification(
      {
        type,
        invoiceId: invoice.id,
        invoiceNumber: invoice.no_invoice,
        customer: invoice.customer,
        total: invoice.total || 0,
        actorName: userProfile.name,
        actorRole: userProfile.role === "owner" ? "owner" : userProfile.role === "admin" ? "admin" : "staff",
      },
      currentUser,
    ).catch((error) => {
      console.error("Gagal mengirim notifikasi invoice", error);
      toast({ title: "Perhatian", description: "Invoice berhasil diproses, tetapi notifikasi gagal dikirim." });
    });
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
          ? query(collection(db, "invoices"), orderBy("created_at", "desc"), firestoreLimit(60))
          : query(collection(db, "invoices"), orderBy("created_at", "desc"), startAfter(invoiceCursor), firestoreLimit(60));
        const snap = await getDocs(invoiceQuery);
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));

        setInvoices((prev) => (reset ? data : [...prev, ...data]));
        setInvoiceCursor(snap.docs[snap.docs.length - 1] || null);
        setHasMoreInvoices(snap.docs.length === 60);
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
        setActivityLogs(data.slice(0, 100));
        setLoadingLogs(false);
      },
      () => {
        setLoadingLogs(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "stock_movements"),
      (snap) => {
        const data = snap.docs.map((movementDoc) => ({ id: movementDoc.id, ...movementDoc.data() } as StockMovement));
        data.sort((a, b) => getDateValue(b.created_at) - getDateValue(a.created_at));
        setStockMovements(data.slice(0, 100));
        setLoadingStockMovements(false);
      },
      () => {
        setLoadingStockMovements(false);
      },
    );

    return () => unsubscribe();
  }, []);

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

  const navigate = useNavigate();

  const handleSafeRefresh = useCallback(() => {
    triggerHaptic(10);
    void loadInvoices(true);
  }, [loadInvoices]);

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
      reportPeriod !== "semua" ? `Periode: ${getPeriodLabel(reportPeriod, reportStartDate, reportEndDate)}` : "",
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
      // Explicitly filter by reportPeriod and report dates selected in the report card
      const matchesDate = matchesDateFilter(invoice, reportPeriod, reportStartDate, reportEndDate);

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
        periodLabel: getPeriodLabel(reportPeriod, reportStartDate, reportEndDate),
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

  const handleExportInvoiceCsv = async () => {
    setLoadingReport("invoice");
    try {
      const reportData = getFilteredInvoiceReportData(await fetchAllInvoicesForReport());
      const filename = `Laporan-Invoice-${reportPeriod}-${monthFileStamp()}.csv`;
      const headers = [
        "No Invoice",
        "Tanggal",
        "Customer",
        "Subtotal",
        "Diskon",
        "Total",
        "Dibayar",
        "Sisa",
        "Status Bayar",
        "Status Cetak",
        "Dibuat Oleh",
      ];
      const rows = reportData.map((inv) => [
        inv.no_invoice || "-",
        formatInvoiceDate(inv),
        inv.customer || "-",
        inv.subtotal || 0,
        inv.diskon || 0,
        inv.total || 0,
        inv.jumlah_dibayar || 0,
        inv.sisa || 0,
        inv.status || "-",
        inv.is_printed ? "Sudah Dicetak" : "Belum Dicetak",
        inv.dibuat_oleh || "-",
      ]);

      downloadCsv(filename, headers, rows);
      toast({ title: "Berhasil", description: `Laporan invoice berhasil di-export (${reportData.length} data)` });
    } catch (err) {
      toast({ title: "Error", description: "Gagal mengeksport CSV laporan invoice.", variant: "destructive" });
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

  const handleExportStockCsv = () => {
    try {
      const filename = `Laporan-Stok-${monthFileStamp()}.csv`;
      const headers = ["Nama Barang", "Stok Jogja", "Stok Lombok", "Total Stok", "Harga", "Status Stok"];
      const rows = products.map((p) => [
        p.nama_barang || "-",
        p.stok_jogja || 0,
        p.stok_lombok || 0,
        p.total_stok || 0,
        p.harga || 0,
        getStockStatus(p.total_stok),
      ]);
      downloadCsv(filename, headers, rows);
      toast({ title: "Berhasil", description: `Laporan stok berhasil di-export (${products.length} produk)` });
    } catch {
      toast({ title: "Error", description: "Gagal mengeksport CSV laporan stok.", variant: "destructive" });
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

  const handleDeleteInvoice = async () => {
    if (!deleteTarget?.id) {
      toast({ title: "Error", description: "Data invoice tidak ditemukan.", variant: "destructive" });
      return;
    }

    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (!isOwner) {
      toast({ title: "Akses Ditolak", description: "Hanya Owner yang berhak menghapus invoice.", variant: "destructive" });
      return;
    }

    setDeletingInvoiceId(deleteTarget.id);

    try {
      const res = await deleteInvoiceWithStock({
        invoiceId: deleteTarget.id,
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
      });

      setInvoices((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (selectedInvoice?.id === deleteTarget.id) {
        setSelectedInvoice(null);
      }
      setDeleteTarget(null);
      showActionNotice("Invoice berhasil dihapus", `No: ${res.noInvoice} - Stok telah dikembalikan`);
      toast({ title: "Berhasil", description: `Invoice ${res.noInvoice} berhasil dihapus dan stok barang telah dikembalikan.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus invoice.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDeletingInvoiceId(null);
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

    if (userProfile.role !== "admin" && userProfile.role !== "owner") {
      toast({ title: "Error", description: "Hanya admin/owner yang dapat menandai invoice lunas.", variant: "destructive" });
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
      sendInvoiceNotification("UPDATE_PAYMENT_STATUS", paidInvoice);
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

    if (userProfile.role !== "admin" && userProfile.role !== "owner") {
      toast({ title: "Error", description: "Hanya admin/owner yang dapat mencetak ulang invoice.", variant: "destructive" });
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
    sendInvoiceNotification("PRINT_INVOICE", invoice);

    // Otomatis kirim PDF invoice ke WhatsApp Grup
    void handleSendWhatsAppInvoice(invoice, false);
  };

  const openWhatsAppModal = (invoice: Invoice) => {
    triggerHaptic(10);
    setWaShareInvoice(invoice);

    // Deteksi nomor telepon jika tertulis di nama customer (contoh: "Budi (08123456789)")
    let detectedPhone = "";
    const match = invoice.customer?.match(/(?:08|\+62|62)[0-9]{8,13}/);
    if (match) {
      detectedPhone = match[0];
    }
    setWaPhone(detectedPhone);

    const itemsSummary = (invoice.items || [])
      .map((item) => `• ${item.nama_barang} (${item.jumlah} pcs) - Rp ${formatCurrency(item.subtotal)}`)
      .join("\n");

    const msg = `*FAKTUR / INVOICE TANABREW*\n` +
      `No. Invoice: ${invoice.no_invoice}\n` +
      `Tanggal: ${formatInvoiceDate(invoice)}\n` +
      `Customer: ${invoice.customer}\n` +
      `Gudang: ${invoice.stock_location || "Jogja"}\n\n` +
      `*Rincian Belanja:*\n${itemsSummary}\n\n` +
      `*Total Tagihan: Rp ${formatCurrency(invoice.total)}*\n` +
      `Jumlah Dibayar: Rp ${formatCurrency(invoice.jumlah_dibayar)}\n` +
      `Status: *${invoice.status}*\n\n` +
      `Terima kasih telah mempercayakan kebutuhan kopi Anda di Tanabrew! ☕`;

    setWaCustomText(msg);
  };

  const handleDirectWhatsAppSend = () => {
    if (!waShareInvoice) return;
    triggerHaptic(10);
    let cleanPhone = waPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    }
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waCustomText)}`
      : `https://wa.me/?text=${encodeURIComponent(waCustomText)}`;
    window.open(url, "_blank");
  };

  const handleSharePdfInvoice = (invoice: Invoice) => {
    triggerHaptic(10);
    try {
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
          toast({ title: "Error", description: "Gagal membuka halaman dokumen", variant: "destructive" });
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

      toast({
        title: "Dokumen PDF Siap",
        description: "Halaman dokumen terbuka. Anda dapat mencetak atau membagikan langsung ke aplikasi WhatsApp.",
      });
      void updateInvoicePrintStatus(invoice);
    } catch (err) {
      console.warn("Error sharing PDF via print preview:", err);
      toast({ title: "Gagal", description: "Gagal membuka dokumen cetak.", variant: "destructive" });
    }
  };

  const handleCopyWaText = async () => {
    try {
      await navigator.clipboard.writeText(waCustomText);
      setCopiedText(true);
      toast({ title: "Teks Disalin", description: "Format rincian invoice berhasil disalin ke clipboard." });
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast({ title: "Gagal Menyalin", description: "Gagal menyalin teks rincian.", variant: "destructive" });
    }
  };

  const handleDownloadInvoicePdf = async () => {
    if (!waShareInvoice) return;
    try {
      const { base64, fileName } = await generateInvoicePdfBlob(waShareInvoice);
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Unduhan Berhasil", description: `File ${fileName} berhasil disimpan.` });
    } catch {
      toast({ title: "Gagal Mengunduh", description: "Kendala memproses dokumen PDF.", variant: "destructive" });
    }
  };

  const handleSendWhatsAppInvoice = async (invoice: Invoice, force = true) => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin" && userProfile.role !== "owner" && userProfile.role !== "webdev") {
      toast({ title: "Akses Ditolak", description: "Hanya Admin/Owner/Developer yang dapat mengirim invoice ke WhatsApp.", variant: "destructive" });
      return;
    }

    if (!invoice.id) return;
    setSendingWaInvoiceId(invoice.id);

    try {
      const { base64, fileName } = await generateInvoicePdfBlob(invoice);
      const result = await sendInvoiceToWhatsApp(currentUser, {
        invoice,
        pdfBase64: base64,
        fileName,
        forceSend: force,
      });

      if (result.alreadySent) {
        toast({ title: "Info WhatsApp", description: `Invoice ${invoice.no_invoice} sudah pernah dikirim sebelumnya.` });
      } else {
        toast({
          title: "WhatsApp Terkirim",
          description: `PDF invoice ${invoice.no_invoice} berhasil dikirim ke grup ${result.groupName || "WhatsApp"}.`,
        });
      }

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? {
                ...inv,
                whatsapp_status: {
                  status: "SENT",
                  group_name: result.groupName || "Grup WhatsApp",
                  sent_at: new Date(),
                } as any,
              }
            : inv
        )
      );
    } catch (err: any) {
      console.warn("Gagal mengirim invoice ke WhatsApp:", err);
      toast({
        title: "Gagal Mengirim WhatsApp",
        description: err.message || "Pastikan WhatsApp service aktif.",
        variant: "destructive",
      });
    } finally {
      setSendingWaInvoiceId(null);
    }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    if (!invoice.id || printingInvoiceId) return;
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (!canPrint) {
      toast({ title: "Error", description: "Hanya Admin, Owner, atau Developer yang dapat mencetak ulang invoice.", variant: "destructive" });
      return;
    }

    setPrintingInvoiceId(invoice.id);
    try {
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
    } catch (err) {
      console.warn("Print error:", err);
      toast({ title: "Error", description: "Gagal memproses cetak ulang invoice.", variant: "destructive" });
    } finally {
      setPrintingInvoiceId(null);
    }
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

  // Desktop: hanya tampilkan preview jika user secara eksplisit mengklik kartu
  const activeSelectedInvoice = desktopSelectedInvoice;

  const renderInvoiceDocumentCard = (invoice: Invoice, showClose = false) => (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Detail Dokumen Invoice</h2>
        </div>
        {showClose && (
          <button 
            type="button"
            onClick={() => setSelectedInvoice(null)} 
            className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border/80 p-4 bg-background/60">
        <div className="flex justify-between items-start gap-3 mb-4">
          <img
            src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png"
            alt="Tanabrew"
            style={{ width: 120, height: "auto" }}
          />
          <div className="text-right space-y-1 text-xs">
            <p><span className="text-muted-foreground">No Invoice:</span> <span className="font-mono font-bold text-primary">{invoice.no_invoice}</span></p>
            <p><span className="text-muted-foreground">Tanggal:</span> {formatInvoiceDate(invoice)}</p>
            <p><span className="text-muted-foreground">Customer:</span> <span className="font-semibold text-foreground">{invoice.customer}</span></p>
            <p><span className="text-muted-foreground">Gudang:</span> <span className="font-semibold">{invoice.stock_location || "Jogja"}</span></p>
          </div>
        </div>

        <h3 className="text-center text-sm font-black text-primary mb-3 uppercase tracking-wider">INVOICE</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="bg-primary/15 text-primary">
                <th className="px-2.5 py-2 text-left font-bold rounded-l-lg">Nama Barang</th>
                <th className="px-2.5 py-2 text-right font-bold">Harga</th>
                <th className="px-2.5 py-2 text-center font-bold">Qty</th>
                <th className="px-2.5 py-2 text-right font-bold rounded-r-lg">Subtotal</th>
              </tr>
            </thead>
            <tbody>{renderItemRows(invoice.items || [])}</tbody>
          </table>
        </div>

        <div className="space-y-1.5 text-xs border-t border-border pt-3 mb-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {(invoice.diskon || 0) > 0 && (
            <div className="flex justify-between text-destructive"><span>Diskon</span><span>- {formatCurrency(invoice.diskon)}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border/60">
            <span>Total Tagihan</span>
            <span className="text-primary font-black text-base">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between"><span>Jumlah Dibayar</span><span>{formatCurrency(invoice.jumlah_dibayar)}</span></div>
          <div className="flex justify-between">
            <span>{invoice.sisa <= 0 ? "Kembalian" : "Sisa Piutang"}</span>
            <span className={`font-bold ${invoice.sisa <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {formatCurrency(Math.abs(invoice.sisa))}
            </span>
          </div>
          <div className="flex justify-between font-bold pt-1">
            <span>Status</span>
            <span className={`rounded-md px-2 py-0.5 text-[11px] ${statusClass(invoice.status)}`}>{invoice.status}</span>
          </div>
        </div>

        <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dibuat Oleh</span>
            <span className="font-semibold text-foreground">{invoice.dibuat_oleh || "Tidak diketahui"} ({formatRole(invoice.dibuat_oleh_role)})</span>
          </div>
          {invoice.is_printed && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dicetak Oleh</span>
              <span className="font-semibold text-primary">{invoice.printed_by || "Ya"} ({formatDate(invoice.printed_at)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handlePrintInvoice(invoice)}
            disabled={!isAdmin || printingInvoiceId === invoice.id}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Printer size={15} /> {printingInvoiceId === invoice.id ? "Menyiapkan..." : "Cetak Ulang PDF"}
          </button>
          <button
            type="button"
            onClick={() => openWhatsAppModal(invoice)}
            disabled={!isAdmin}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Smartphone size={15} /> Kirim WhatsApp
          </button>
        </div>

        {isAdmin && invoice.status === "BELUM LUNAS" && (
          <button
            type="button"
            onClick={() => setPaymentTarget(invoice)}
            disabled={payingInvoiceId === invoice.id}
            className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {payingInvoiceId === invoice.id ? "Memproses..." : "✓ Tandai Invoice Sebagai Lunas"}
          </button>
        )}

        {(isOwnerOrDev || (!invoice.is_printed && invoice.status !== "LUNAS")) && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate(`/cetak-invoice?edit=${invoice.id}`)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer"
            >
              <Edit size={14} /> Edit Invoice
            </button>
            {isOwnerOrDev && (
              <button
                type="button"
                onClick={() => {
                  const target = invoice;
                  setSelectedInvoice(null);
                  setDeleteTarget(target);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 size={14} /> Hapus Invoice
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <PullToRefresh onRefresh={handleSafeRefresh} disabled={Boolean(selectedInvoice || paymentTarget)} />

    <div className="px-4 sm:px-6 lg:px-8 pb-28 sm:pb-32 pt-4 lg:pt-8 max-w-lg lg:max-w-7xl mx-auto">
      {actionNotice && (
        <AnimatedNotification
          key={actionNotice.id}
          title={actionNotice.title}
          description={actionNotice.description}
        />
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-primary">Riwayat Transaksi & Mutasi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Laporan lengkap penjualan invoice, mutasi stok antar cabang, dan log audit aktivitas tim.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
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
        <div key="invoice" className="tanabrew-tab-panel">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Master List Column (Desktop 5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-primary">Cetak / Export Laporan</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Filter periode di bawah ini berlaku untuk Cetak PDF maupun Export CSV.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Periode Laporan</label>
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as DateFilter)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="bulan_ini">Bulan Ini</option>
                    <option value="hari_ini">Hari Ini</option>
                    <option value="custom">Pilih Rentang Tanggal (Custom)</option>
                    <option value="semua">Semua Tanggal</option>
                  </select>
                </div>
                {reportPeriod === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Dari Tanggal</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Sampai Tanggal</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePrintInvoiceReport}
                      disabled={loadingReport !== null}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Printer size={15} />
                      {loadingReport === "invoice" ? "Menyiapkan..." : "Cetak Invoice"}
                    </button>
                    <button
                      onClick={handleExportInvoiceCsv}
                      disabled={loadingReport !== null}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Download size={15} />
                      Export CSV Invoice
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePrintStockReport}
                      disabled={loadingReport !== null}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Printer size={15} />
                      {loadingReport === "stok" ? "Menyiapkan..." : "Cetak Stok"}
                    </button>
                    <button
                      onClick={handleExportStockCsv}
                      disabled={loadingReport !== null}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Download size={15} />
                      Export CSV Stok
                    </button>
                  </div>
                  <button
                    onClick={handlePrintCombinedReport}
                    disabled={loadingReport !== null}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Printer size={15} />
                    {loadingReport === "gabungan" ? "Menyiapkan Laporan..." : "Cetak Laporan Gabungan"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="rounded-lg bg-primary/5 px-3 py-2">
                    <p className="text-muted-foreground">Total Invoice ({reportPeriod === "bulan_ini" ? "Bulan Ini" : reportPeriod === "hari_ini" ? "Hari Ini" : "Sesuai Filter"})</p>
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
                <div className="space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const isSelected = activeSelectedInvoice?.id === invoice.id;
                    return (
                      <div 
                        key={invoice.id} 
                        onClick={() => handleSelectInvoice(invoice)}
                        className={`tanabrew-card-enter rounded-xl border p-4 space-y-3 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-primary truncate">{invoice.no_invoice || "-"}</p>
                            <p className="text-xs text-muted-foreground truncate">Customer: {invoice.customer || "-"}</p>
                          </div>
                          <span className={`text-xs font-bold ${statusClass(invoice.status)}`}>{invoice.status || "-"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
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

                        {/* WhatsApp Status Badge */}
                        <div className="rounded-lg bg-muted/60 px-3 py-1.5 text-xs flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Smartphone size={11} className="text-emerald-600" /> WhatsApp
                          </span>
                          <span className={`font-semibold ${
                            (invoice as any).whatsapp_status?.status === "SENT"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : (invoice as any).whatsapp_status?.status === "FAILED"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}>
                            {(invoice as any).whatsapp_status?.status === "SENT"
                              ? "✓ Terkirim"
                              : (invoice as any).whatsapp_status?.status === "FAILED"
                              ? "Gagal"
                              : "Belum"}
                          </span>
                        </div>

                        {/* Quick action buttons for all screens (Mobile, Tablet, Laptop, Desktop) */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectInvoice(invoice);
                            }}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-muted/80 hover:bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          >
                            <Eye size={13} /> Detail
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintInvoice(invoice);
                            }}
                            disabled={!isAdmin || printingInvoiceId === invoice.id}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary hover:bg-primary/90 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Printer size={13} /> {printingInvoiceId === invoice.id ? "..." : "Cetak"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsAppModal(invoice);
                            }}
                            disabled={!isAdmin}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <Smartphone size={13} /> WA
                          </button>
                          {(isOwnerOrDev || (!invoice.is_printed && invoice.status !== "LUNAS")) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cetak-invoice?edit=${invoice.id}`);
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/15 px-2 py-1.5 text-xs font-semibold text-primary transition-colors cursor-pointer"
                            >
                              <Edit size={13} /> Edit
                            </button>
                          )}
                          {isOwnerOrDev && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInvoice(null);
                                setDeleteTarget(invoice);
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 px-2 py-1.5 text-xs font-semibold text-destructive transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} /> Hapus
                            </button>
                          )}
                          {isAdmin && invoice.status === "BELUM LUNAS" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentTarget(invoice);
                              }}
                              disabled={payingInvoiceId === invoice.id}
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 disabled:opacity-50 transition-colors cursor-pointer ml-auto"
                            >
                              ✓ Lunas
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
            </div>

            {/* Right Document Preview Column (Desktop 7 Cols Sticky) */}
            <div ref={previewContainerRef} className="hidden lg:block lg:col-span-7 lg:sticky lg:top-6 space-y-4">
              {activeSelectedInvoice ? (
                renderInvoiceDocumentCard(activeSelectedInvoice, false)
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
                  <Receipt size={36} className="mx-auto mb-2 text-muted-foreground/50" />
                  <p className="font-semibold text-sm">Pilih invoice di sebelah kiri</p>
                  <p className="text-xs text-muted-foreground mt-1">Rincian invoice & aksi dokumen akan langsung tampil di sini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Popup Modal Portal (rendered directly into document.body to bypass any parent transforms) */}
      {mobileModalInvoice && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setMobileModalInvoice(null)}
        >
          <div
            className="relative bg-card w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-5 pb-8 max-h-[88vh] overflow-y-auto shadow-2xl border-t sm:border border-border text-foreground animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 select-text"
            style={{ paddingBottom: "calc(3rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderInvoiceDocumentCard(mobileModalInvoice, true)}
          </div>
        </div>,
        document.body
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

      {/* Confirm Tandai Lunas */}
      <ConfirmDialog
        open={Boolean(paymentTarget)}
        title="Tandai invoice sebagai lunas?"
        description="Status pembayaran invoice ini akan diubah menjadi LUNAS dan sisa pembayaran menjadi Rp 0."
        confirmLabel="Tandai Lunas"
        loading={Boolean(paymentTarget?.id && payingInvoiceId === paymentTarget.id)}
        onCancel={() => setPaymentTarget(null)}
        onConfirm={() => void handleMarkInvoicePaid()}
      />

      {/* Confirm Hapus Invoice */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Invoice Permanen?"
        description={`Apakah Anda yakin ingin menghapus invoice ${deleteTarget?.no_invoice || ""}? Stok produk di lokasi ${deleteTarget?.stock_location || "Jogja"} akan otomatis dikembalikan ke inventaris.`}
        confirmLabel="Hapus Invoice"
        loading={Boolean(deleteTarget?.id && deletingInvoiceId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteInvoice()}
      />

      {/* MODAL SHARE WHATSAPP INVOICE */}
      {waShareInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setWaShareInvoice(null)}
        >
          <div
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-foreground"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Kirim Invoice ke WhatsApp</h3>
                  <p className="text-xs text-muted-foreground font-mono">{waShareInvoice.no_invoice}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWaShareInvoice(null)}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Phone Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Nomor WhatsApp Tujuan</span>
                <span className="text-[10px] text-muted-foreground">Customer: {waShareInvoice.customer}</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="Contoh: 08123456789 atau 628..."
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Jika dikosongkan, WhatsApp akan meminta Anda memilih kontak langsung saat terbuka.
              </p>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">Pesan / Rincian Invoice</label>
                <button
                  type="button"
                  onClick={handleCopyWaText}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  <Copy size={12} />
                  <span>{copiedText ? "Tersalin!" : "Salin Teks"}</span>
                </button>
              </div>
              <textarea
                value={waCustomText}
                onChange={(e) => setWaCustomText(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-input bg-muted/40 p-2.5 text-[11px] font-mono leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleDirectWhatsAppSend}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 text-xs font-bold shadow-md shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
              >
                <Smartphone size={16} />
                <span>Buka Chat WhatsApp</span>
                <ExternalLink size={13} className="opacity-80" />
              </button>

              <button
                type="button"
                onClick={() => handleSharePdfInvoice(waShareInvoice)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-4 text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer active:scale-95"
              >
                <Share2 size={16} />
                <span>Buka Dokumen PDF & Bagikan</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadInvoicePdf}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted py-2 px-3 text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Unduh PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWaShareInvoice(null)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted py-2 px-3 text-xs font-semibold text-muted-foreground transition-all cursor-pointer"
                >
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Riwayat;
