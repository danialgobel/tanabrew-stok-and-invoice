export interface PricelistItem {
  id?: string;
  nama_barang: string;
  harga: string | number;
  harga_b2b?: string | number;
  deskripsi?: string;
}

export interface PricelistCategory {
  id: string;
  name: string;
  items: PricelistItem[];
}

export interface PrintPricelistInput {
  categories: PricelistCategory[];
  stockLocation: "Jogja" | "Lombok" | "Semua";
  printedBy: string;
  roleLabel: string;
  priceMode?: "normal" | "b2b";
}

type PricelistWindow = Window | null;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatPrice = (priceVal: string | number) => {
  const num = Number(priceVal);
  if (!isNaN(num) && priceVal !== "") {
    const formatted = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
    return `Rp.${formatted}.00`;
  }
  return String(priceVal);
};

const pricelistShellHtml = (bodyHtml: string) => {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tanabrew Price List</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Outfit:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { 
      size: A4; 
      margin: 0; /* Zero page margin to allow full-bleed printing edge-to-edge */
    }
    
    * { 
      box-sizing: border-box; 
    }
    
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #edf4f0;
      color: #1b5e20;
      font-family: 'Outfit', 'Poppins', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: hidden;
    }

    /* Web Preview Only Toolbar */
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      background: #ffffff;
      border-bottom: 1px solid #c8e6c9;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    
    .back-button {
      min-height: 38px;
      border: 0;
      border-radius: 8px;
      background: #2e7d32;
      color: #fff;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      transition: background 0.2s;
    }
    
    .back-button:hover {
      background: #1b5e20;
    }
    
    .back-note {
      font-size: 12px;
      color: #556f5a;
    }

    /* Container for the pricelist sheet */
    .pricelist-container {
      position: relative;
      width: 100%;
      height: 100%;
      padding: 16mm 18mm 16mm 18mm; /* Acts as the paper margins */
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 10;
    }

    /* SVG watermarked leaf background covering the page */
    .bg-pattern {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    }

    /* Header styling matching the image layout */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 10px;
      height: 80px; /* Restrict height to prevent layout push */
    }

    .header-left {
      display: flex;
      align-items: center;
      overflow: visible; /* Let negative margins overflow safely */
    }

    .header-left img {
      height: 210px !important; /* Scale up image to make internal graphic large */
      width: auto !important;
      margin-top: -65px !important; /* Crop top blank space */
      margin-bottom: -65px !important; /* Crop bottom blank space */
      margin-left: -50px !important; /* Shift left to collapse left blank space */
      object-fit: contain !important;
      display: block !important;
    }
    
    .header-right {
      text-align: right;
    }
    
    .header-right h1 {
      margin: 0;
      font-family: 'Outfit', sans-serif;
      font-size: 40px;
      font-weight: 800;
      color: #1b5e20;
      letter-spacing: 2px;
      line-height: 1;
    }

    /* Content split by vertical separator */
    .content-section {
      position: relative;
      margin-top: 10px;
      flex-grow: 1;
    }
    
    .vertical-divider {
      position: absolute;
      left: 71.5%;
      top: 36px;
      bottom: 0;
      width: 2.5px;
      background-color: #1b5e20;
      z-index: 1;
    }
    
    .column-headers {
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: 20px;
      color: #1b5e20;
      margin-bottom: 20px;
      font-family: 'Outfit', sans-serif;
      letter-spacing: 1px;
    }
    
    .col-product {
      width: 68%;
    }
    
    .col-price {
      width: 28%;
      text-align: right;
      padding-right: 5px;
    }

    /* Categories / Criteria layout */
    .category-group {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    
    .category-title {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: 19px !important; /* Prominent category header, larger than product text */
      color: #1b5e20;
      margin: 25px 0 16px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    
    .product-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      page-break-inside: avoid;
    }
    
    .product-info {
      width: 68%;
    }
    
    .product-name {
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 13.5px !important;
      color: #1b5e20;
      line-height: 1.25;
    }
    
    .product-desc {
      font-family: 'Poppins', sans-serif;
      font-size: 10.5px !important;
      color: #556f5a;
      margin-top: 3px;
      line-height: 1.4;
      font-weight: 400;
    }
    
    .product-price {
      width: 28%;
      text-align: right;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 13.5px !important;
      color: #1b5e20;
      padding-top: 1px;
      white-space: nowrap;
      padding-right: 5px;
    }

    /* Footer styling */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 15px;
      margin-top: 30px;
      font-family: 'Outfit', sans-serif;
      page-break-inside: avoid;
    }
    
    .contacts {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .contact-item {
      display: flex;
      align-items: center;
      font-size: 12.5px;
      font-weight: 700;
      color: #1b5e20;
      line-height: 1;
    }
    
    .contact-icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      color: #1b5e20;
      flex-shrink: 0;
    }

    .trademark {
      font-family: 'Dancing Script', cursive;
      font-size: 21px;
      color: #1b5e20;
      font-weight: 700;
      letter-spacing: 0.5px;
      line-height: 1;
      padding-bottom: 2px;
    }

    /* Print settings */
    @media print {
      .no-print { 
        display: none !important; 
      }
      html, body {
        background-color: #edf4f0;
      }
      .pricelist-container {
        padding: 16mm 18mm 16mm 18mm;
        height: 100vh;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button type="button" class="back-button" onclick="window.close()">&larr; Kembali ke Tanabrew</button>
    <span class="back-note">Gunakan dialog cetak browser untuk menyimpan PDF berkualitas tinggi (Save as PDF) or print langsung.</span>
  </div>

  ${bodyHtml}

  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){
        try { 
          window.focus(); 
          window.print(); 
        } catch (error) {
          console.error(error);
        }
      }, 500);
    });
  <\/script>
