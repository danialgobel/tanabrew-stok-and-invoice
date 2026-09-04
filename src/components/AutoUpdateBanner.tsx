import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { CURRENT_RELEASE } from "@/config/appRelease";
import { triggerHaptic } from "@/lib/haptics";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface VersionResponse {
  version?: string;
  versionLabel?: string;
  releaseDate?: string;
}

export const AutoUpdateBanner = () => {
  const location = useLocation();
  const { userProfile } = useAuth();
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState<number>(6);
  const [isPaused, setIsPaused] = useState(false);
  const lastCheckTime = useRef<number>(0);

  // Periksa apakah user sedang berada di halaman kasir/cetak invoice yang sedang ada input
  const isSafeToAutoReload = location.pathname !== "/cetak-invoice";

  const handleApplyUpdate = useCallback(() => {
    triggerHaptic(20);
    setIsUpdating(true);
    // Reload halaman secara instan - sesi login Firebase tetap utuh di IndexedDB
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }, []);

  const checkForUpdate = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckTime.current < 12000) return;
    lastCheckTime.current = now;

    try {
      const res = await fetch(`/version.json?_t=${now}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return;

      const data = (await res.json()) as VersionResponse;
      if (data?.version && data.version !== CURRENT_RELEASE.version) {
        setNewVersion(data.versionLabel || `v${data.version}`);
      }
    } catch {
      // Abaikan jika offline / koneksi sementara terputus
    }
  }, []);

  // 1. Sinkronkan nomor versi ke Firestore 'system/app_version' jika user adalah role admin/owner/webdev
  useEffect(() => {
    if (!userProfile) return;
    const role = userProfile.role;
    if (role === "owner" || role === "webdev" || role === "admin") {
      void setDoc(
        doc(db, "system", "app_version"),
        {
          version: CURRENT_RELEASE.version,
          versionLabel: CURRENT_RELEASE.versionLabel,
          releaseDate: CURRENT_RELEASE.releaseDate,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }
  }, [userProfile]);

  // 2. Realtime Listener Firestore: Bangunkan semua tab browser yang sedang terbuka secara seketika!
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, "system", "app_version"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.version && data.version !== CURRENT_RELEASE.version) {
            setNewVersion(data.versionLabel || `v${data.version}`);
          }
        }
      });
      return () => unsub();
    } catch {
      // Fallback ke HTTP polling
    }
  }, []);

  // 3. Pengecekan berkala (interval 30 detik), fokus tab, dan saat user berpindah halaman
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void checkForUpdate();
    }, 2000);

    const interval = setInterval(() => {
      void checkForUpdate();
    }, 30000);

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

  // 4. Cek setiap kali user berganti menu navigasi
  useEffect(() => {
    void checkForUpdate();
  }, [location.pathname, checkForUpdate]);

  // 5. Hitung mundur auto-reload otomatis (6 detik) jika aman
  useEffect(() => {
    if (!newVersion || dismissed || isUpdating || isPaused) return;

    if (!isSafeToAutoReload) {
      // Di kasir, tunda auto-reload agar tidak mengganggu transaksi kasir yang sedang diketik
      return;
    }

    if (countdown <= 0) {
      handleApplyUpdate();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [newVersion, dismissed, isUpdating, isPaused, countdown, isSafeToAutoReload, handleApplyUpdate]);

  if (!newVersion || dismissed) return null;

  return (
    <div
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#00512C] text-white shadow-2xl border border-white/25 backdrop-blur-xl">
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-teal-500/20 to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-emerald-300 border border-white/20 shadow-inner">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-xs font-bold tracking-tight text-white truncate">
                Pembaruan Baru {newVersion}
              </p>
            </div>
            <p className="text-[11px] text-emerald-100/95 truncate font-medium mt-0.5">
              {isSafeToAutoReload && !isPaused
                ? `Memperbarui otomatis dalam ${countdown} dtk...`
                : "Siap dipasang tanpa perlu login ulang."}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 rounded-xl bg-white text-[#00512C] px-3 py-2 text-xs font-black hover:bg-emerald-50 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-75"
          >
            <RefreshCw size={13} className={isUpdating ? "animate-spin" : ""} />
            <span>{isUpdating ? "Memuat..." : isSafeToAutoReload && !isPaused ? `Perbarui (${countdown}s)` : "Perbarui"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setIsPaused(true);
              setDismissed(true);
            }}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Tunda pembaruan"
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
