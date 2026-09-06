import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { CURRENT_RELEASE } from "@/config/appRelease";
import { triggerHaptic } from "@/lib/haptics";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { isAdminRole } from "@/lib/roleUtils";

interface VersionResponse {
  version?: string;
  versionLabel?: string;
  releaseDate?: string;
}

/**
 * Memeriksa apakah versi remote strictly lebih baru dibandingkan versi lokal
 * Menggunakan Semantic Versioning (contoh: 3.3.11 > 3.3.10)
 */
export function isNewerVersion(remote?: string | null, local?: string | null): boolean {
  if (!remote || !local) return false;
  const clean = (v: string) => String(v).replace(/^[^\d]*/, "").trim();
  const rParts = clean(remote).split(".").map((n) => parseInt(n, 10) || 0);
  const lParts = clean(local).split(".").map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export const AutoUpdateBanner = () => {
  const { userProfile } = useAuth();
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const lastCheckTime = useRef<number>(0);

  const handleApplyUpdate = useCallback(() => {
    triggerHaptic(20);
    setIsUpdating(true);
    if (newVersion) {
      try {
        sessionStorage.setItem("tanabrew_applied_update", newVersion);
      } catch {
        // Abaikan error storage
      }
    }
    // Reload halaman secara manual ketika user siap - sesi login Firebase tetap utuh di IndexedDB
    setTimeout(() => {
      window.location.reload();
    }, 250);
  }, [newVersion]);

  const handleDismiss = useCallback(() => {
    triggerHaptic(10);
    if (newVersion) {
      try {
        sessionStorage.setItem("tanabrew_dismissed_update", newVersion);
      } catch {
        // Abaikan error storage
      }
    }
    setNewVersion(null);
  }, [newVersion]);

  const checkForUpdate = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckTime.current < 20000) return;
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
      if (data?.version && isNewerVersion(data.version, CURRENT_RELEASE.version)) {
        const v = data.versionLabel || `v${data.version}`;
        const dismissed = sessionStorage.getItem("tanabrew_dismissed_update");
        const applied = sessionStorage.getItem("tanabrew_applied_update");
        if (dismissed !== v && applied !== v) {
          setNewVersion(v);
        }
      }
    } catch {
      // Abaikan jika offline / koneksi sementara terputus
    }
  }, []);

  // 1. Sinkronkan nomor versi ke Firestore 'system/app_version' jika user adalah role admin/owner/webdev
  useEffect(() => {
    if (!userProfile) return;
    if (isAdminRole(userProfile.role, currentUser?.email)) {
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

  // 2. Realtime Listener Firestore: Deteksi pembaruan jika versi di server strictly lebih baru
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, "system", "app_version"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.version && isNewerVersion(data.version, CURRENT_RELEASE.version)) {
            const v = data.versionLabel || `v${data.version}`;
            const dismissed = sessionStorage.getItem("tanabrew_dismissed_update");
            const applied = sessionStorage.getItem("tanabrew_applied_update");
            if (dismissed !== v && applied !== v) {
              setNewVersion(v);
            }
          }
        }
      });
      return () => unsub();
    } catch {
      // Fallback ke HTTP polling
    }
  }, []);

  // 3. Pengecekan berkala (interval 60 detik) dan saat fokus tab kembali
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void checkForUpdate();
    }, 4000);

    const interval = setInterval(() => {
      void checkForUpdate();
    }, 60000);

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

  if (!newVersion) return null;

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
              Versi baru tersedia. Klik perbarui saat siap.
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
            <span>{isUpdating ? "Memuat..." : "Perbarui"}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup nontifikasi"
            aria-label="Tutup pembaruan"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
