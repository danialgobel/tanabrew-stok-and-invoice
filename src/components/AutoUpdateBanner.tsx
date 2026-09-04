import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Sparkles, X, ArrowUpCircle } from "lucide-react";
import { CURRENT_RELEASE } from "@/config/appRelease";
import { triggerHaptic } from "@/lib/haptics";

interface VersionResponse {
  version?: string;
  versionLabel?: string;
  releaseDate?: string;
}

export const AutoUpdateBanner = () => {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheckTime = useRef<number>(0);

  const checkForUpdate = useCallback(async () => {
    // Cooldown minimum 15 detik antar request pengecekan
    const now = Date.now();
    if (now - lastCheckTime.current < 15000) return;
    lastCheckTime.current = now;

    try {
      // Cek static version.json dengan cache-busting timestamp
      const res = await fetch(`/version.json?_t=${now}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return;

      const data = (await res.json()) as VersionResponse;
      if (data?.version && data.version !== CURRENT_RELEASE.version) {
        // Versi baru ditemukan!
        setNewVersion(data.versionLabel || `v${data.version}`);
      }
    } catch {
      // Abaikan jika offline / gagal fetch
    }
  }, []);

  useEffect(() => {
    // 1. Cek pertama saat aplikasi dibuka (tunda 3 detik agar load awal selesai)
    const initialTimer = setTimeout(() => {
      void checkForUpdate();
    }, 3000);

    // 2. Cek berkala setiap 45 detik
    const interval = setInterval(() => {
      void checkForUpdate();
    }, 45000);

    // 3. Cek saat tab atau jendela kembali aktif / difokuskan oleh pengguna
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };
    const handleFocus = () => void checkForUpdate();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkForUpdate]);

  const handleApplyUpdate = () => {
    triggerHaptic(20);
    setIsUpdating(true);
    // Reload halaman - sesi login Firebase tetap utuh tersimpan di IndexedDB
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  if (!newVersion || dismissed) return null;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#00512C] text-white shadow-2xl border border-white/20 backdrop-blur-xl">
        {/* Glow ambient background */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-500/20 pointer-events-none" />

        <div className="relative flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-emerald-300 border border-white/20 shadow-inner">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-xs font-bold tracking-tight text-white truncate">
                Pembaruan Baru {newVersion}
              </p>
            </div>
            <p className="text-[11px] text-emerald-100/90 truncate font-medium">
              Siap dipasang tanpa perlu login ulang.
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 rounded-xl bg-white text-[#00512C] px-3 py-2 text-xs font-bold hover:bg-emerald-50 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-75"
          >
            <RefreshCw size={13} className={isUpdating ? "animate-spin" : ""} />
            <span>{isUpdating ? "Memuat..." : "Perbarui"}</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup pemberitahuan"
            aria-label="Tutup"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoUpdateBanner;
