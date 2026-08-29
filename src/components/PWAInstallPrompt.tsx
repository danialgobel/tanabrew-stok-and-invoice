import { useState, useEffect } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { Download, Share, PlusSquare, X, Smartphone, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Only show on mobile devices (width <= 768px or touch mobile)
    const isMobileDevice =
      window.innerWidth <= 768 ||
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobileDevice) {
      return; // Do NOT show on Desktop/Laptop!
    }

    // 2. Check if already installed as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; // Already installed, do not show!
    }

    // 3. Check if recently dismissed in last 24 hours
    const lastDismissed = localStorage.getItem("tanabrew_pwa_dismissed");
    if (lastDismissed) {
      const diffHours = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60);
      if (diffHours < 24) {
        return;
      }
    }

    // 4. Detect iOS Safari
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS guide after 2.5 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    // 5. Android / Chromium Mobile beforeinstallprompt handler
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after 2 seconds
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    triggerHaptic(20);
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    triggerHaptic(10);
    localStorage.setItem("tanabrew_pwa_dismissed", Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      onClick={handleDismiss}
    >
      <div
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-border shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 duration-200"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="flex justify-center pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header with App Logo */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/tanabrew-logo.png"
              alt="Tanabrew Logo"
              className="h-14 w-14 rounded-2xl border border-primary/20 shadow-md object-contain bg-background p-1"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 id="pwa-install-title" className="text-base font-bold text-foreground">Pasang Tanabrew</h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary border border-primary/20 uppercase">
                  Web App
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Akses cepat, hemat data & praktis di HP Anda
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Tutup dialog pasang aplikasi"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content based on OS */}
        {isIOS ? (
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 space-y-2.5 text-xs text-foreground">
            <p className="font-bold flex items-center gap-1.5 text-primary text-[11px] uppercase tracking-wider">
              <Smartphone size={13} /> Cara Tambah di Layar Utama iPhone:
            </p>
            <ol className="space-y-2 text-muted-foreground pl-1">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  1
                </span>
                <span>
                  Ketuk ikon <strong>Bagikan / Share</strong> (<Share size={13} className="inline mx-0.5 text-primary" />) di bilah bawah Safari.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  2
                </span>
                <span>
                  Gulir ke bawah lalu pilih <strong>"Tambahkan ke Layar Utama"</strong> (<PlusSquare size={13} className="inline mx-0.5 text-primary" />).
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  3
                </span>
                <span>
                  Ketuk <strong>"Tambah"</strong> di pojok kanan atas layar iPhone Anda.
                </span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-3.5 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary" /> Fitur Unggulan Versi Aplikasi:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px]">
              <li>Buka aplikasi dalam 1 detik tanpa ketik URL di browser.</li>
              <li>Notifikasi pesanan & obrolan tim masuk langsung ke layar kunci.</li>
              <li>Tampilan layar penuh tanpa bilah pencarian browser.</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 rounded-2xl border border-border bg-card py-3 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
          >
            Nanti Saja
          </button>

          {isIOS ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-98 transition-all"
            >
              Saya Mengerti
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-98 transition-all"
            >
              <Download size={14} />
              Tambahkan Sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
