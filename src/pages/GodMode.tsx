import { useEffect, useState, useRef } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import {
  Terminal as TerminalIcon,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Database,
  FileText,
  Package,
  History,
  Users,
  AlertTriangle,
} from "lucide-react";

type CollectionName = "invoices" | "products" | "activity_logs" | "stock_movements" | "users";

interface LogEntry {
  timestamp: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

const GodMode = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeCollection, setActiveCollection] = useState<CollectionName>("invoices");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [devLogs, setDevLogs] = useState<LogEntry[]>([]);
  
  // Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; display: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Restrict access
  useEffect(() => {
    if (userProfile && userProfile.role !== "webdev") {
      toast({
        title: "Akses Ditolak",
        description: "Halaman ini hanya untuk Developer.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [userProfile, navigate, toast]);

  // Dev log helpers
  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false });
    setDevLogs((prev) => [...prev, { timestamp: time, type, message }]);
  };

  // Scroll terminal logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [devLogs]);

  // Initial console message
  useEffect(() => {
    setDevLogs([]);
    addLog("Sistem pengawasan developer dinyalakan...", "info");
    addLog("Role pengguna divalidasi: WEB DEV (God Mode)", "success");
    addLog("Mengoneksikan ke Firebase Firestore...", "info");
    void loadData(activeCollection);
  }, []);

  const loadData = async (collectionName: CollectionName) => {
    setLoading(true);
    addLog(`Mengambil data dari koleksi '${collectionName}'...`, "info");
    try {
      const snap = await getDocs(collection(db, collectionName));
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Sort logs/movements/invoices by date descending if possible
      if (collectionName === "activity_logs" || collectionName === "stock_movements") {
        records.sort((a: any, b: any) => {
          const tA = a.created_at?.seconds || 0;
          const tB = b.created_at?.seconds || 0;
          return tB - tA;
        });
      } else if (collectionName === "invoices") {
        records.sort((a: any, b: any) => {
          const tA = a.created_at?.seconds || 0;
          const tB = b.created_at?.seconds || 0;
          return tB - tA;
        });
      }

      setData(records);
      addLog(`Koleksi '${collectionName}' berhasil dimuat. Total data: ${records.length}`, "success");
    } catch (err: any) {
      addLog(`Gagal memuat koleksi '${collectionName}': ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal memuat data Firestore", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionChange = (colName: CollectionName) => {
    setActiveCollection(colName);
    void loadData(colName);
  };

  const initiateDelete = (id: string, record: any) => {
    let display = id;
    if (activeCollection === "invoices") {
      display = record.no_invoice || id;
    } else if (activeCollection === "products") {
      display = record.nama_barang || id;
    } else if (activeCollection === "users") {
      display = `${record.name} (${record.email})`;
    } else if (activeCollection === "activity_logs") {
      display = record.description || id;
    } else if (activeCollection === "stock_movements") {
      display = record.description || id;
    }
    setDeleteTarget({ id, display });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { id, display } = deleteTarget;
    addLog(`Memulai penghapusan dokumen '${id}' dari '${activeCollection}'...`, "warn");
    try {
      await deleteDoc(doc(db, activeCollection, id));
      setData((prev) => prev.filter((r) => r.id !== id));
      addLog(`Dokumen '${display}' (${id}) berhasil dihapus.`, "success");
      toast({ title: "Berhasil", description: `Data berhasil dihapus dari Firebase` });
    } catch (err: any) {
      addLog(`Gagal menghapus dokumen '${id}': ${err.message}`, "error");
      toast({ title: "Error", description: "Gagal menghapus data dari Firebase", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const getCollectionIcon = (col: CollectionName) => {
    switch (col) {
      case "invoices":
        return <FileText size={18} />;
      case "products":
        return <Package size={18} />;
      case "users":
        return <Users size={18} />;
      case "activity_logs":
        return <History size={18} />;
      case "stock_movements":
        return <Database size={18} />;
    }
  };

  if (userProfile?.role !== "webdev") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-48 pt-6">
      {/* Dev Header */}
      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 relative overflow-hidden shadow-[0_0_15px_rgba(139,92,246,0.1)]">
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-mono tracking-widest uppercase animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          ROOT_ACCESS
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary shadow-[0_0_10px_rgba(139,92,246,0.3)]">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-wider text-primary-foreground uppercase">
              Tanabrew God Mode
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Web Developer Admin Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Database Navigation Tab list */}
      <div className="grid grid-cols-5 gap-1 mb-4">
        {(["invoices", "products", "users", "activity_logs", "stock_movements"] as CollectionName[]).map((col) => {
          const active = activeCollection === col;
          return (
            <button
              key={col}
              onClick={() => handleCollectionChange(col)}
              title={col}
              className={`flex flex-col items-center justify-center rounded-lg p-2 transition-all border ${
                active
                  ? "border-primary bg-primary/15 text-primary shadow-[0_0_10px_rgba(139,92,246,0.25)]"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {getCollectionIcon(col)}
              <span className="text-[9px] font-mono font-bold uppercase mt-1 tracking-tighter truncate max-w-full">
                {col.split("_")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explorer Panel */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-h-[300px] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
            <Database size={14} /> Explorer: {activeCollection}
          </h2>
          <button
            onClick={() => void loadData(activeCollection)}
            disabled={loading}
            className="p-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Content Explorer List */}
        <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px] pr-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground font-mono text-xs">
              <AlertTriangle size={24} className="mb-2 text-primary/40" />
              Koleksi kosong / Tidak ada dokumen.
            </div>
          ) : (
            data.map((record) => (
              <div
                key={record.id}
                className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between gap-3 hover:border-primary/20 transition-all"
              >
                <div className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed">
                  {/* Dynamic Render Fields per Collection */}
                  {activeCollection === "invoices" && (
                    <>
                      <div className="flex justify-between">
                        <span className="font-bold text-primary">{record.no_invoice || record.id}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${record.status === "LUNAS" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{record.status}</span>
                      </div>
                      <p className="text-muted-foreground truncate">Cust: {record.customer}</p>
                      <p className="text-muted-foreground">Total: Rp {new Intl.NumberFormat("id-ID").format(record.total || 0)}</p>
                    </>
                  )}

                  {activeCollection === "products" && (
                    <>
                      <p className="font-bold text-primary truncate">{record.nama_barang}</p>
                      <p className="text-muted-foreground">Stok J: {record.stok_jogja} • Stok L: {record.stok_lombok}</p>
                      <p className="text-muted-foreground">Harga: Rp {new Intl.NumberFormat("id-ID").format(record.harga || 0)}</p>
                    </>
                  )}

                  {activeCollection === "users" && (
                    <>
                      <p className="font-bold text-primary truncate">{record.name}</p>
                      <p className="text-muted-foreground truncate">{record.email}</p>
                      <p className="text-muted-foreground capitalize">Role: {record.role}</p>
                    </>
                  )}

                  {activeCollection === "activity_logs" && (
                    <>
                      <div className="flex justify-between">
                        <span className="font-bold text-accent">{record.action}</span>
                        <span className="text-muted-foreground text-[9px]">
                          {record.created_at && typeof record.created_at.toDate === "function" 
                            ? record.created_at.toDate().toLocaleString("id-ID")
                            : "n/a"}
                        </span>
                      </div>
                      <p className="text-muted-foreground break-words">{record.description}</p>
                    </>
                  )}

                  {activeCollection === "stock_movements" && (
                    <>
                      <div className="flex justify-between">
                        <span className="font-bold text-primary truncate">{record.product_name}</span>
                        <span className={`px-1 rounded text-[9px] font-bold ${record.quantity_change > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                          {record.quantity_change > 0 ? "+" : ""}{record.quantity_change}
                        </span>
                      </div>
                      <p className="text-muted-foreground break-words">{record.description}</p>
                      <p className="text-muted-foreground">Lokasi: {record.location}</p>
                    </>
                  )}

                  <div className="mt-1.5 pt-1.5 border-t border-border/20 text-[9px] text-muted-foreground flex justify-between">
                    <span>ID: {record.id}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => initiateDelete(record.id, record)}
                  className="p-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-all shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Terminal logs panel */}
      <div className="mt-4 bg-[#050508] border border-primary/20 rounded-xl p-3 shadow-inner relative">
        <div className="absolute top-2.5 right-3 flex items-center gap-1 text-[9px] font-mono text-primary/60">
          <TerminalIcon size={10} />
          CONSOLE
        </div>
        <h3 className="text-xs font-mono font-bold text-primary mb-2 tracking-wider flex items-center gap-1">
          &gt;_ Logs Output
        </h3>
        <div className="font-mono text-[9px] text-[#00ff66] h-28 overflow-y-auto space-y-1 bg-black/60 p-2 rounded border border-primary/10 select-text">
          {devLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <span className="text-muted-foreground select-none">[{log.timestamp}]</span>
              <span className={
                log.type === "success" ? "text-emerald-400 font-bold" :
                log.type === "warn" ? "text-amber-400" :
                log.type === "error" ? "text-rose-400 font-bold" : "text-emerald-500"
              }>
                {log.type === "error" ? "[ERR]" : log.type === "warn" ? "[WARN]" : log.type === "success" ? "[OK]" : "[SYS]"}
              </span>
              <span className="break-all whitespace-pre-wrap">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Confirm Deletion Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Konfirmasi Penghapusan"
        description={`Apakah Anda yakin ingin menghapus data "${deleteTarget?.display}" dari koleksi "${activeCollection}" di Firebase Firestore? Tindakan ini akan menghapus data secara permanen dan tidak bisa dibatalkan.`}
        confirmLabel="Hapus Permanen"
        cancelLabel="Batal"
        danger={true}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
};

export default GodMode;
