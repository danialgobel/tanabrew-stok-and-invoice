import type { Invoice, Product } from "@/types";

interface CombinedReportSummary {
  totalInvoice: number;
  totalPemasukan: number;
  invoiceBelumLunas: number;
  stokHabis: number;
  stokMenipis: number;
}

interface ReportMeta {
  printedBy: string;
  roleLabel: string;
  periodLabel?: string;
  filterLabel?: string;
}

interface PrintInvoiceReportInput extends ReportMeta {
  invoices: Invoice[];
}

interface PrintStockReportInput extends ReportMeta {
  products: Product[];
}

interface PrintCombinedReportInput extends ReportMeta {
  invoices: Invoice[];
  products: Product[];
  summary?: CombinedReportSummary;
}

type ReportWindow = Window | null;

const logoUrl = "https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatPrintedAt = () =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

const getDateValue = (value: unknown) => {
  if (!value) return 0;

  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const formatDate = (value: unknown, fallback?: string) => {
  if (typeof value === "string" && value) return value;

  const time = getDateValue(value);
  if (!time) return fallback || "-";

  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(time));
};

const formatInvoiceDate = (invoice: Invoice) => invoice.tanggal || formatDate(invoice.created_at);

const getStockStatus = (product: Product) => {
  const total = product.total_stok || 0;
  if (total === 0) return "Habis";
  if (total > 0 && total <= 3) return "Menipis";
  return "Aman";
};

const stockStatusClass = (status: string) => {
  if (status === "Habis") return "status-red";
  if (status === "Menipis") return "status-orange";
  return "status-green";
};

const invoiceStatusClass = (status?: string) => (status === "LUNAS" ? "status-green" : "status-red");
const printStatusClass = (isPrinted?: boolean) => (isPrinted ? "status-green" : "status-red");

const invoiceSummary = (invoices: Invoice[]) => ({
  totalInvoice: invoices.length,
  totalPemasukan: invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
  invoiceLunas: invoices.filter((invoice) => invoice.status === "LUNAS").length,
  invoiceBelumLunas: invoices.filter((invoice) => invoice.status === "BELUM LUNAS").length,
  invoiceSudahDicetak: invoices.filter((invoice) => invoice.is_printed === true).length,
  invoiceBelumDicetak: invoices.filter((invoice) => invoice.is_printed !== true).length,
});

const stockSummary = (products: Product[]) => ({
  totalProduk: products.length,
  totalStok: products.reduce((sum, product) => sum + (product.total_stok || 0), 0),
  stokAman: products.filter((product) => (product.total_stok || 0) > 3).length,
  stokMenipis: products.filter((product) => (product.total_stok || 0) > 0 && (product.total_stok || 0) <= 3).length,
  stokHabis: products.filter((product) => (product.total_stok || 0) === 0).length,
});

