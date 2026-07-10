import { useCallback, useEffect, useMemo, useState } from "react";
import Pendapatan from "./Pendapatan";
import Pengeluaran from "./Pengeluaran";
import { TrendingUp, TrendingDown, BarChart3, RefreshCw } from "lucide-react";
import { fetchIncomeRecords } from "@/lib/spreadsheet/incomeService";
import { fetchExpenseRecords } from "@/lib/spreadsheet/expenseService";

type Tab = "pendapatan" | "pengeluaran" | "laporan";

const formatCurrency = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(n);

const getCurrentYearMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const LaporanTab = () => {
  const [incomes, setIncomes] = useState<{ tanggalInvoice: string; total: number }[]>([]);
  const [expenses, setExpenses] = useState<{ tanggalExpense?: string; tangal?: string; nominal: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, exp] = await Promise.all([fetchIncomeRecords(), fetchExpenseRecords()]);
      setIncomes(inc);
      setExpenses(exp);
    } catch {
      // silently fail - user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const currentMonth = useMemo(() => getCurrentYearMonthStr(), []);

  const totalIncome = useMemo(() =>
    incomes.reduce((s, r) => s + (Number(r.total) || 0), 0), [incomes]);

  const totalExpense = useMemo(() =>
    expenses.reduce((s, r) => s + (Number(r.nominal) || 0), 0), [expenses]);

  const netRevenue = totalIncome - totalExpense;

  const monthIncome = useMemo(() =>
    incomes.filter((r) => r.tanggalInvoice?.startsWith(currentMonth))
      .reduce((s, r) => s + (Number(r.total) || 0), 0), [incomes, currentMonth]);

  const monthExpense = useMemo(() =>
    expenses.filter((r) => {
      const d = r.tanggalExpense || r.tangal || "";
      return d.startsWith(currentMonth);
    }).reduce((s, r) => s + (Number(r.nominal) || 0), 0), [expenses, currentMonth]);

  const monthNet = monthIncome - monthExpense;

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3 animate-pulse">
        {[1,2,3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const profitRatio = totalIncome > 0 ? Math.round((netRevenue / totalIncome) * 100) : 0;
  const monthRatio = monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;

  return (
    <div className="px-4 pt-2 pb-8 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan Keseluruhan</p>
        <button onClick={loadAll} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* All-time 3-column summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Pemasukan</p>
          <p className="text-xs font-bold text-emerald-500 truncate">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Pengeluaran</p>
          <p className="text-xs font-bold text-rose-500 truncate">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={`border rounded-xl p-3 shadow-sm ${netRevenue >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Laba Bersih</p>
          <p className={`text-xs font-bold truncate ${netRevenue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(netRevenue)}
          </p>
        </div>
      </div>

      {/* Profit bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-muted-foreground">Margin Profit (All-Time)</span>
          <span className={`font-bold ${profitRatio >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{profitRatio}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${profitRatio >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(Math.abs(profitRatio), 100)}%` }}
          />
        </div>
      </div>

      {/* This Month */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Bulan Ini</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Pemasukan</p>
          <p className="text-xs font-bold text-emerald-500 truncate">{formatCurrency(monthIncome)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Pengeluaran</p>
          <p className="text-xs font-bold text-rose-500 truncate">{formatCurrency(monthExpense)}</p>
        </div>
        <div className={`border rounded-xl p-3 shadow-sm ${monthNet >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Laba</p>
          <p className={`text-xs font-bold truncate ${monthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(monthNet)}
          </p>
        </div>
      </div>

      {/* Month profit bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-muted-foreground">Margin Profit (Bulan Ini)</span>
          <span className={`font-bold ${monthRatio >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{monthRatio}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${monthRatio >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
            style={{ width: `${Math.min(Math.abs(monthRatio), 100)}%` }}
          />
        </div>
      </div>

      {/* Stat summary count */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Data Tersimpan</p>
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{incomes.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Invoice</p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{expenses.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pengeluaran</p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{incomes.length + expenses.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total Transaksi</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Spreadsheet = () => {
  const [activeTab, setActiveTab] = useState<Tab>("pendapatan");

  return (
    <div className="mx-auto w-full max-w-lg min-h-screen bg-background">
      {/* Premium Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-primary">Laporan Keuangan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Sinkronisasi data langsung dari Google Spreadsheet</p>
      </div>

      {/* Pill Segmented Switcher - 3 tabs */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 border border-border">
          <button
            onClick={() => setActiveTab("pendapatan")}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all ${
              activeTab === "pendapatan" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp size={13} className={activeTab === "pendapatan" ? "text-emerald-500" : ""} />
            Pendapatan
          </button>
          <button
            onClick={() => setActiveTab("pengeluaran")}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all ${
              activeTab === "pengeluaran" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingDown size={13} className={activeTab === "pengeluaran" ? "text-rose-500" : ""} />
            Pengeluaran
          </button>
          <button
            onClick={() => setActiveTab("laporan")}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all ${
              activeTab === "laporan" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 size={13} className={activeTab === "laporan" ? "text-primary" : ""} />
            Laporan
          </button>
        </div>
      </div>

      {/* Main Tab Render Container */}
      <div className="transition-all duration-300">
        {activeTab === "pendapatan" && <Pendapatan showHeader={false} />}
        {activeTab === "pengeluaran" && <Pengeluaran showHeader={false} />}
        {activeTab === "laporan" && <LaporanTab />}
      </div>
    </div>
  );
};

export default Spreadsheet;
