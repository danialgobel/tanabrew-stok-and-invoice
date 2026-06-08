import { useProducts } from "@/hooks/useProducts";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { LogOut, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { ActivityLog, Invoice } from "@/types";

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
      return action || "Aktivitas";
  }
};

const getDateValue = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number") return value;
  return 0;
};

const stockState = (total: number) => {
  if (total === 0) {
    return {
      rowClass: "bg-destructive/10",
      label: "Stok Habis",
      labelClass: "bg-destructive/15 text-destructive",
    };
  }

  if (total > 0 && total <= 3) {
    return {
      rowClass: "bg-yellow-100/70",
      label: "Stok Menipis",
      labelClass: "bg-yellow-200/80 text-yellow-800",
    };
  }

  return { rowClass: "", label: "", labelClass: "" };
};

const Beranda = () => {
  const { products, loading } = useProducts();
  const { currentUser, userProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState<"jogja" | "lombok" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [latestActivity, setLatestActivity] = useState<ActivityLog | null>(null);
  const [dismissedActivityId, setDismissedActivityId] = useState<string | null>(null);
  const [adminInvoices, setAdminInvoices] = useState<Invoice[]>([]);
  const [invoiceReminderError, setInvoiceReminderError] = useState(false);

  const totalProduk = products.length;
  const totalStok = products.reduce((s, p) => s + (p.total_stok || 0), 0);
  const stokJogja = products.reduce((s, p) => s + (p.stok_jogja || 0), 0);
  const stokLombok = products.reduce((s, p) => s + (p.stok_lombok || 0), 0);
  const displayName = userProfile?.name || currentUser?.email || "-";
  const roleLabel = userProfile?.role === "admin" ? "Admin" : userProfile?.role === "staff" ? "Staff" : "-";
  const isAdmin = userProfile?.role === "admin";
  const seenActivityId = dismissedActivityId || userProfile?.last_seen_activity_id;
  const showLatestActivity = Boolean(latestActivity?.id && latestActivity.id !== seenActivityId);

  useEffect(() => {
    const q = query(collection(db, "activity_logs"), orderBy("created_at", "desc"), limit(1));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const activityDoc = snap.docs[0];
        setLatestActivity(activityDoc ? ({ id: activityDoc.id, ...activityDoc.data() } as ActivityLog) : null);
      },
      () => {
        setLatestActivity(null);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdminInvoices([]);
      setInvoiceReminderError(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snap) => {
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));
        data.sort((a, b) => {
          const aDate = getDateValue(a.created_at) || getDateValue(a.tanggal);
          const bDate = getDateValue(b.created_at) || getDateValue(b.tanggal);
          return bDate - aDate;
        });
        setAdminInvoices(data);
        setInvoiceReminderError(false);
      },
      () => {
        setInvoiceReminderError(true);
        setAdminInvoices([]);
      },
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const unprintedInvoices = useMemo(
    () => adminInvoices.filter((invoice) => invoice.is_printed !== true),
    [adminInvoices],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) > 0 && (p.total_stok || 0) <= 3),
    [products],
  );
  const emptyStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) === 0),
    [products],
  );
  const hasAdminWarning = invoiceReminderError || unprintedInvoices.length > 0 || lowStockProducts.length > 0 || emptyStockProducts.length > 0;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDismissActivity = async () => {
    if (!currentUser || !latestActivity?.id) return;

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        last_seen_activity_id: latestActivity.id,
        last_seen_activity_at: serverTimestamp(),
      });
      setDismissedActivityId(latestActivity.id);
    } catch {
      toast({ title: "Error", description: "Gagal menutup notifikasi, silakan coba lagi.", variant: "destructive" });
    }
  };

  const cards = [
    { label: "Total Produk", value: totalProduk, clickable: false },
    { label: "Total Stok", value: totalStok, clickable: false },
    { label: "Stok Jogja", value: stokJogja, clickable: true, key: "jogja" as const },
    { label: "Stok Lombok", value: stokLombok, clickable: true, key: "lombok" as const },
  ];

  return (
    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <img
          src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
          alt="Tanabrew Logo"
          className="w-24 h-24 rounded-full object-cover border-2 border-primary bg-primary"
        />
        <h1 className="text-xl font-bold text-primary mt-3">Tanabrew</h1>
        <p className="text-sm text-muted-foreground">Trademark</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary truncate">Login sebagai: {displayName}</p>
          <p className="text-xs text-muted-foreground">Role: {roleLabel}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      {showLatestActivity && latestActivity && (
        <div className="relative rounded-xl border border-primary/25 bg-primary/5 p-4 mb-4">
          <button
            onClick={handleDismissActivity}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
            aria-label="Tutup notifikasi"
          >
            <X size={16} />
          </button>
          <p className="text-sm font-bold text-primary pr-8">Aktivitas Terbaru</p>
          <p className="mt-1 text-sm text-foreground pr-6">{latestActivity.description || "Ada aktivitas baru."}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{latestActivity.user_name || "Tidak diketahui"}</span>
            <span>•</span>
            <span>{actionLabel(latestActivity.action)}</span>
            <span>•</span>
            <span>Baru saja</span>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-bold text-primary mb-3">Pengingat Admin</h2>

          {!hasAdminWarning ? (
            <p className="text-sm text-muted-foreground">Semua aman untuk saat ini.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Invoice belum dicetak</span>
                  <span className="font-bold text-primary">{invoiceReminderError ? "-" : unprintedInvoices.length}</span>
                </div>
                {invoiceReminderError ? (
                  <p className="mt-1 text-xs text-destructive">Gagal memuat invoice belum dicetak.</p>
                ) : (
                  unprintedInvoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs">
                      <p className="font-semibold text-foreground">{invoice.no_invoice || "-"}</p>
                      <p className="text-muted-foreground">Customer: {invoice.customer || "-"}</p>
                      <p className={invoice.status === "LUNAS" ? "text-primary" : "text-destructive"}>{invoice.status || "-"}</p>
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Stok menipis</span>
                  <span className="font-bold text-yellow-800">{lowStockProducts.length} barang</span>
                </div>
                {lowStockProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="mt-2 flex justify-between rounded-lg bg-yellow-100/70 px-3 py-2 text-xs">
                    <span className="font-semibold text-foreground">{p.nama_barang}</span>
                    <span className="font-bold text-yellow-800">{p.total_stok}</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Stok habis</span>
                  <span className="font-bold text-destructive">{emptyStockProducts.length} barang</span>
                </div>
                {emptyStockProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="mt-2 flex justify-between rounded-lg bg-destructive/10 px-3 py-2 text-xs">
                    <span className="font-semibold text-foreground">{p.nama_barang}</span>
                    <span className="font-bold text-destructive">{p.total_stok}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map((c) => (
          <button
            key={c.label}
            disabled={!c.clickable}
            onClick={() => c.clickable && c.key && setModal(c.key)}
            className={`rounded-xl bg-card border border-border p-4 text-center transition-shadow ${
              c.clickable ? "cursor-pointer active:shadow-md hover:border-primary/40" : "cursor-default"
            }`}
          >
            <p className="text-2xl font-bold text-primary">{loading ? "..." : c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Stock Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-primary/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-primary">Tabel Stok</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-3 py-2 text-left font-medium">Nama Barang</th>
                <th className="px-3 py-2 text-center font-medium">Jogja</th>
                <th className="px-3 py-2 text-center font-medium">Lombok</th>
                <th className="px-3 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Memuat...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Belum ada produk</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className={`border-t border-border ${stockState(p.total_stok || 0).rowClass}`}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span>{p.nama_barang}</span>
                        {stockState(p.total_stok || 0).label && (
                          <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockState(p.total_stok || 0).labelClass}`}>
                            {stockState(p.total_stok || 0).label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">{p.stok_jogja}</td>
                    <td className="px-3 py-2 text-center">{p.stok_lombok}</td>
                    <td className="px-3 py-2 text-center font-medium">{p.total_stok}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setModal(null)}>
          <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary">
                Stok {modal === "jogja" ? "Jogja" : "Lombok"}
              </h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-full hover:bg-muted">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-muted">
                  <span className="text-sm">{p.nama_barang}</span>
                  <span className="text-sm font-semibold text-primary">
                    {modal === "jogja" ? p.stok_jogja : p.stok_lombok}
                  </span>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">Belum ada data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Beranda;
