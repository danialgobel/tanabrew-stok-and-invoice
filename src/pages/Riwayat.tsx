import { useEffect, useMemo, useState } from "react";
import { collection, doc, increment, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Activity, Eye, FileText, Package, Printer, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { ActivityLog, Invoice, InvoiceItem } from "@/types";

type ActiveTab = "invoice" | "stok" | "aktivitas";

const paymentInstructions = [
  "Transfer ke Seabank a.n. AHMAD FARID MUSADDAD",
  "No. Rekening 9011 2193 2420",
  "Transfer ke BSI a.n. AHMAD FARID MUSADDAD",
  "No. Rekening 7196999501",
];

const productActions = ["CREATE_PRODUCT", "UPDATE_PRODUCT", "DELETE_PRODUCT"];

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

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

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
    default:
      return action || "-";
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
</style></head><body>
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
  ${script}
</body></html>`;
};

const Riwayat = () => {
  const { toast } = useToast();
  const { currentUser, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoice");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snap) => {
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));
        data.sort((a, b) => {
          const aDate = getDateValue(a.created_at) || getDateValue(a.tanggal);
          const bDate = getDateValue(b.created_at) || getDateValue(b.tanggal);
          return bDate - aDate;
        });
        setInvoices(data);
        setLoadingInvoices(false);
      },
      () => {
        toast({ title: "Error", description: "Gagal memuat riwayat invoice.", variant: "destructive" });
        setLoadingInvoices(false);
      },
    );

    return () => unsubscribe();
  }, [toast]);

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

  const stockLogs = useMemo(
    () => activityLogs.filter((log) => log.target_type === "product" || productActions.includes(log.action || "")),
    [activityLogs],
  );
  const isAdmin = userProfile?.role === "admin";

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
    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
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
        <div className="space-y-3">
          {loadingInvoices ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Memuat riwayat invoice...</p>
          ) : invoices.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Belum ada riwayat invoice.</p>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-border bg-card p-4">
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
                {!isAdmin && (
                  <p className="mt-2 text-center text-xs text-destructive">Hanya admin yang dapat mencetak ulang invoice.</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "stok" && (
        <div className="space-y-3">
          {loadingLogs ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Memuat riwayat stok...</p>
          ) : stockLogs.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Belum ada riwayat stok.</p>
          ) : (
            stockLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-card p-4">
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
                  <p><span className="text-muted-foreground">Nama Produk:</span> <span className="font-semibold">{log.target_name || "-"}</span></p>
                  <p className="text-muted-foreground">{log.description || "-"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "aktivitas" && (
        <div className="space-y-3">
          {loadingLogs ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Memuat riwayat aktivitas...</p>
          ) : activityLogs.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-card p-4">
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
          <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Riwayat;
