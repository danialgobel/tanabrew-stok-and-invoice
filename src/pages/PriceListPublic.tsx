import { useState, useEffect } from "react";
import {
  subscribePriceListSettings,
  DEFAULT_PRICELIST_IMAGE,
} from "@/lib/pricelistService";

export default function PriceListPublic() {
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_PRICELIST_IMAGE);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxClosing, setLightboxClosing] = useState(false);

  useEffect(() => {
    document.title = "Tanabrew - Price List";

    // Subscribe to dynamic image changes in Firestore
    const unsubscribe = subscribePriceListSettings((data) => {
      if (data.image_url) {
        setImageUrl(data.image_url);
      }
    });

    return () => unsubscribe();
  }, []);

  const openLightbox = () => {
    setLightboxOpen(true);
    setLightboxClosing(false);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxClosing(true);
    setTimeout(() => {
      setLightboxOpen(false);
      setLightboxClosing(false);
      document.body.style.overflow = "";
    }, 200);
  };

  return (
    <div className="tanabrew-pricelist-page min-h-screen flex flex-col font-['Poppins',sans-serif] bg-[#F1F8F4] text-[#1A1A1A]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

        .tanabrew-pricelist-page {
          --green-dark: #1B5E20;
          --green-main: #2E7D32;
          --green-mid: #388E3C;
          --green-accent: #4CAF50;
          --green-light: #66BB6A;
          --green-pale: #F1F8F4;
          --green-border: #C8E6C9;
          --white: #FFFFFF;
          --text-dark: #1A1A1A;
          --text-muted: #5a7a5a;
          --shadow-sm: 0 2px 8px rgba(27, 94, 32, 0.10);
          --shadow-md: 0 4px 20px rgba(27, 94, 32, 0.15);
          --shadow-lg: 0 8px 40px rgba(27, 94, 32, 0.22);
          --radius-card: 16px;
          --radius-btn: 50px;
          --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background-image:
            radial-gradient(ellipse at 10% 0%, rgba(76, 175, 80, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 90% 100%, rgba(46, 125, 50, 0.07) 0%, transparent 55%);
        }

        .tb-header {
          background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #388E3C 100%);
          color: #FFFFFF;
          padding: 36px 20px 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(27, 94, 32, 0.15);
        }

        .tb-header::before,
        .tb-header::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
        }
        .tb-header::before {
          width: 200px;
          height: 200px;
          top: -80px;
          left: -60px;
        }
        .tb-header::after {
          width: 150px;
          height: 150px;
          bottom: -60px;
          right: -40px;
        }

        .tb-leaf-accent {
          width: 48px;
          height: 64px;
          margin: 0 auto 10px;
          opacity: 0.75;
        }

        .tb-brand-name {
          font-size: clamp(2.4rem, 8vw, 3.4rem);
          font-weight: 800;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.25);
          animation: tbFadeDown 0.6s ease both;
        }

        .tb-main-content {
          flex: 1;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          padding: 24px 16px 8px;
        }

        .tb-pricelist-section {
          margin-bottom: 28px;
        }

        .tb-pricelist-wrapper {
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(27, 94, 32, 0.15);
          border: 1.5px solid #C8E6C9;
          background: #FFFFFF;
          animation: tbFadeUp 0.55s 0.15s ease both;
        }

        .tb-pricelist-btn {
          display: block;
          width: 100%;
          padding: 0;
          margin: 0;
          border: none;
          background: none;
          cursor: zoom-in;
          position: relative;
          line-height: 0;
          -webkit-tap-highlight-color: transparent;
        }

        .tb-pricelist-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 14px;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tb-pricelist-btn:hover .tb-pricelist-img,
        .tb-pricelist-btn:focus-visible .tb-pricelist-img {
          transform: scale(1.01);
          filter: brightness(0.97);
        }

        .tb-zoom-hint {
          position: absolute;
          bottom: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(27, 94, 32, 0.82);
          color: #FFFFFF;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 5px 11px 5px 8px;
          border-radius: 50px;
          backdrop-filter: blur(4px);
          pointer-events: none;
          letter-spacing: 0.2px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          transition: opacity 0.25s ease;
        }

        .tb-pricelist-btn:hover .tb-zoom-hint {
          opacity: 0.8;
        }

        .tb-cta-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: tbFadeUp 0.55s 0.25s ease both;
        }

        .tb-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 54px;
          padding: 14px 24px;
          border-radius: 50px;
          font-family: 'Poppins', sans-serif;
          font-size: clamp(0.9rem, 3.8vw, 1rem);
          font-weight: 600;
          letter-spacing: 0.1px;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, color 0.25s ease;
          -webkit-tap-highlight-color: transparent;
          border: 2px solid transparent;
          outline: none;
          text-decoration: none;
        }

        .tb-btn-whatsapp {
          background: linear-gradient(135deg, #2E7D32 0%, #388E3C 100%);
          color: #FFFFFF !important;
          box-shadow: 0 4px 16px rgba(46, 125, 50, 0.35);
        }
        .tb-btn-whatsapp:hover {
          background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%);
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 24px rgba(27, 94, 32, 0.40);
        }
        .tb-btn-whatsapp:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 8px rgba(27, 94, 32, 0.3);
        }

        .tb-btn-instagram {
          background: #FFFFFF;
          color: #2E7D32 !important;
          border-color: #2E7D32;
          box-shadow: 0 2px 8px rgba(27, 94, 32, 0.10);
        }
        .tb-btn-instagram:hover {
          background: #F1F8F4;
          border-color: #1B5E20;
          color: #1B5E20 !important;
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 4px 20px rgba(27, 94, 32, 0.15);
        }
        .tb-btn-instagram:active {
          transform: translateY(0) scale(0.98);
          box-shadow: none;
        }

        .tb-site-footer {
          text-align: center;
          padding: 20px 16px 28px;
          font-size: 0.78rem;
          color: #5a7a5a;
          letter-spacing: 0.2px;
        }

        .tb-lightbox {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .tb-lightbox-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(10, 35, 12, 0.88);
          cursor: zoom-out;
          backdrop-filter: blur(3px);
        }

        .tb-lightbox-content {
          position: relative;
          z-index: 1;
          max-width: min(680px, 100%);
          max-height: calc(100dvh - 32px);
          width: 100%;
          animation: tbLightboxIn 0.25s ease both;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .tb-lightbox-img {
          width: 100%;
          height: auto;
          max-height: calc(100dvh - 80px);
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 12px 60px rgba(0,0,0,0.55);
        }

        .tb-lightbox-close {
          position: absolute;
          top: -14px;
          right: -14px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #1B5E20;
          border: 2px solid rgba(255,255,255,0.3);
          color: #FFFFFF;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          z-index: 2;
          transition: background 0.25s ease, transform 0.25s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .tb-lightbox-close:hover {
          background: #388E3C;
          transform: scale(1.1);
        }
        .tb-lightbox-close:active {
          transform: scale(0.95);
        }

        @keyframes tbFadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tbFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tbLightboxIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes tbLightboxOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.92); }
        }

        .tb-lightbox.closing .tb-lightbox-content {
          animation: tbLightboxOut 0.2s ease both;
        }
        .tb-lightbox.closing .tb-lightbox-backdrop {
          animation: tbFadeDown 0.2s ease both;
          opacity: 0;
        }

        @media (min-width: 480px) {
          .tb-main-content { padding: 32px 24px 12px; }
          .tb-pricelist-wrapper { box-shadow: 0 8px 40px rgba(27, 94, 32, 0.22); }
        }
        @media (min-width: 768px) {
          .tb-header { padding: 48px 40px 40px; }
          .tb-main-content { padding: 40px 0 16px; }
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <header className="tb-header">
        <div className="relative z-10">
          {/* Leaf accent SVG */}
          <div className="tb-leaf-accent" aria-hidden="true">
            <svg viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 75 C10 55 5 30 30 5 C55 30 50 55 30 75Z" fill="rgba(255,255,255,0.15)" />
              <line x1="30" y1="75" x2="30" y2="5" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" strokeDasharray="4 3"/>
            </svg>
          </div>
          <h1 className="tb-brand-name">Tanabrew</h1>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="tb-main-content">
        {/* Price List Image Section */}
        <section className="tb-pricelist-section" aria-label="Daftar Harga Produk Tanabrew">
          <div className="tb-pricelist-wrapper">
            <button
              type="button"
              className="tb-pricelist-btn"
              id="openLightbox"
              onClick={openLightbox}
              aria-label="Tap untuk memperbesar gambar daftar harga"
            >
              <img
                src={imageUrl}
                alt="Daftar harga produk Tanabrew Roastery - Single Origin Filter Roast dan Roasted Beans Espresso"
                className="tb-pricelist-img"
                id="pricelistImg"
                loading="eager"
              />
              <div className="tb-zoom-hint" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                  <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Tap untuk zoom
              </div>
            </button>
          </div>
        </section>

        {/* CTA Buttons Section */}
        <section className="tb-cta-section" aria-label="Hubungi Kami">
          <a
            href="https://wa.me/628813728621?text=Halo%20Tanabrew%2C%20saya%20tertarik%20dengan%20produknya%2C%20boleh%20minta%20info%20lebih%20lanjut%3F"
            className="tb-btn tb-btn-whatsapp"
            id="waButton"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat via WhatsApp dengan Tanabrew"
          >
            {/* WhatsApp Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Chat via WhatsApp
          </a>

          <a
            href="https://www.instagram.com/tanabrew.tm/"
            className="tb-btn tb-btn-instagram"
            id="igButton"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Kunjungi Instagram Tanabrew"
          >
            {/* Instagram Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
            Follow Instagram Kami
          </a>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="tb-site-footer">
        <p>© 2026 Tanabrew &nbsp;•&nbsp; Terima kasih sudah mampir ✨</p>
      </footer>

      {/* ===== LIGHTBOX ===== */}
      {lightboxOpen && (
        <div className={`tb-lightbox ${lightboxClosing ? "closing" : ""}`} role="dialog" aria-modal="true">
          <div className="tb-lightbox-backdrop" onClick={closeLightbox}></div>
          <div className="tb-lightbox-content">
            <button type="button" className="tb-lightbox-close" onClick={closeLightbox} aria-label="Tutup zoom">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <img
              src={imageUrl}
              alt="Daftar harga produk Tanabrew Roastery - versi zoom"
              className="tb-lightbox-img"
              id="lightboxImg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