</body>
</html>`;
};

export const printPricelist = ({ categories, stockLocation, printedBy, roleLabel, priceMode = "normal" }: PrintPricelistInput, reportWindow?: PricelistWindow) => {
  const isB2B = priceMode === "b2b";
  // Build category blocks
  const categoriesHtml = categories
    .filter(cat => cat.items && cat.items.length > 0)
    .map(cat => {
      const itemsHtml = cat.items
        .map(item => {
          const displayPrice = isB2B
            ? (item.harga_b2b !== undefined && item.harga_b2b !== "" ? item.harga_b2b : item.harga)
            : item.harga;
          return `
          <div class="product-row">
            <div class="product-info">
              <div class="product-name">${escapeHtml(item.nama_barang)}</div>
              ${item.deskripsi ? `<div class="product-desc">${escapeHtml(item.deskripsi)}</div>` : ""}
            </div>
            <div class="product-price">${escapeHtml(formatPrice(displayPrice))}</div>
          </div>
        `;
        })
        .join("");

      return `
        <div class="category-group">
          <div class="category-title">${escapeHtml(cat.name)}</div>
          ${itemsHtml}
        </div>
      `;
    })
    .join("");

  const pageHtml = `
    <div class="pricelist-container">
      <!-- Watermarked Leaf SVG Background (Accurate Monstera outline leaves pattern) -->
      <svg class="bg-pattern" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1130">
        <!-- Solid light mint background -->
        <rect width="100%" height="100%" fill="#edf4f0" />
        
        <!-- Large organic mint leaf silhouettes (Detailed palmate leaf paths with deep cuts) -->
        <g transform="translate(-140, 60) rotate(15) scale(1.6)" fill="#f6faf7">
          <path d="M150,400 C140,320 80,250 50,220 C80,260 120,320 140,360 C120,300 50,180 20,140 C60,190 110,290 135,345 C110,270 30,120 10,70 C50,120 100,240 130,330 C115,240 50,70 40,10 C80,70 120,200 140,310 C140,200 110,50 110,0 C130,40 150,150 150,280 C150,150 170,40 190,0 C190,50 160,200 160,310 C180,200 220,70 260,10 C250,70 185,240 170,330 C200,240 250,120 290,70 C270,120 190,270 165,345 C220,290 270,190 310,140 C280,180 210,300 160,360 C210,320 250,260 280,220 C250,250 190,320 180,400 Z" />
        </g>
        <g transform="translate(480, 200) rotate(-35) scale(1.8)" fill="#f6faf7">
          <path d="M150,400 C140,320 80,250 50,220 C80,260 120,320 140,360 C120,300 50,180 20,140 C60,190 110,290 135,345 C110,270 30,120 10,70 C50,120 100,240 130,330 C115,240 50,70 40,10 C80,70 120,200 140,310 C140,200 110,50 110,0 C130,40 150,150 150,280 C150,150 170,40 190,0 C190,50 160,200 160,310 C180,200 220,70 260,10 C250,70 185,240 170,330 C200,240 250,120 290,70 C270,120 190,270 165,345 C220,290 270,190 310,140 C280,180 210,300 160,360 C210,320 250,260 280,220 C250,250 190,320 180,400 Z" />
        </g>
        <g transform="translate(-100, 750) rotate(35) scale(1.3)" fill="#f6faf7">
          <path d="M150,400 C140,320 80,250 50,220 C80,260 120,320 140,360 C120,300 50,180 20,140 C60,190 110,290 135,345 C110,270 30,120 10,70 C50,120 100,240 130,330 C115,240 50,70 40,10 C80,70 120,200 140,310 C140,200 110,50 110,0 C130,40 150,150 150,280 C150,150 170,40 190,0 C190,50 160,200 160,310 C180,200 220,70 260,10 C250,70 185,240 170,330 C200,240 250,120 290,70 C270,120 190,270 165,345 C220,290 270,190 310,140 C280,180 210,300 160,360 C210,320 250,260 280,220 C250,250 190,320 180,400 Z" />
        </g>
        <g transform="translate(500, 720) rotate(-15) scale(1.5)" fill="#f6faf7">
          <path d="M150,400 C140,320 80,250 50,220 C80,260 120,320 140,360 C120,300 50,180 20,140 C60,190 110,290 135,345 C110,270 30,120 10,70 C50,120 100,240 130,330 C115,240 50,70 40,10 C80,70 120,200 140,310 C140,200 110,50 110,0 C130,40 150,150 150,280 C150,150 170,40 190,0 C190,50 160,200 160,310 C180,200 220,70 260,10 C250,70 185,240 170,330 C200,240 250,120 290,70 C270,120 190,270 165,345 C220,290 270,190 310,140 C280,180 210,300 160,360 C210,320 250,260 280,220 C250,250 190,320 180,400 Z" />
        </g>
        
        <!-- Detailed leafy structures at the corners -->
        <g transform="translate(680, -20) rotate(45) scale(1.1)">
          <path d="M0,0 C60,-90 150,-60 120,60 C60,120 0,90 0,0" fill="#dbedd3" opacity="0.4"/>
          <path d="M0,0 Q60,30 120,60" fill="none" stroke="#abcfa1" stroke-width="1.5" opacity="0.4"/>
        </g>
        <g transform="translate(-50, 980) rotate(-45) scale(1.1)">
          <path d="M0,0 C60,-90 150,-60 120,60 C60,120 0,90 0,0" fill="#dbedd3" opacity="0.4"/>
          <path d="M0,0 Q60,30 120,60" fill="none" stroke="#abcfa1" stroke-width="1.5" opacity="0.4"/>
        </g>
      </svg>

      <div class="content-wrapper-box">
        <!-- Header -->
        <div class="header">
          <!-- Perfectly Integrated Official High-Resolution Logo from image 2 -->
          <div class="header-left">
            <img src="/logo-pricelist.png" style="height: 210px !important; width: auto !important; margin-top: -65px !important; margin-bottom: -65px !important; margin-left: -50px !important; display: block !important; object-fit: contain !important;" />
          </div>
          <div class="header-right">
            <h1>PRICE LIST</h1>
            ${isB2B ? `<div style="margin-top:6px;display:inline-block;background:#1565c0;color:#fff;font-family:'Outfit',sans-serif;font-size:13px;font-weight:800;letter-spacing:2px;padding:3px 12px;border-radius:20px;">B2B</div>` : ""}
          </div>
        </div>

        <!-- Main Product Columns -->
        <div class="content-section">
          <!-- Central Divider Line -->
          <div class="vertical-divider"></div>
          
          <!-- Columns Header -->
          <div class="column-headers">
            <div class="col-product">PRODUCT</div>
            <div class="col-price">${isB2B ? "B2B PRICE" : "PRICE"}</div>
          </div>

          <!-- Price List Categories list -->
          <div class="categories-list">
            ${categoriesHtml}
          </div>
        </div>
      </div>

      <!-- Footer Contacts & Signature -->
      <div class="footer">
        <div class="contacts">
          <div class="contact-item">
            <!-- Instagram Icon (Stroke-based design with fill overridden to none) -->
            <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            tanabrew.tm
          </div>
          <div class="contact-item">
            <!-- WhatsApp Icon (Filled path design with explicit currentColor fill) -->
            <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.528 2.01 14.069.99 11.458.99c-5.44 0-9.867 4.37-9.871 9.8-.001 1.954.512 3.86 1.486 5.568L1.984 21.6l5.421-1.42c-.752.544-1.042.753-1.258.974zm12.338-7.25c-.29-.145-1.72-.848-1.986-.944-.266-.096-.46-.145-.654.145-.193.29-.748.944-.917 1.139-.17.194-.338.217-.628.072-.29-.145-1.226-.452-2.335-1.44-1.066-.95-1.786-2.123-1.996-2.482-.21-.36-.022-.554.158-.733.16-.16.36-.419.54-.628.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.6-.09-.15-.654-1.572-.896-2.152-.236-.569-.475-.492-.654-.502-.17-.008-.362-.01-.555-.01s-.507.072-.773.36c-.266.29-1.014.99-1.014 2.413 0 1.423 1.038 2.796 1.182 2.99.145.193 2.04 3.116 4.939 4.367.69.298 1.229.476 1.65.61.693.22 1.324.19 1.823.115.556-.084 1.72-.702 1.962-1.38.242-.678.242-1.257.17-1.38-.073-.122-.266-.195-.556-.34z"/>
            </svg>
            0881-3728-621
          </div>
        </div>
        <div class="trademark">
          Tanabrew Roastery Trademark
        </div>
      </div>
    </div>
  `;

  const html = pricelistShellHtml(pageHtml);
  
  const popup = reportWindow || window.open("", "_blank");
  if (!popup) return false;
  
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
};
