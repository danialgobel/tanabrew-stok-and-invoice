import { useState, useEffect } from "react";
import {
  subscribePriceListSettings,
  getCachedPriceListImage,
  DEFAULT_PRICELIST_IMAGE,
} from "@/lib/pricelistService";

export default function PriceListPublic() {
  const [imageUrl, setImageUrl] = useState<string>(() => getCachedPriceListImage() || "");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxClosing, setLightboxClosing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    document.title = "Tanabrew - Price List Resmi";

    // Subscribe to dynamic image changes in Firestore / API
    const unsubscribe = subscribePriceListSettings((data) => {
      if (data.image_url) {
        setImageUrl(data.image_url);
      }
    });

    return () => unsubscribe();
  }, []);

  const currentDisplayImage = imageUrl || DEFAULT_PRICELIST_IMAGE;

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
    <div className="tanabrew-pricelist-page min-h-screen flex flex-col font-['Poppins',sans-serif] bg-[#F0F6F2] text-[#1A1A1A]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

        .tanabrew-pricelist-page {
          --green-dark: #00381E;
          --green-main: #00512C;
          --green-mid: #086338;
          --green-accent: #11844B;
          --green-light: #2BA867;
          --green-pale: #F0F6F2;
          --green-border: #BCDDC5;
          --white: #FFFFFF;
          --text-dark: #14281B;
          --text-muted: #4B6E55;
          --shadow-sm: 0 2px 8px rgba(0, 81, 44, 0.08);
          --shadow-md: 0 4px 20px rgba(0, 81, 44, 0.12);
          --shadow-lg: 0 8px 40px rgba(0, 81, 44, 0.20);
          --radius-card: 18px;
          --radius-btn: 50px;
          --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background-image:
            radial-gradient(ellipse at 10% 0%, rgba(0, 81, 44, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 90% 100%, rgba(8, 99, 56, 0.07) 0%, transparent 55%);
        }

        .tb-header {
          background: linear-gradient(145deg, #00381E 0%, #00512C 55%, #086338 100%);
          color: #FFFFFF;
          padding: 26px 20px 22px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 81, 44, 0.22);
        }

        .tb-header::before,
        .tb-header::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          pointer-events: none;
        }
        .tb-header::before {
          width: 220px;
          height: 220px;
          top: -90px;
          left: -70px;
        }
        .tb-header::after {
          width: 170px;
          height: 170px;
          bottom: -70px;
          right: -50px;
        }

        .tb-logo-card {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #FFFFFF;
          padding: 12px 26px;
          border-radius: 20px;
          box-shadow: 0 10px 28px rgba(0, 35, 18, 0.25), 0 2px 6px rgba(0, 0, 0, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.9);
          animation: tbFadeDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .tb-logo-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px rgba(0, 35, 18, 0.30);
        }

        .tb-brand-logo {
          display: block;
          height: 48px;
          width: auto;
          max-width: 260px;
          object-fit: contain;
        }
        @media (min-width: 480px) {
          .tb-brand-logo {
            height: 54px;
            max-width: 300px;
          }
        }

        .tb-main-content {
          flex: 1;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          padding: 24px 16px 8px;
        }

        .tb-pricelist-section {
          margin-bottom: 24px;
        }

        .tb-pricelist-wrapper {
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 81, 44, 0.12);
          border: 1.5px solid #BCDDC5;
          background: #FFFFFF;
          animation: tbFadeUp 0.55s 0.15s ease both;
          min-height: 280px;
          position: relative;
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
          border-radius: 16px;
          transition: opacity 0.3s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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
          background: rgba(0, 81, 44, 0.88);
          color: #FFFFFF;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 5px 12px 5px 9px;
          border-radius: 50px;
          backdrop-filter: blur(5px);
          pointer-events: none;
          letter-spacing: 0.2px;
          box-shadow: 0 2px 10px rgba(0, 35, 18, 0.22);
          transition: opacity 0.25s ease;
        }

        .tb-pricelist-btn:hover .tb-zoom-hint {
          opacity: 0.85;
        }

        .tb-cta-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: tbFadeUp 0.55s 0.25s ease both;
        }

        .tb-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 52px;
          padding: 13px 22px;
          border-radius: 50px;
          font-family: 'Poppins', sans-serif;
          font-size: clamp(0.88rem, 3.6vw, 0.98rem);
          font-weight: 600;
          letter-spacing: 0.1px;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease, color 0.25s ease;
          -webkit-tap-highlight-color: transparent;
          border: 2px solid transparent;
          outline: none;
          text-decoration: none;
        }

        /* 1. Shopee Button - Official Shopee Orange */
        .tb-btn-shopee {
          background: linear-gradient(135deg, #EE4D2D 0%, #FF5722 100%);
          color: #FFFFFF !important;
          box-shadow: 0 4px 16px rgba(238, 77, 45, 0.35);
        }
        .tb-btn-shopee:hover {
          background: linear-gradient(135deg, #D73211 0%, #EE4D2D 100%);
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 24px rgba(238, 77, 45, 0.45);
        }
        .tb-btn-shopee:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 8px rgba(238, 77, 45, 0.3);
        }

        /* 2. WhatsApp Button - Tanabrew Signature Green */
        .tb-btn-whatsapp {
          background: linear-gradient(135deg, #00512C 0%, #086338 100%);
          color: #FFFFFF !important;
          box-shadow: 0 4px 16px rgba(0, 81, 44, 0.35);
        }
        .tb-btn-whatsapp:hover {
          background: linear-gradient(135deg, #00381E 0%, #00512C 100%);
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 6px 24px rgba(0, 81, 44, 0.45);
        }
        .tb-btn-whatsapp:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 8px rgba(0, 81, 44, 0.3);
        }

        /* 3. Instagram Button - Tanabrew Green Outline */
        .tb-btn-instagram {
          background: #FFFFFF;
          color: #00512C !important;
          border-color: #00512C;
          box-shadow: 0 2px 8px rgba(0, 81, 44, 0.10);
        }
        .tb-btn-instagram:hover {
          background: #F0F6F2;
          border-color: #00381E;
          color: #00381E !important;
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 4px 20px rgba(0, 81, 44, 0.15);
        }
        .tb-btn-instagram:active {
          transform: translateY(0) scale(0.98);
          box-shadow: none;
        }

        .tb-site-footer {
          text-align: center;
          padding: 24px 16px 28px;
          font-size: 0.78rem;
          color: #4B6E55;
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
          background: rgba(0, 32, 16, 0.90);
          cursor: zoom-out;
          backdrop-filter: blur(4px);
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
          border-radius: 14px;
          box-shadow: 0 12px 60px rgba(0, 0, 0, 0.65);
        }

        .tb-lightbox-close {
          position: absolute;
          top: -14px;
          right: -14px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #00512C;
          border: 2px solid rgba(255, 255, 255, 0.4);
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
          background: #086338;
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
        @keyframes tbPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
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
          .tb-pricelist-wrapper { box-shadow: 0 8px 40px rgba(0, 81, 44, 0.18); }
        }
        @media (min-width: 768px) {
          .tb-header { padding: 44px 40px 36px; }
          .tb-main-content { padding: 36px 0 16px; }
        }
      `}</style>

      {/* ===== HEADER ===== */}
      <header className="tb-header">
        <div className="relative z-10 flex flex-col items-center">
          <div className="tb-logo-card">
            <img
              src="/logo-pricelist.png"
              alt="Tanabrew Roastery"
              className="tb-brand-logo"
            />
          </div>
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
                src={currentDisplayImage}
                alt="Daftar harga produk Tanabrew Roastery - Single Origin Filter Roast dan Roasted Beans Espresso"
                className={`tb-pricelist-img ${imageLoaded ? "opacity-100" : "opacity-95"}`}
                id="pricelistImg"
                loading="eager"
                onLoad={() => setImageLoaded(true)}
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
        <section className="tb-cta-section" aria-label="Aksi dan Kontak Pembelian Tanabrew">
          {/* 1. Official Shopee Store Link */}
          <a
            href="https://id.shp.ee/qYbNbEvQ"
            className="tb-btn tb-btn-shopee"
            id="shopeeButton"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Order Produk Tanabrew via Shopee Official"
          >
            <svg
              className="w-5 h-5 shrink-0"
              role="img"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <title>Shopee</title>
              <path d="M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z"/>
            </svg>
            Order via Shopee Official
          </a>

          {/* 2. Direct WhatsApp Order */}
          <a
            href="https://wa.me/628813728621?text=Halo%20Tanabrew%2C%20saya%20tertarik%20dengan%20produknya%2C%20boleh%20minta%20info%20lebih%20lanjut%3F"
            className="tb-btn tb-btn-whatsapp"
            id="waButton"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat via WhatsApp dengan Tanabrew"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Chat via WhatsApp
          </a>

          {/* 3. Instagram Official Profile */}
          <a
            href="https://www.instagram.com/tanabrew.tm/"
            className="tb-btn tb-btn-instagram"
            id="igButton"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Kunjungi Instagram Tanabrew"
          >
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
        <p>© 2026 Tanabrew Roastery &nbsp;•&nbsp; Terima kasih sudah mampir</p>
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
              src={currentDisplayImage}
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