const baseStyles = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #14381c;
    margin: 0;
    padding: 18px;
    font-size: 12px;
    background: #ffffff;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 3px solid #2e7d32;
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand img { width: 118px; height: auto; object-fit: contain; }
  h1 { color: #2e7d32; margin: 0; font-size: 20px; letter-spacing: 0; line-height: 1.25; }
  .submeta { color: #49624f; margin-top: 4px; line-height: 1.45; }
  .meta { text-align: right; line-height: 1.55; color: #49624f; white-space: nowrap; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0; }
  .summary-card { border: 1px solid #a5d6a7; border-radius: 8px; padding: 8px; background: #f4fbf4; }
  .summary-card.red { border-color: #f3b8b8; background: #fff0f0; }
  .summary-card.orange { border-color: #f2d283; background: #fff8df; }
  .summary-card span { display: block; color: #49624f; font-size: 10px; }
  .summary-card b { display: block; color: #2e7d32; font-size: 13px; margin-top: 4px; }
  .summary-card.red b { color: #b42318; }
  .summary-card.orange b { color: #9a6700; }
  h2 { color: #2e7d32; font-size: 14px; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #2e7d32; color: white; text-align: left; padding: 7px; border: 1px solid #2e7d32; }
  td { padding: 7px; border: 1px solid #cfe8d1; vertical-align: top; }
  tr:nth-child(even) td { background: #f7fbf7; }
  .right { text-align: right; }
  .center { text-align: center; }
  .status {
    display: inline-block;
    border-radius: 999px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }
  .status-green { color: #1f6b2a; background: #dff3df; border: 1px solid #a5d6a7; }
  .status-red { color: #9f1d1d; background: #ffe1e1; border: 1px solid #f3b8b8; }
  .status-orange { color: #7a5200; background: #fff0bd; border: 1px solid #f2d283; }
  .empty { border: 1px dashed #a5d6a7; border-radius: 8px; padding: 10px; color: #49624f; }
  .manual-print-note {
    border: 1px solid #a5d6a7;
    border-radius: 8px;
    background: #f4fbf4;
    color: #49624f;
    margin-top: 14px;
    padding: 10px;
  }
  .loading-wrap {
    min-height: 72vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .loading-card {
    border: 1px solid #a5d6a7;
    border-radius: 14px;
    background: #f4fbf4;
    padding: 22px;
    max-width: 340px;
  }
  .loading-card h1 { font-size: 18px; margin-bottom: 8px; }
  .loading-card p { color: #49624f; line-height: 1.55; margin: 0; }
  @media print {
    body { padding: 0; }
    .summary-card, th, td, .status, .manual-print-note { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const headerHtml = (title: string, meta: ReportMeta) => `
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="Tanabrew" />
      <div>
        <h1>${escapeHtml(title)}</h1>
        ${meta.periodLabel ? `<div class="submeta">Periode: ${escapeHtml(meta.periodLabel)}</div>` : ""}
        ${meta.filterLabel ? `<div class="submeta">Filter: ${escapeHtml(meta.filterLabel)}</div>` : ""}
      </div>
    </div>
    <div class="meta">
      <div>Tanggal cetak: ${escapeHtml(formatPrintedAt())}</div>
      <div>Dicetak oleh: ${escapeHtml(meta.printedBy)}</div>
      <div>Role: ${escapeHtml(meta.roleLabel)}</div>
    </div>
  </div>
`;

const invoiceTableHtml = (invoices: Invoice[]) => {
  if (invoices.length === 0) return `<div class="empty">Tidak ada invoice sesuai filter laporan.</div>`;

  const rows = invoices
    .map((invoice) => {
      const printLabel = invoice.is_printed ? "Sudah Dicetak" : "Belum Dicetak";
      return `
        <tr>
          <td>${escapeHtml(invoice.no_invoice || "-")}</td>
          <td>${escapeHtml(formatInvoiceDate(invoice))}</td>
          <td>${escapeHtml(invoice.customer || "-")}</td>
          <td class="right">${escapeHtml(formatCurrency(invoice.total))}</td>
          <td class="right">${escapeHtml(formatCurrency(invoice.jumlah_dibayar))}</td>
          <td class="right">${escapeHtml(formatCurrency(invoice.sisa))}</td>
          <td><span class="status ${invoiceStatusClass(invoice.status)}">${escapeHtml(invoice.status || "-")}</span></td>
          <td><span class="status ${printStatusClass(invoice.is_printed)}">${escapeHtml(printLabel)}</span></td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>No Invoice</th>
          <th>Tanggal</th>
          <th>Customer</th>
          <th class="right">Total</th>
          <th class="right">Dibayar</th>
          <th class="right">Sisa</th>
          <th>Status Bayar</th>
          <th>Status Cetak</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const stockTableHtml = (products: Product[]) => {
  if (products.length === 0) return `<div class="empty">Tidak ada stok sesuai filter laporan.</div>`;

  const rows = products
    .map((product) => {
      const status = getStockStatus(product);
      return `
        <tr>
          <td>${escapeHtml(product.nama_barang || "-")}</td>
          <td class="center">${escapeHtml(product.stok_jogja)}</td>
          <td class="center">${escapeHtml(product.stok_lombok)}</td>
          <td class="center">${escapeHtml(product.total_stok)}</td>
          <td class="right">${escapeHtml(formatCurrency(product.harga))}</td>
          <td><span class="status ${stockStatusClass(status)}">${escapeHtml(status)}</span></td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Nama Barang</th>
          <th class="center">Stok Jogja</th>
          <th class="center">Stok Lombok</th>
          <th class="center">Total Stok</th>
          <th class="right">Harga</th>
          <th>Status Stok</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

const reportShellHtml = (title: string, bodyHtml: string, autoPrint = true) => {
  const script = autoPrint
    ? `<script>
    window.addEventListener('load', function(){
      setTimeout(function(){
        try { window.focus(); window.print(); } catch (error) {}
      }, 300);
    });
  <\/script>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${baseStyles}</style></head><body>
  ${bodyHtml}
  <div class="manual-print-note">Jika dialog print tidak muncul otomatis, gunakan menu browser untuk Print atau Save as PDF.</div>
  ${script}
</body></html>`;
};

export const openReportWindow = () => {
  const popup = window.open("", "_blank");
  if (!popup) return null;

  popup.document.open();
  popup.document.write(reportShellHtml(
    "Menyiapkan Laporan Tanabrew",
    `<div class="loading-wrap"><div class="loading-card"><h1>Menyiapkan laporan Tanabrew...</h1><p>Mohon tunggu sebentar. Laporan akan tampil di halaman ini.</p></div></div>`,
    false,
  ));
  popup.document.close();

  return popup;
};

export const writeReportError = (reportWindow: ReportWindow, message: string) => {
  if (!reportWindow) return;

  reportWindow.document.open();
  reportWindow.document.write(reportShellHtml(
    "Laporan Tanabrew Gagal",
    `<div class="loading-wrap"><div class="loading-card"><h1>Gagal menyiapkan laporan</h1><p>${escapeHtml(message)}</p></div></div>`,
    false,
  ));
  reportWindow.document.close();
};

const openPrintWindow = (title: string, bodyHtml: string, reportWindow?: ReportWindow) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${baseStyles}</style></head><body>
  ${bodyHtml}
  <div class="manual-print-note">Jika dialog print tidak muncul otomatis, gunakan menu browser untuk Print atau Save as PDF.</div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){
        try { window.focus(); window.print(); } catch (error) {}
      }, 300);
    });
  <\/script>
</body></html>`;

  const popup = reportWindow || openReportWindow();
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
};

export const printInvoiceReport = ({ invoices, periodLabel, filterLabel, printedBy, roleLabel }: PrintInvoiceReportInput, reportWindow?: ReportWindow) => {
  const summary = invoiceSummary(invoices);
  const bodyHtml = `
    ${headerHtml("LAPORAN INVOICE TANABREW", { periodLabel, filterLabel, printedBy, roleLabel })}
    <div class="summary">
      <div class="summary-card"><span>Total Invoice</span><b>${summary.totalInvoice}</b></div>
      <div class="summary-card"><span>Total Pemasukan</span><b>${escapeHtml(formatCurrency(summary.totalPemasukan))}</b></div>
      <div class="summary-card"><span>Invoice Lunas</span><b>${summary.invoiceLunas}</b></div>
      <div class="summary-card red"><span>Invoice Belum Lunas</span><b>${summary.invoiceBelumLunas}</b></div>
      <div class="summary-card"><span>Invoice Sudah Dicetak</span><b>${summary.invoiceSudahDicetak}</b></div>
      <div class="summary-card red"><span>Invoice Belum Dicetak</span><b>${summary.invoiceBelumDicetak}</b></div>
    </div>
    <h2>Tabel Invoice</h2>
    ${invoiceTableHtml(invoices)}
  `;

  return openPrintWindow("Laporan Invoice Tanabrew", bodyHtml, reportWindow);
};

export const printStockReport = ({ products, filterLabel, printedBy, roleLabel }: PrintStockReportInput, reportWindow?: ReportWindow) => {
  const summary = stockSummary(products);
  const bodyHtml = `
    ${headerHtml("LAPORAN STOK TANABREW", { filterLabel, printedBy, roleLabel })}
    <div class="summary">
      <div class="summary-card"><span>Total Produk</span><b>${summary.totalProduk}</b></div>
      <div class="summary-card"><span>Total Stok</span><b>${summary.totalStok}</b></div>
      <div class="summary-card"><span>Stok Aman</span><b>${summary.stokAman}</b></div>
      <div class="summary-card orange"><span>Stok Menipis</span><b>${summary.stokMenipis}</b></div>
      <div class="summary-card red"><span>Stok Habis</span><b>${summary.stokHabis}</b></div>
    </div>
    <h2>Tabel Stok</h2>
    ${stockTableHtml(products)}
  `;

  return openPrintWindow("Laporan Stok Tanabrew", bodyHtml, reportWindow);
};

export const printTanabrewReport = ({
  invoices,
  products,
  periodLabel,
  printedBy,
  roleLabel,
  summary,
}: PrintCombinedReportInput, reportWindow?: ReportWindow) => {
  const stockInfo = stockSummary(products);
  const invoiceInfo = invoiceSummary(invoices);
  const combinedSummary = summary || {
    totalInvoice: invoiceInfo.totalInvoice,
    totalPemasukan: invoiceInfo.totalPemasukan,
    invoiceBelumLunas: invoiceInfo.invoiceBelumLunas,
    stokHabis: stockInfo.stokHabis,
    stokMenipis: stockInfo.stokMenipis,
  };
  const problemProducts = products.filter((product) => {
    const total = product.total_stok || 0;
    return total === 0 || (total > 0 && total <= 3);
  });
  const bodyHtml = `
    ${headerHtml("LAPORAN TANABREW", { periodLabel, printedBy, roleLabel })}
    <div class="summary">
      <div class="summary-card"><span>Total Invoice</span><b>${combinedSummary.totalInvoice}</b></div>
      <div class="summary-card"><span>Total Pemasukan</span><b>${escapeHtml(formatCurrency(combinedSummary.totalPemasukan))}</b></div>
      <div class="summary-card red"><span>Invoice Belum Lunas</span><b>${combinedSummary.invoiceBelumLunas}</b></div>
      <div class="summary-card red"><span>Stok Habis</span><b>${combinedSummary.stokHabis}</b></div>
      <div class="summary-card orange"><span>Stok Menipis</span><b>${combinedSummary.stokMenipis}</b></div>
    </div>
    <h2>Tabel Laporan Invoice</h2>
    ${invoiceTableHtml(invoices)}
    <h2>Tabel Stok Bermasalah</h2>
    ${stockTableHtml(problemProducts)}
  `;

  return openPrintWindow("Laporan Tanabrew", bodyHtml, reportWindow);
};
