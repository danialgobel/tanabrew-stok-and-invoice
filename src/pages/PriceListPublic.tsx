import { useState, useEffect } from "react";
import {
  subscribePriceListSettings,
  DEFAULT_PRICELIST_SETTINGS,
  type PriceListSettings,
} from "@/lib/pricelistService";
import {
  MessageCircle,
  Instagram,
  ZoomIn,
  X,
  ExternalLink,
  ChevronRight,
  Share2,
  Coffee,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export default function PriceListPublic() {
  const [settings, setSettings] = useState<PriceListSettings>(DEFAULT_PRICELIST_SETTINGS);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    document.title = "Tanabrew – Price List & Menu";
    const unsubscribe = subscribePriceListSettings((data) => {
      setSettings(data);
    });
    return () => unsubscribe();
  }, []);

  const cleanWaNumber = (num?: string) => {
    if (!num) return "62895392770243";
    let cleaned = num.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    }
    return cleaned;
  };

  const waLink = `https://wa.me/${cleanWaNumber(settings.whatsapp_number)}?text=${encodeURIComponent(
    settings.whatsapp_message || "Halo Tanabrew! Saya ingin bertanya dan memesan kopi dari Price List.",
  )}`;

  const igUsername = (settings.instagram_username || "tanabrew.id").replace("@", "");
  const igLink = settings.instagram_url || `https://instagram.com/${igUsername}`;

  const handleShare = async () => {
    const shareData = {
      title: settings.title || "Tanabrew – Price List",
      text: settings.subtitle || "Lihat daftar harga produk kopi berkualitas tinggi Tanabrew.",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-emerald-600 selection:text-white">
      {/* 1. TOP BRAND HEADER (DEEP FOREST GREEN) */}
      <header className="relative bg-gradient-to-b from-emerald-900 via-emerald-950 to-neutral-950 px-4 pt-8 pb-6 text-center border-b border-emerald-900/30 overflow-hidden">
        {/* Decorative Background Leaf Accent */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 opacity-10 pointer-events-none text-emerald-400">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 0 C20 30 10 70 50 100 C90 70 80 30 50 0 Z" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 -ml-12 -mt-12 w-36 h-36 opacity-10 pointer-events-none text-emerald-400">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 0 C20 30 10 70 50 100 C90 70 80 30 50 0 Z" />
          </svg>
        </div>

        <div className="relative max-w-md mx-auto space-y-2">
          {/* Brand Logo & Name */}
          <div className="inline-flex items-center gap-2 bg-emerald-800/40 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 shadow-inner">
            <Coffee size={14} className="text-emerald-400" />
            <span>Tanabrew Roastery</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-serif">
            {settings.title || "Tanabrew Price List"}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/80 leading-relaxed max-w-xs mx-auto">
            {settings.subtitle || "Daftar harga biji kopi & filter roast pilihan terbaik."}
          </p>

          <div className="pt-2 flex justify-center gap-2 text-xs">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-800/50 transition-all active:scale-95"
            >
              <Share2 size={13} />
              <span>{copied ? "Link Disalin! ✓" : "Bagikan Menu"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT (IMAGE FLYER & TAP TO ZOOM) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-5">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>

          <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl">
            {/* Tap to zoom badge */}
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium shadow-lg hover:bg-black/90 transition-all"
              >
                <ZoomIn size={13} className="text-emerald-400" />
                <span>Ketuk untuk Zoom</span>
              </button>
            </div>

            {/* Flyer Image Container */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="cursor-zoom-in relative bg-neutral-900 flex items-center justify-center min-h-[300px]"
            >
              {!imageLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900 text-neutral-500 text-xs">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <span>Memuat Price List...</span>
                </div>
              )}
              <img
                src={settings.image_url || DEFAULT_PRICELIST_SETTINGS.image_url}
                alt={settings.title || "Tanabrew Price List"}
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.01] ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-neutral-400 italic">
          💡 Tips: Ketuk gambar menu di atas untuk memperbesar rincian harga.
        </p>

        {/* 3. DIRECT ACTION BUTTONS (WHATSAPP & INSTAGRAM) */}
        <div className="space-y-3 pt-2">
          {/* WhatsApp Primary Button */}
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold shadow-lg shadow-emerald-950/50 hover:brightness-110 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageCircle size={22} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm">Pesan via WhatsApp</p>
                <p className="text-[11px] text-emerald-100 font-normal">Hubungi Barista / Kasir Tanabrew</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-white/80" />
          </a>

          {/* Instagram Secondary Button */}
          <a
            href={igLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-200 font-bold hover:bg-neutral-800/80 active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
                <Instagram size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm">Instagram @{igUsername}</p>
                <p className="text-[11px] text-neutral-400 font-normal">Update roastery & promo terbaru</p>
              </div>
            </div>
            <ExternalLink size={16} className="text-neutral-400" />
          </a>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500 space-y-1">
        <p className="font-semibold text-neutral-400">Tanabrew Coffee & Roastery</p>
        <p className="text-[10px]">Yogyakarta & Lombok • Real-time Digital Menu</p>
      </footer>

      {/* 5. FULLSCREEN LIGHTBOX ZOOM MODAL */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Top Bar with Close Button */}
          <div className="flex items-center justify-between p-4 z-10">
            <span className="text-xs text-neutral-400 flex items-center gap-1 font-medium">
              <Sparkles size={13} className="text-emerald-400" />
              {settings.title}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-neutral-800/80 text-white hover:bg-neutral-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Full Screen Image Scroll View */}
          <div
            className="flex-1 overflow-auto p-2 sm:p-6 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={settings.image_url || DEFAULT_PRICELIST_SETTINGS.image_url}
              alt="Price List Fullscreen"
              className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Bottom Floating Bar */}
          <div className="p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center gap-3">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg"
            >
              <MessageCircle size={15} />
              Pesan Sekarang
            </a>
            <button
              onClick={() => setLightboxOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
