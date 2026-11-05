import { jsPDF } from "jspdf";
import { formatInvoiceDate } from "@/lib/dateUtils";
import type { Invoice } from "@/types";
import { TANABREW_LOGO_BASE64 } from "@/lib/tanabrewLogoBase64";

const fmt = (val?: number) =>
  new Intl.NumberFormat("id-ID").format(val || 0);

export async function generateInvoicePdfBlob(invoice: Invoice): Promise<{ blob: Blob; base64: string; fileName: string }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12; // 12mm persis @page { size: A4; margin: 12mm; }
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin + 2;

  // 1. Header (Logo Tanabrew di kiri, Meta Info di kanan)
  try {
    // Rasio logo Tanabrew hijau ~140px / 3.78 ≈ 38mm x 11.5mm
    doc.addImage(TANABREW_LOGO_BASE64, "PNG", margin, cursorY, 40, 12);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(46, 125, 50); // #2E7D32
    doc.text("TANABREW", margin, cursorY + 9);
  }

  // Meta Info di kanan (Rata Kanan)
  const rightX = pageWidth - margin;
  doc.setFontSize(9);
  doc.setTextColor(17, 17, 17); // #111111

  const dateStr = formatInvoiceDate(invoice);

  // Helper untuk baris meta info kanan
  const renderMetaRow = (label: string, value: string, yPos: number) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102); // #666
    doc.text(`${label}: `, rightX - 52, yPos, { align: "right" });
    doc.setTextColor(17, 17, 17); // #111
    doc.setFont("helvetica", "normal");
    doc.text(value || "-", rightX, yPos, { align: "right" });
  };

  renderMetaRow("No Invoice", invoice.no_invoice || "-", cursorY + 3);
  renderMetaRow("Tanggal", dateStr, cursorY + 8);
  renderMetaRow("Customer", invoice.customer || "Umum", cursorY + 13);
  if (invoice.stock_location) {
    renderMetaRow("Stok Keluar", invoice.stock_location, cursorY + 18);
  } else if (invoice.nomor_rekening) {
    renderMetaRow("Nomor Rekening", invoice.nomor_rekening, cursorY + 18);
  }

  cursorY += 26;

  // 2. Judul Dokumen: "INVOICE" (Persis h2 di html: color #2E7D32)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(46, 125, 50); // #2E7D32
  doc.text("INVOICE", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 8;

  // 3. Tabel Item Barang (Persis header thead th: background #A5D6A7)
  const colX = {
    nama: margin,
    harga: margin + 96,
    jumlah: margin + 128,
    subtotal: pageWidth - margin,
  };

  const tableHeaderHeight = 7.5;
  doc.setFillColor(165, 214, 167); // #A5D6A7 (Hijau Sage Tanabrew Asli)
  doc.rect(margin, cursorY, contentWidth, tableHeaderHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 17, 17); // #111
  doc.text("Nama Barang", colX.nama + 3, cursorY + 5);
  doc.text("Harga", colX.harga, cursorY + 5, { align: "right" });
  doc.text("Jumlah", colX.jumlah, cursorY + 5, { align: "center" });
  doc.text("Subtotal", colX.subtotal - 3, cursorY + 5, { align: "right" });

  cursorY += tableHeaderHeight;

  // Baris-baris Item
  const items = Array.isArray(invoice.items) ? invoice.items.filter((i) => i.nama_barang) : [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(17, 17, 17);

  const rowHeight = 7;
  items.forEach((item) => {
    // Garis pemisah atas (border-top: 1px solid #ddd)
    doc.setDrawColor(221, 221, 221); // #ddd
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);

    // Teks item
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 17, 17);
    doc.text(String(item.nama_barang || "-"), colX.nama + 3, cursorY + 4.8);
    doc.text(`Rp ${fmt(item.harga)}`, colX.harga, cursorY + 4.8, { align: "right" });
    doc.text(String(item.jumlah || 1), colX.jumlah, cursorY + 4.8, { align: "center" });
    doc.text(`Rp ${fmt(item.subtotal)}`, colX.subtotal - 3, cursorY + 4.8, { align: "right" });

    cursorY += rowHeight;
  });

  // Garis penutup tabel
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);

  cursorY += 4;

  // 4. Bagian Ringkasan / Summary (Persis .sum & .row di HTML)
  // Garis atas summary (border-top: 1px solid #ddd; padding-top: 8px)
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 5;

  const sumBoxWidth = 85;
  const sumLabelX = pageWidth - margin - sumBoxWidth;
  const sumValX = pageWidth - margin - 3;
  const sumLineHeight = 5.2;

  const renderSumRow = (label: string, val: string, isBold = false, valColor?: [number, number, number]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(17, 17, 17);
    doc.text(label, sumLabelX, cursorY);

    if (valColor) {
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    } else {
      doc.setTextColor(17, 17, 17);
    }
    doc.text(val, sumValX, cursorY, { align: "right" });
    cursorY += sumLineHeight;
  };

  // Subtotal
  renderSumRow("Subtotal", `Rp ${fmt(invoice.subtotal)}`);

  // Diskon (jika ada)
  if ((invoice.diskon || 0) > 0) {
    renderSumRow("Diskon", `- Rp ${fmt(invoice.diskon)}`);
  }

  // Total (Bold)
  renderSumRow("Total", `Rp ${fmt(invoice.total)}`, true);

  // Jumlah Dibayar
  renderSumRow("Jumlah Dibayar", `Rp ${fmt(invoice.jumlah_dibayar)}`);

  // Sisa Pembayaran
  renderSumRow("Sisa Pembayaran", `Rp ${fmt(invoice.sisa)}`);

  // Status (Bold, Hijau jika LUNAS, Merah jika BELUM LUNAS)
  const isLunas = invoice.status === "LUNAS";
  const statusColor: [number, number, number] = isLunas ? [46, 125, 50] : [192, 57, 43]; // #2E7D32 or #c0392b
  renderSumRow("Status", invoice.status || "LUNAS", true, statusColor);

  // Dibuat Oleh (jika ada)
  if (invoice.dibuat_oleh) {
    renderSumRow("Dibuat Oleh", invoice.dibuat_oleh);
  }

  cursorY += 6;

  // 5. Bagian Footer Instruksi Pembayaran (Persis .foot di HTML)
  // Posisi di bawah summary atau minimal di Y = 220
  const footY = Math.max(cursorY, pageHeight - margin - 50);

  // Garis atas footer (border-top: 1px solid #ddd)
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.4);
  doc.line(margin, footY, pageWidth - margin, footY);

  const footContentY = footY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(17, 17, 17); // #111
  doc.text("Instruksi Pembayaran", margin, footContentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(85, 85, 85); // #555
  doc.text("Transfer ke Seabank a.n. AHMAD FARID MUSADDAD", margin, footContentY + 5.5);
  doc.text("No. Rekening 9011 2193 2420", margin, footContentY + 10);

  doc.text("Transfer ke Bank Jago a.n. AHMAD FARID MUSADDAD", margin, footContentY + 16.5);
  doc.text("No. Rekening 5021 3576 9162", margin, footContentY + 21);

  const cleanNo = (invoice.no_invoice || "INV-TANABREW").replace(/[/\\?%*:|"<>]/g, "-");
  const fileName = `Invoice-${cleanNo}.pdf`;

  const blob = doc.output("blob");
  const base64 = doc.output("datauristring");

  return { blob, base64, fileName };
}
