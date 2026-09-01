import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { CURRENT_RELEASE } from "@/config/appRelease";
import { triggerHaptic } from "@/lib/haptics";
import { X, Sparkles, CheckCircle2, ArrowRight, Layers } from "lucide-react";

interface AppUpdateAnnouncementModalProps {
  forceOpen?: boolean;
  onForceClose?: () => void;
}

export const openAppChangelogModal = () => {
  window.dispatchEvent(new CustomEvent("tanabrew:open-changelog"));
};

export const AppUpdateAnnouncementModal = ({
  forceOpen,
  onForceClose,
}: AppUpdateAnnouncementModalProps) => {
  const { currentUser, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Periksa versi update otomatis saat pengguna login membuka aplikasi
  useEffect(() => {
    if (loading || !currentUser) return;

    try {
      const seenVersion = localStorage.getItem("tanabrew_seen_app_version");
      if (seenVersion !== CURRENT_RELEASE.version) {
        // Tunda sedikit agar transisi halaman awal selesai dengan mulus
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [currentUser, loading]);

  // Listener untuk membuka manual dari Halaman Akun
  useEffect(() => {
    const handleOpenManual = () => {
      triggerHaptic(15);
      setIsOpen(true);
    };

    window.addEventListener("tanabrew:open-changelog", handleOpenManual);
    return () => window.removeEventListener("tanabrew:open-changelog", handleOpenManual);
  }, []);

  const handleDismiss = useCallback(() => {
    triggerHaptic(20);
    try {
      localStorage.setItem("tanabrew_seen_app_version", CURRENT_RELEASE.version);
    } catch {
      // Ignore storage error
    }
    setIsOpen(false);
    if (onForceClose) onForceClose();
  }, [onForceClose]);

  const showModal = forceOpen !== undefined ? forceOpen : isOpen;

  if (!showModal) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-300"
      onClick={handleDismiss}
    >
      <div
        className="relative bg-card w-full max-w-md rounded-3xl p-6 border border-border shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 select-none text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol Tutup X di pojok kanan atas */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors z-10"
          aria-label="Tutup pembaruan"
        >
          <X size={18} />
        </button>

        {/* Header Visual: Logo Bulat & Badge Versi */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-3">
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-300 opacity-60 blur-xs animate-pulse"></div>
            <img
              src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
              alt="Tanabrew Logo"
              className="relative w-20 h-20 rounded-full object-cover border-2 border-primary bg-primary shadow-md"
            />
          </div>

          {/* Badge Versi Update di Bawah Logo */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-mono shadow-xs">
            <Sparkles size={13} className="text-primary animate-spin" style={{ animationDuration: "8s" }} />
            <span>Versi {CURRENT_RELEASE.versionLabel}</span>
            <span className="opacity-40">•</span>
            <span className="text-[11px] font-normal">{CURRENT_RELEASE.releaseDate}</span>
          </div>

          <h2 className="text-lg font-black text-foreground mt-3 tracking-tight">
            {CURRENT_RELEASE.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs">
            {CURRENT_RELEASE.subtitle}
          </p>
        </div>

        {/* Daftar Catatan Pembaruan (Highlights) */}
        <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
          {CURRENT_RELEASE.highlights.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 hover:border-primary/30 transition-all text-left space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <CheckCircle2 size={13} />
                  </div>
                  <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-7">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Tombol Aksi Utama */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground py-3.5 px-4 text-xs font-bold shadow-md hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Mengerti & Mulai Gunakan</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppUpdateAnnouncementModal;
