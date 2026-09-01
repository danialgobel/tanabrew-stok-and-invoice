import { jsPDF } from "jspdf";
import { formatDisplayDate } from "@/lib/dateUtils";
import type { Invoice } from "@/types";

const formatCurrency = (val?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);

const fmtNumber = (val?: number) =>
  new Intl.NumberFormat("id-ID").format(val || 0);

export async function generateInvoicePdfBlob(invoice: Invoice): Promise<{ blob: Blob; base64: string; fileName: string }> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Header Background Accent Bar
  doc.setFillColor(46, 125, 50); // #2E7D32 Emerald Green
  doc.rect(0, 0, pageWidth, 4, "F");

  cursorY += 6;

  // 1. Company Brand & Invoice Meta Info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(46, 125, 50);
  doc.text("TANABREW", margin, cursorY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Roastery & Coffee Specialty", margin, cursorY + 11);

  // Right Meta Info
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const rightX = pageWidth - margin;
  
  doc.setFont("helvetica", "bold");
  doc.text(`No Invoice:`, rightX - 45, cursorY + 2, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(invoice.no_invoice || "-", rightX, cursorY + 2, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(`Tanggal:`, rightX - 45, cursorY + 7, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(formatDisplayDate(invoice.tanggal), rightX, cursorY + 7, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(`Customer:`, rightX - 45, cursorY + 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customer || "Umum", rightX, cursorY + 12, { align: "right" });

  if (invoice.stock_location) {
    doc.setFont("helvetica", "bold");
    doc.text(`Stok Keluar:`, rightX - 45, cursorY + 17, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(invoice.stock_location, rightX, cursorY + 17, { align: "right" });
  }

  cursorY += 24;

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50);
  doc.text("INVOICE PENJUALAN", pageWidth / 2, cursorY, { align: "center" });
  cursorY += 7;

  // 2. Items Table Header
  const colX = {
    nama: margin,
    harga: margin + 92,
    jumlah: margin + 128,
    subtotal: pageWidth - margin,
  };

  doc.setFillColor(237, 247, 237); // Light green background for header
  doc.roundedRect(margin, cursorY, contentWidth, 8, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Nama Barang", colX.nama + 3, cursorY + 5.5);
  doc.text("Harga", colX.harga, cursorY + 5.5, { align: "right" });
  doc.text("Jumlah", colX.jumlah, cursorY + 5.5, { align: "center" });
  doc.text("Subtotal", colX.subtotal - 3, cursorY + 5.5, { align: "right" });

  cursorY += 9;

  // Items Rows
  const items = Array.isArray(invoice.items) ? invoice.items.filter((i) => i.nama_barang) : [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  items.forEach((item, index) => {
    // Alternate row tint
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, cursorY - 1, contentWidth, 7, "F");
    }

    // Border bottom
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY + 6, pageWidth - margin, cursorY + 6);

    // Item texts
    doc.text(String(item.nama_barang || "-"), colX.nama + 3, cursorY + 4);
    doc.text(`Rp ${fmtNumber(item.harga)}`, colX.harga, cursorY + 4, { align: "right" });
    doc.text(String(item.jumlah || 1), colX.jumlah, cursorY + 4, { align: "center" });
    doc.text(`Rp ${fmtNumber(item.subtotal)}`, colX.subtotal - 3, cursorY + 4, { align: "right" });

    cursorY += 7.5;
  });

  cursorY += 4;

  // 3. Totals & Summary Block
  const summaryBoxWidth = 80;
  const summaryX = pageWidth - margin - summaryBoxWidth;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Subtotal", summaryX, cursorY);
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin, cursorY, { align: "right" });
  cursorY += 5.5;

  // Diskon (if any)
  if ((invoice.diskon || 0) > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Diskon", summaryX, cursorY);
    doc.text(`- ${formatCurrency(invoice.diskon)}`, pageWidth - margin, cursorY, { align: "right" });
    cursorY += 5.5;
  }

  // Total
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(summaryX, cursorY - 1, pageWidth - margin, cursorY - 1);
  cursorY += 1.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(46, 125, 50);
  doc.text("Total", summaryX, cursorY + 1);
  doc.text(formatCurrency(invoice.total), pageWidth - margin, cursorY + 1, { align: "right" });
  cursorY += 7;

  // Jumlah Dibayar
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Jumlah Dibayar", summaryX, cursorY);
  doc.text(formatCurrency(invoice.jumlah_dibayar), pageWidth - margin, cursorY, { align: "right" });
  cursorY += 5;

  // Sisa Pembayaran
  doc.text("Sisa Pembayaran", summaryX, cursorY);
  doc.text(formatCurrency(invoice.sisa), pageWidth - margin, cursorY, { align: "right" });
  cursorY += 5.5;

  // Status Badge
  const isLunas = invoice.status === "LUNAS";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Status:", summaryX, cursorY + 1);

  if (isLunas) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(pageWidth - margin - 30, cursorY - 3.5, 30, 6, 1, 1, "F");
    doc.setTextColor(22, 101, 52);
    doc.text("LUNAS", pageWidth - margin - 15, cursorY + 0.8, { align: "center" });
  } else {
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(pageWidth - margin - 35, cursorY - 3.5, 35, 6, 1, 1, "F");
    doc.setTextColor(153, 27, 27);
    doc.text("BELUM LUNAS", pageWidth - margin - 17.5, cursorY + 0.8, { align: "center" });
  }

  cursorY += 14;

  // 4. Payment Instructions Box
  const footBoxY = Math.max(cursorY, 230);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, footBoxY, contentWidth, 34, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Instruksi Pembayaran:", margin + 4, footBoxY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("• Transfer Seabank : 9011 2193 2420  (a.n. AHMAD FARID MUSADDAD)", margin + 4, footBoxY + 13);
  doc.text("• Transfer BSI         : 7196999501          (a.n. AHMAD FARID MUSADDAD)", margin + 4, footBoxY + 19);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Terima kasih telah mempercayakan kebutuhan kopi Anda kepada Tanabrew Roastery.", margin + 4, footBoxY + 28);

  const cleanNo = (invoice.no_invoice || "INV-TANABREW").replace(/[/\\?%*:|"<>]/g, "-");
  const fileName = `Invoice-${cleanNo}.pdf`;

  const blob = doc.output("blob");
  const base64 = doc.output("datauristring");

  return { blob, base64, fileName };
}
