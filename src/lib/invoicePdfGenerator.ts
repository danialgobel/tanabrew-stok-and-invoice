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
  const margin = 14; // Persis 14mm margin
  const contentWidth = pageWidth - margin * 2; // 182mm
  let cursorY = margin;

  // 1. Header (Logo Tanabrew di kiri, Meta Info di kanan)
  try {
    // Rasio proporsional logo Tanabrew
    doc.addImage(TANABREW_LOGO_BASE64, "PNG", margin, cursorY, 38, 11.5);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(46, 125, 50); // #2E7D32
    doc.text("tanabrew", margin, cursorY + 8);
  }

  // Meta Info Kanan (Rata Kanan)
  const rightX = pageWidth - margin;
  doc.setFontSize(8.5);

  const dateStr = formatInvoiceDate(invoice);

  const renderMetaRow = (label: string, value: string, yPos: number) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102); // #666
    doc.text(`${label}: `, rightX - 48, yPos, { align: "right" });
    doc.setTextColor(17, 17, 17); // #111
    doc.text(value || "-", rightX, yPos, { align: "right" });
  };

  renderMetaRow("No Invoice", invoice.no_invoice || "-", cursorY + 2);
  renderMetaRow("Tanggal", dateStr, cursorY + 6.5);
  renderMetaRow("Customer", invoice.customer || "Umum", cursorY + 11);
  if (invoice.nomor_rekening) {
    renderMetaRow("Nomor Rekening", invoice.nomor_rekening, cursorY + 15.5);
  } else if (invoice.stock_location) {
    renderMetaRow("Stok Keluar", invoice.stock_location, cursorY + 15.5);
  }

  cursorY += 24;

  // 2. Judul: "INVOICE" (Persis h2 di cetakan: warna #2E7D32)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(46, 125, 50); // #2E7D32
  doc.text("INVOICE", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 7;

  // 3. Tabel Item (Header: #A5D6A7 Hijau Sage)
  const colX = {
    nama: margin,
    harga: margin + 115,
    jumlah: margin + 138,
    subtotal: pageWidth - margin,
  };

  const tableHeaderHeight = 7;
  doc.setFillColor(165, 214, 167); // #A5D6A7
  doc.rect(margin, cursorY, contentWidth, tableHeaderHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(17, 17, 17); // #111
  doc.text("Nama Barang", colX.nama + 2.5, cursorY + 4.7);
  doc.text("Harga", colX.harga, cursorY + 4.7, { align: "right" });
  doc.text("Jumlah", colX.jumlah, cursorY + 4.7, { align: "center" });
  doc.text("Subtotal", colX.subtotal - 2.5, cursorY + 4.7, { align: "right" });

  cursorY += tableHeaderHeight;

  // Baris-baris Item
  const items = Array.isArray(invoice.items) ? invoice.items.filter((i) => i.nama_barang) : [];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(17, 17, 17);

  const rowHeight = 6.5;
  items.forEach((item) => {
    // Garis pembatas atas (#ddd)
    doc.setDrawColor(221, 221, 221); // #ddd
    doc.setLineWidth(0.2);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);

    // Teks item
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 17, 17);
    doc.text(String(item.nama_barang || "-"), colX.nama + 2.5, cursorY + 4.4);
    doc.text(`Rp${fmt(item.harga)}`, colX.harga, cursorY + 4.4, { align: "right" });
    doc.text(String(item.jumlah || 1), colX.jumlah, cursorY + 4.4, { align: "center" });
    doc.text(`Rp${fmt(item.subtotal)}`, colX.subtotal - 2.5, cursorY + 4.4, { align: "right" });

    cursorY += rowHeight;
  });

  cursorY += 2;

  // 4. Summary / Rincian Pembayaran (FULL WIDTH - Persis template cetak)
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4.5;

  const sumLineHeight = 4.8;
  const renderFullWidthRow = (
    label: string,
    val: string,
    isBold = false,
    valColor?: [number, number, number]
  ) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(17, 17, 17);
    doc.text(label, margin, cursorY);

    if (valColor) {
      doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    } else {
      doc.setTextColor(17, 17, 17);
    }
    doc.text(val, pageWidth - margin, cursorY, { align: "right" });
    cursorY += sumLineHeight;
  };

  // Subtotal
  renderFullWidthRow("Subtotal", `Rp${fmt(invoice.subtotal)}`);

  // Diskon (jika ada)
  if ((invoice.diskon || 0) > 0) {
    renderFullWidthRow("Diskon", `- Rp${fmt(invoice.diskon)}`);
  }

  // Total (Bold)
  renderFullWidthRow("Total", `Rp${fmt(invoice.total)}`, true);

  // Jumlah Dibayar
  renderFullWidthRow("Jumlah Dibayar", `Rp${fmt(invoice.jumlah_dibayar)}`);

  // Sisa Pembayaran
  renderFullWidthRow("Sisa Pembayaran", `Rp${fmt(invoice.sisa)}`);

  // Status (Bold, Merah jika BELUM LUNAS, Hijau jika LUNAS)
  const isLunas = invoice.status === "LUNAS";
  const statusColor: [number, number, number] = isLunas ? [46, 125, 50] : [192, 57, 43]; // #2E7D32 : #c0392b
  renderFullWidthRow("Status", invoice.status || "LUNAS", true, statusColor);

  // Dibuat Oleh
  if (invoice.dibuat_oleh) {
    renderFullWidthRow("Dibuat Oleh", invoice.dibuat_oleh);
  }

  cursorY += 4;

  // 5. Footer: Instruksi Pembayaran (Langsung di bawah summary, persis di gambar)
  doc.setDrawColor(221, 221, 221);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(17, 17, 17); // #111
  doc.text("Instruksi Pembayaran", margin, cursorY);
  cursorY += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(85, 85, 85); // #555
  doc.text("Transfer ke Seabank a.n. AHMAD FARID MUSADDAD", margin, cursorY);
  cursorY += 3.5;
  doc.text("No. Rekening 9011 2193 2420", margin, cursorY);
  cursorY += 5;

  doc.text("Transfer ke Bank Jago a.n. AHMAD FARID MUSADDAD", margin, cursorY);
  cursorY += 3.5;
  doc.text("No. Rekening 5021 3576 9162", margin, cursorY);

  const cleanNo = (invoice.no_invoice || "INV-TANABREW").replace(/[/\\?%*:|"<>]/g, "-");
  const fileName = `Invoice-${cleanNo}.pdf`;

  const blob = doc.output("blob");
  const base64 = doc.output("datauristring");

  return { blob, base64, fileName };
}
