import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchExpenseRecords, addExpenseRecord, editExpenseRecord } from "@/lib/spreadsheet/expenseService";
import { ExpenseRecord, ExpenseFilter } from "@/lib/spreadsheet/models/expense";
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

const getCategoryBadgeClass = (category?: string) => {
  if (!category) {
    return "bg-muted text-muted-foreground border border-border";
  }
  const cat = category.toLowerCase().trim();
  if (cat.includes("bahan baku")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
  }
  if (cat.includes("roasting")) {
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
  }
  if (cat.includes("packaging")) {
    return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
  }
  if (cat.includes("konten") || cat.includes("media")) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
  }
  return "bg-muted text-muted-foreground border border-border";
};

const getCleanDate = (record: ExpenseRecord): string => {
  const dateVal = record.tanggalExpense || record.tangal || "";
  if (!dateVal) return "";
  if (dateVal.includes("T")) {
    return dateVal.split("T")[0];
  }
  return dateVal;
};

const Pengeluaran = ({ showHeader = true }: { showHeader?: boolean }) => {
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ExpenseFilter>("semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formState, setFormState] = useState<Omit<ExpenseRecord, "timestamp">>({ 
    expenseId: "",
    tanggalExpense: "",
    itemProduk: "",
    kategori: "Bahan baku",
    nominal: 0,
    catatan: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleAddNew = () => {
    setIsEdit(false);
    setFormState({
      expenseId: "",
      tanggalExpense: getTodayStr(),
      itemProduk: "",
      kategori: "Bahan baku",
      nominal: 0,
      catatan: "",
    });
    setFormOpen(true);
  };

  const handleEdit = (record: ExpenseRecord) => {
    setIsEdit(true);
    setFormState({
      expenseId: record.expenseId,
      tanggalExpense: getCleanDate(record) || getTodayStr(),
      itemProduk: record.itemProduk || "",
      kategori: record.kategori || "Bahan baku",
      nominal: Number(record.nominal) || 0,
      catatan: record.catatan || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.expenseId || !formState.tanggalExpense || formState.nominal <= 0) {
      alert("Mohon isi ID, Tanggal, dan Nominal dengan benar.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await editExpenseRecord(formState);
      } else {
        await addExpenseRecord(formState);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan data ke Spreadsheet: " + err);
    } finally {
      setSubmitting(false);
    }
  };

  const loadData = useCallback(async (isInitial = false) => {
    let hasCache = false;
    if (isInitial) {
      try {
        const cached = localStorage.getItem("tanabrew_expense_records");
        if (cached) {
          const parsed = JSON.parse(cached) as ExpenseRecord[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecords(parsed);
            setLoading(false);
            hasCache = true;
            console.log("[Expense]\nLOADED FROM LOCALSTORAGE CACHE\n", parsed.length, "records");
          }
        }
      } catch (err) {
        console.warn("Failed to read localStorage cache for expense:", err);
      }
    }

    if (!hasCache) {
      setLoading(true);
    }
    setError(false);

    try {
      const data = await fetchExpenseRecords(true);
      // Default: Tanggal terbaru di atas
      const sortedData = [...data].sort((a, b) => {
        const dateA = getCleanDate(a);
        const dateB = getCleanDate(b);
        const timeA = new Date(dateA ? `${dateA}T00:00:00` : 0).getTime();
        const timeB = new Date(dateB ? `${dateB}T00:00:00` : 0).getTime();
        return timeB - timeA;
      });
      setRecords(sortedData);
      try {
        localStorage.setItem("tanabrew_expense_records", JSON.stringify(sortedData));
      } catch (e) {
        console.warn("Failed to write to localStorage for expense:", e);
      }
      console.log("[Expense]\nSTATE UPDATED FROM API\n", sortedData.length, "records");
      setError(false);
    } catch (err) {
      console.error("Gagal memuat data pengeluaran dari Spreadsheet:", err);
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

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const handleSafeRefresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const todayStr = useMemo(() => getTodayStr(), []);
  const currentMonthStr = useMemo(() => getCurrentYearMonthStr(), []);

  // Fixed Summaries (Today and Current Month) across ALL retrieved records
  const totalToday = useMemo(() => {
    return records
      .filter((r) => getCleanDate(r) === todayStr)
      .reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  }, [records, todayStr]);

  const totalMonth = useMemo(() => {
    return records
      .filter((r) => getCleanDate(r).startsWith(currentMonthStr))
      .reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  }, [records, currentMonthStr]);

  // Apply Filter Client-Side (optimized, does not re-request from API)
  const filteredByDate = useMemo(() => {
    const now = new Date();
    return records.filter((record) => {
      const cleanDate = getCleanDate(record);
      if (activeFilter === "hari_ini") {
        return cleanDate === todayStr;
      }
      if (activeFilter === "7_hari" || activeFilter === "30_hari") {
        if (!cleanDate) return false;
        const recordDate = new Date(cleanDate + "T00:00:00");
        const diffTime = now.getTime() - recordDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const limitDays = activeFilter === "7_hari" ? 7 : 30;
        return diffDays >= 0 && diffDays < limitDays;
      }
      return true; // "semua"
    });
  }, [records, activeFilter, todayStr]);

  // Apply Search Client-Side (Item/Produk or Kategori)
  const finalFilteredRecords = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return filteredByDate;

    return filteredByDate.filter((record) => {
      const matchesItem = (record.itemProduk || "").toLowerCase().includes(keyword);
      const matchesCategory = (record.kategori || "").toLowerCase().includes(keyword);
      return matchesItem || matchesCategory;
    });
  }, [filteredByDate, searchQuery]);

  // Dynamic Summaries based on active filtered list
  const transactionCount = useMemo(() => finalFilteredRecords.length, [finalFilteredRecords]);

  const averageExpense = useMemo(() => {
    if (transactionCount === 0) return 0;
    const totalFiltered = finalFilteredRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    return Math.round(totalFiltered / transactionCount);
  }, [finalFilteredRecords, transactionCount]);

  const filters: { key: ExpenseFilter; label: string }[] = [
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
          {showHeader && <h1 className="text-lg font-bold text-primary">Pengeluaran (Spreadsheet)</h1>}
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

          {/* Card 3: Jumlah Transaksi */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <FileText size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Transaksi</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1">{transactionCount} Transaksi</p>
            )}
          </div>

          {/* Card 4: Rata-rata */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-2 right-2 text-primary/20">
              <TrendingUp size={18} />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rata-rata Pengeluaran</p>
            {loading ? (
              <Skeleton className="h-6 w-3/4 mt-2" />
            ) : (
              <p className="text-base font-bold text-primary mt-1 truncate">{formatCurrency(averageExpense)}</p>
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
              placeholder="Cari item atau kategori"
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
              <p className="text-sm font-semibold text-foreground">Gagal memuat data pengeluaran.</p>
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
            <p className="text-sm font-semibold text-muted-foreground">Tidak ada data pengeluaran.</p>
            <p className="text-xs text-muted-foreground mt-1">Spreadsheet kosong atau filter tidak mencocokkan data apa pun.</p>
          </div>
        ) : (
          /* Table/List View */
          <div className="space-y-3">
            {finalFilteredRecords.map((record, index) => (
              <div
                key={`${record.expenseId}-${index}`}
                className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/20 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">{record.expenseId}</span>
                    <button
                      onClick={() => handleEdit(record)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(record.kategori)}`}>
                    {record.kategori || "-"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-xs mt-3">
                  <div>
                    <span className="text-muted-foreground">Item / Produk</span>
                    <p className="font-medium truncate mt-0.5">{record.itemProduk || "-"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Nominal</span>
                    <p className="font-bold text-primary mt-0.5">{formatCurrency(Number(record.nominal) || 0)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tanggal</span>
                    <p className="font-medium mt-0.5 text-muted-foreground">{getCleanDate(record) || "-"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Catatan</span>
                    <p className="font-medium truncate mt-0.5">{record.catatan || "-"}</p>
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
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-primary">
                {isEdit ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1 rounded-full hover:bg-muted">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">ID Pengeluaran</label>
              <input type="text" required value={formState.expenseId}
                onChange={(e) => setFormState((s) => ({ ...s, expenseId: e.target.value }))}
                placeholder="Contoh: EXP0100"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tanggal</label>
              <input type="date" required value={formState.tanggalExpense}
                onChange={(e) => setFormState((s) => ({ ...s, tanggalExpense: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Item / Produk</label>
              <input type="text" required value={formState.itemProduk}
                onChange={(e) => setFormState((s) => ({ ...s, itemProduk: e.target.value }))}
                placeholder="Contoh: Green Bean Gayo 2kg"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Kategori</label>
              <select value={formState.kategori}
                onChange={(e) => setFormState((s) => ({ ...s, kategori: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="Bahan baku">Bahan Baku</option>
                <option value="Jasa Roasting">Jasa Roasting</option>
                <option value="Packaging">Packaging</option>
                <option value="Konten & Media">Konten & Media</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Nominal (Rp)</label>
              <input type="number" required min={0} value={formState.nominal || ""}
                onChange={(e) => setFormState((s) => ({ ...s, nominal: Number(e.target.value) }))}
                placeholder="Contoh: 310000"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Catatan (Opsional)</label>
              <input type="text" value={formState.catatan ?? ""}
                onChange={(e) => setFormState((s) => ({ ...s, catatan: e.target.value }))}
                placeholder="Catatan tambahan..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 transition-all disabled:opacity-60">
              {submitting ? "Menyimpan..." : isEdit ? "Perbarui Data" : "Simpan ke Spreadsheet"}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default Pengeluaran;
