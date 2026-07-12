import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchIncomeRecords, addIncomeRecord, editIncomeRecord } from "@/lib/spreadsheet/incomeService";
import { IncomeRecord, IncomeFilter } from "@/lib/spreadsheet/models/income";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";
import { Search, DollarSign, Calendar, FileText, TrendingUp, AlertTriangle, Plus, Pencil, X } from "lucide-react";

const formatCurrency = (n: number) => {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
};

const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getCurrentYearMonthStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const Pendapatan = ({ showHeader = true }: { showHeader?: boolean }) => {
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<IncomeFilter>("semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formState, setFormState] = useState<Omit<IncomeRecord, "timestamp">>({
    invoiceNumber: "",
    tanggalInvoice: "",
    customerName: "",
    total: 0,
    paymentMethod: "Penjualan Offline",
    produkJasa: "",
    catatan: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async (isInitial = false) => {
    let hasCache = false;
    if (isInitial) {
      try {
        const cached = localStorage.getItem("tanabrew_income_records");
        if (cached) {
          const parsed = JSON.parse(cached) as IncomeRecord[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecords(parsed);
            setLoading(false);
            hasCache = true;
            console.log("[Income]\nLOADED FROM LOCALSTORAGE CACHE\n", parsed.length, "records");
          }
        }
      } catch (err) {
        console.warn("Failed to read localStorage cache for income:", err);
      }
    }

    if (!hasCache) {
      setLoading(true);
    }
    setError(false);

    try {
      const data = await fetchIncomeRecords(true);
      // Default: Tanggal terbaru di atas (Sort by timestamp / tanggal + jam descending)
      const sortedData = [...data].sort((a, b) => {
        const timeA = new Date(`${a.tanggalInvoice}T${a.jamInvoice || "00:00:00"}`).getTime();
        const timeB = new Date(`${b.tanggalInvoice}T${b.jamInvoice || "00:00:00"}`).getTime();
        return timeB - timeA;
      });
      setRecords(sortedData);
      try {
        localStorage.setItem("tanabrew_income_records", JSON.stringify(sortedData));
      } catch (e) {
        console.warn("Failed to write to localStorage for income:", e);
      }
      console.log("[Income]\nSTATE UPDATED FROM API\n", sortedData.length, "records");
      setError(false);
    } catch (err) {
      console.error("Gagal memuat data pendapatan dari Spreadsheet:", err);
      setRecords((prev) => {
        if (prev.length === 0) {
          setError(true);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddNew = () => {
    setIsEdit(false);
    setFormState({
      invoiceNumber: "",
      tanggalInvoice: getTodayStr(),
      customerName: "",
      total: 0,
      paymentMethod: "Penjualan Offline",
      produkJasa: "",
      catatan: "",
    });
    setFormOpen(true);
  };

  const handleEdit = (record: IncomeRecord) => {
    setIsEdit(true);
    setFormState({
      invoiceNumber: record.invoiceNumber,
      tanggalInvoice: record.tanggalInvoice,
      customerName: record.customerName || "",
      total: Number(record.total) || 0,
      paymentMethod: record.paymentMethod || "Penjualan Offline",
      produkJasa: record.produkJasa || "",
      catatan: record.catatan || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.invoiceNumber || !formState.tanggalInvoice || formState.total <= 0) {
      alert("Mohon isi nomor ID, Tanggal, dan Nominal total dengan benar.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await editIncomeRecord(formState);
      } else {
        await addIncomeRecord(formState);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan data ke Spreadsheet: " + err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const handleSafeRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Determine local dates for filtering
  const todayStr = useMemo(() => getTodayStr(), []);
  const currentMonthStr = useMemo(() => getCurrentYearMonthStr(), []);

  // Calculate Fixed Summaries (Today and Current Month) across ALL retrieved records
  const totalToday = useMemo(() => {
    return records
      .filter((r) => r.tanggalInvoice === todayStr)
      .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [records, todayStr]);

  const totalMonth = useMemo(() => {
    return records
      .filter((r) => r.tanggalInvoice.startsWith(currentMonthStr))
      .reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [records, currentMonthStr]);

  // Apply Filter Client-Side (optimized, does not re-request from API)
  const filteredByDate = useMemo(() => {
    const now = new Date();
    return records.filter((record) => {
      if (activeFilter === "hari_ini") {
        return record.tanggalInvoice === todayStr;
      }
      if (activeFilter === "7_hari" || activeFilter === "30_hari") {
        const recordDate = new Date(record.tanggalInvoice + "T00:00:00");
        const diffTime = now.getTime() - recordDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const limitDays = activeFilter === "7_hari" ? 7 : 30;
        return diffDays >= 0 && diffDays < limitDays;
      }
      return true; // "semua"
    });
  }, [records, activeFilter, todayStr]);

  // Apply Search Client-Side (Nomor Invoice or Nama Customer)
  const finalFilteredRecords = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return filteredByDate;

    return filteredByDate.filter((record) => {
      const matchesInvoice = (record.invoiceNumber || "").toLowerCase().includes(keyword);
      const matchesCustomer = (record.customerName || "").toLowerCase().includes(keyword);
      return matchesInvoice || matchesCustomer;
    });
  }, [filteredByDate, searchQuery]);

  // Calculate Dynamic Summaries (Invoice Count and Average value) on active filtered/searched list
  const invoiceCount = useMemo(() => finalFilteredRecords.length, [finalFilteredRecords]);

  const averageValue = useMemo(() => {
    if (invoiceCount === 0) return 0;
    const totalFiltered = finalFilteredRecords.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    return Math.round(totalFiltered / invoiceCount);
  }, [finalFilteredRecords, invoiceCount]);

  const filters: { key: IncomeFilter; label: string }[] = [
    { key: "hari_ini", label: "Hari Ini" },
    { key: "7_hari", label: "7 Hari" },
    { key: "30_hari", label: "30 Hari" },
    { key: "semua", label: "Semua" },
  ];

  return (
    <>
      <PullToRefresh onRefresh={handleSafeRefresh} disabled={loading} />

      <div className={`mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-24 ${showHeader ? "pt-6" : "pt-2"}`}>
        <div className="flex justify-between items-center mb-4">
          {showHeader && <h1 className="text-lg font-bold text-primary">Pendapatan (Spreadsheet)</h1>}
          <button
            onClick={handleAddNew}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-all ml-auto"
          >
            <Plus size={14} />
            Tambah
          </button>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Card 1: Hari Ini */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <DollarSign size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Hari Ini</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1 truncate">{formatCurrency(totalToday)}</p>
            )}
          </div>

          {/* Card 2: Bulan Ini */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <Calendar size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bulan Ini</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1 truncate">{formatCurrency(totalMonth)}</p>
            )}
          </div>

          {/* Card 3: Jumlah Invoice */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <FileText size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Jumlah Invoice</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1">{invoiceCount} Invoice</p>
            )}
          </div>

          {/* Card 4: Rata-rata */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <TrendingUp size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rata-rata Invoice</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1 truncate">{formatCurrency(averageValue)}</p>
            )}
          </div>
        </div>

        {/* Filters & Search Section */}
        <div className="bg-card rounded-xl border border-border p-4 mb-4 space-y-3 shadow-sm">
          {/* Search bar */}
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no invoice atau customer"
              disabled={loading || error}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter tabs */}
          <div className="grid grid-cols-4 gap-1">
            {filters.map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  disabled={loading || error}
                  className={`rounded-lg py-2 text-xs font-semibold text-center transition-colors border ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data list state view */}
        {loading ? (
          <div className="space-y-3">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-card border border-destructive/20 rounded-xl p-5 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Gagal memuat data pendapatan.</p>
              <p className="text-xs text-muted-foreground mt-1">Periksa koneksi jaringan atau konfigurasi spreadsheet Anda.</p>
            </div>
            <button
              onClick={loadData}
              className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90"
            >
              Muat Ulang
            </button>
          </div>
        ) : finalFilteredRecords.length === 0 ? (
          /* Empty State */
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-muted-foreground">Tidak ada data pendapatan.</p>
            <p className="text-xs text-muted-foreground mt-1">Spreadsheet kosong atau filter tidak mencocokkan data apa pun.</p>
          </div>
        ) : (
          /* Table/List View (Responsive cards for mobile-first layout) */
          <div className="space-y-3">
            {finalFilteredRecords.map((record, index) => (
              <div
                key={`${record.invoiceNumber}-${index}`}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/20 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">{record.invoiceNumber}</span>
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      record.paymentStatus === "LUNAS"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {record.paymentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-xs mt-3">
                  <div>
                    <span className="text-muted-foreground">Customer</span>
                    <p className="font-medium truncate mt-0.5">{record.customerName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Total</span>
                    <p className="font-bold text-primary mt-0.5">{formatCurrency(record.total)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tanggal & Waktu</span>
                    <p className="font-medium mt-0.5 text-muted-foreground">
                      {record.tanggalInvoice} • {record.jamInvoice}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Bayar via</span>
                    <p className="font-medium truncate mt-0.5">{record.paymentMethod}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Admin/Staff</span>
                    <p className="font-medium mt-0.5">
                      {record.createdBy} <span className="text-[10px] text-muted-foreground">({record.role})</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Add / Edit Form Modal ===== */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40"
          onClick={() => setFormOpen(false)}
        >
          <form
            className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-12 sm:pb-5 max-h-[85vh] overflow-y-auto space-y-4"
            style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-primary">
                {isEdit ? "Edit Pendapatan" : "Tambah Pendapatan"}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X size={20} />
              </button>
            </div>

            {/* Invoice Number / ID */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">No. Invoice / ID</label>
              <input
                type="text"
                required
                value={formState.invoiceNumber}
                onChange={(e) => setFormState((s) => ({ ...s, invoiceNumber: e.target.value }))}
                placeholder="Contoh: INV-001"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Tanggal */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tanggal</label>
              <input
                type="date"
                required
                value={formState.tanggalInvoice}
                onChange={(e) => setFormState((s) => ({ ...s, tanggalInvoice: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Customer */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Nama Customer</label>
              <input
                type="text"
                value={formState.customerName}
                onChange={(e) => setFormState((s) => ({ ...s, customerName: e.target.value }))}
                placeholder="Contoh: Budi Santoso"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Produk / Jasa */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Produk / Jasa</label>
              <input
                type="text"
                value={formState.produkJasa ?? ""}
                onChange={(e) => setFormState((s) => ({ ...s, produkJasa: e.target.value }))}
                placeholder="Contoh: Kopi Gayo 250gr"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Kategori / Kanal Bayar */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Kategori / Kanal Bayar</label>
              <select
                value={formState.paymentMethod}
                onChange={(e) => setFormState((s) => ({ ...s, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="Penjualan Offline">Penjualan Offline</option>
                <option value="Penjualan Online">Penjualan Online</option>
                <option value="Shopee">Shopee</option>
                <option value="Tokopedia">Tokopedia</option>
                <option value="Transfer">Transfer</option>
                <option value="COD">COD</option>
              </select>
            </div>

            {/* Total / Nominal */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Total (Rp)</label>
              <input
                type="number"
                required
                min={0}
                value={formState.total || ""}
                onChange={(e) => setFormState((s) => ({ ...s, total: Number(e.target.value) }))}
                placeholder="Contoh: 150000"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Catatan */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Catatan (Opsional)</label>
              <input
                type="text"
                value={formState.catatan ?? ""}
                onChange={(e) => setFormState((s) => ({ ...s, catatan: e.target.value }))}
                placeholder="Catatan tambahan..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-all disabled:opacity-60"
            >
              {submitting ? "Menyimpan..." : isEdit ? "Perbarui Data" : "Simpan ke Spreadsheet"}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Pendapatan;
