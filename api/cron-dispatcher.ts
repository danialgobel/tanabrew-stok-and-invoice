import type { App } from "firebase-admin/app";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "staff" | "webdev";
  isActive?: boolean;
};

type InvoiceItem = {
  nama_barang?: string;
  productName?: string;
  quantity?: number;
  jumlah?: number;
  price?: number;
  harga?: number;
  subtotal?: number;
};

type InvoiceRecord = {
  id: string;
  no_invoice?: string;
  invoiceNumber?: string;
  customer?: string;
  customerName?: string;
  total?: number;
  totalAmount?: number;
  stock_location?: string;
  warehouse?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  dibuat_oleh?: string;
  created_at?: any;
  items?: InvoiceItem[];
};

const getTanabrewLogoBase64 = (): string | null => {
  try {
    const candidates = [
      path.join(process.cwd(), "public", "logo-pricelist.png"),
      path.join(__dirname, "..", "public", "logo-pricelist.png"),
      path.join(__dirname, "public", "logo-pricelist.png"),
      path.resolve("./public/logo-pricelist.png"),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
    }
  } catch (err) {
    console.warn("Notice reading logo file:", err);
  }
  return null;
};

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKey = parsed.private_key || parsed.privateKey;

    if (!projectId || !clientEmail || !privateKey) return null;

    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
};

let adminAppPromise: Promise<App> | null = null;
const getFirebaseAdmin = async (): Promise<App | null> => {
  const account = getServiceAccount();
  if (!account) return null;

  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const existing = getApps()[0];
      if (existing) return existing;
      return initializeApp({ credential: cert(account) });
    })().catch((err) => {
      adminAppPromise = null;
      throw err;
    });
  }
  return adminAppPromise;
};

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
};

const sendPushNotification = async ({
  title,
  message,
  targetUrl = "https://tanabrew-stok-and-invoice.vercel.app/beranda",
  segment = "Total Subscriptions",
}: {
  title: string;
  message: string;
  targetUrl?: string;
  segment?: string;
}) => {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || "49921bb8-d718-4d8b-8bd5-4f2f00378661";
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    return { sent: false, reason: "ONESIGNAL_REST_API_KEY or APP_ID not configured" };
  }

  try {
    const payload: Record<string, any> = {
      app_id: appId,
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      url: targetUrl,
      chrome_web_icon: "https://tanabrew-stok-and-invoice.vercel.app/tanabrew-logo.png",
      included_segments: [segment],
      data: {
        type: "CRON_DISPATCHER",
        timestamp: new Date().toISOString(),
      },
    };

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; errors?: any };
    return { sent: res.ok, id: data?.id, errors: data?.errors };
  } catch (err: any) {
    return { sent: false, error: err?.message };
  }
};

interface GeneratePdfParams {
  dateStr: string;
  timeStr: string;
  todayOmzet: number;
  todayCount: number;
  jogjaOmzet: number;
  lombokOmzet: number;
  tunaiOmzet: number;
  transferOmzet: number;
  tempoOmzet: number;
  tunaiCount: number;
  transferCount: number;
  tempoCount: number;
  invoices: InvoiceRecord[];
  topProducts: Array<{ name: string; qty: number; total: number }>;
}

const generateReportPdfBuffer = ({
  dateStr,
  timeStr,
  todayOmzet,
  todayCount,
  jogjaOmzet,
  lombokOmzet,
  tunaiOmzet,
  transferOmzet,
  tempoOmzet,
  tunaiCount,
  transferCount,
  tempoCount,
  invoices,
  topProducts,
}: GeneratePdfParams): Buffer => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const logoBase64 = getTanabrewLogoBase64();

  const drawHeader = (currentPage: number) => {
    // Header Background Accent Bar (#2E7D32 Emerald Green)
    doc.setFillColor(46, 125, 50);
    doc.rect(0, 0, pageWidth, 4, "F");

    const headerY = 8;

    // Official Logo from public/logo-pricelist.png
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", margin, headerY, 46, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Roastery & Coffee Specialty • Sistem Kasir", margin, headerY + 18);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("TANABREW ROASTERY", margin, headerY + 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Roastery & Coffee Specialty • Sistem Kasir", margin, headerY + 14);
    }

    // Right Meta Info (Bersih, formal, bebas emotikon AI)
    const rightX = pageWidth - margin;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Dokumen:", rightX - 35, headerY + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text("Rekap Penjualan Harian", rightX, headerY + 3, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Tanggal:", rightX - 35, headerY + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, rightX, headerY + 8, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Waktu Cetak:", rightX - 35, headerY + 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`${timeStr} WIB`, rightX, headerY + 13, { align: "right" });

    if (currentPage > 1) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(148, 163, 184);
      doc.text(`(Halaman ${currentPage})`, rightX, headerY + 18, { align: "right" });
    }

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, 30, pageWidth - margin, 30);

    if (currentPage === 1) {
      // Document Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(46, 125, 50);
      doc.text("LAPORAN REKAPITULASI PENJUALAN HARIAN", pageWidth / 2, 38, { align: "center" });
    }
  };

  let currentPage = 1;
  drawHeader(currentPage);

  let y = 44;

  // 1. Tiga Kartu Ringkasan Penjualan (Executive Summary Cards)
  const cardWidth = (contentWidth - 8) / 3;
  const cardHeight = 24;

  // Kartu 1: Total Omzet
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(46, 125, 50);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL OMZET RESMI", margin + 4, y + 6);

  doc.setFontSize(12.5);
  doc.setTextColor(46, 125, 50);
  doc.text(formatRupiah(todayOmzet), margin + 4, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${todayCount} Faktur Transaksi Selesai`, margin + 4, y + 20);

  // Kartu 2: Cabang Gudang
  const card2X = margin + cardWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("PENJUALAN PER CABANG", card2X + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Gudang Jogja: ${formatRupiah(jogjaOmzet)}`, card2X + 4, y + 13);
  doc.text(`Gudang Lombok: ${formatRupiah(lombokOmzet)}`, card2X + 4, y + 19);

  // Kartu 3: Metode Bayar Resmi (Tunai, Transfer, Tempo)
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("METODE PEMBAYARAN", card3X + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Tunai (Cash): ${tunaiCount} (${formatRupiah(tunaiOmzet)})`, card3X + 4, y + 12);
  doc.text(`Transfer Bank: ${transferCount} (${formatRupiah(transferOmzet)})`, card3X + 4, y + 16.5);
  doc.text(`Tempo: ${tempoCount} (${formatRupiah(tempoOmzet)})`, card3X + 4, y + 21);

  y += cardHeight + 8;

  // 2. Tabel Rincian Detail Transaksi
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Rincian Faktur Penjualan", margin, y);
  y += 5;

  const colX = {
    no: margin,
    faktur: margin + 8,
    customer: margin + 42,
    gudangKasir: margin + 82,
    itemDetail: margin + 118,
    totalStatus: margin + 152,
  };

  const drawTableHeader = (curY: number) => {
    // Header tabel dengan background light green (#EDF7ED) khas POS Tanabrew
    doc.setFillColor(237, 247, 237);
    doc.roundedRect(margin, curY, contentWidth, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("No", colX.no + 2, curY + 4.8);
    doc.text("No. Faktur", colX.faktur, curY + 4.8);
    doc.text("Pelanggan", colX.customer, curY + 4.8);
    doc.text("Cabang / Kasir", colX.gudangKasir, curY + 4.8);
    doc.text("Rincian Biji Kopi / Item", colX.itemDetail, curY + 4.8);
    doc.text("Total & Status", colX.totalStatus, curY + 4.8);
    return curY + 7;
  };

  y = drawTableHeader(y);

  if (!invoices || invoices.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Tidak ada transaksi yang tercatat pada periode ini.", margin + 4, y + 8);
    y += 14;
  } else {
    invoices.forEach((inv, index) => {
      // Periksa kebutuhan pagination (batas bawah halaman 265mm)
      if (y > 260) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 36;
        y = drawTableHeader(y);
      }

      const isEven = index % 2 === 0;
      const rowHeight = 11;

      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowHeight, "F");
      }

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      // Nomor Urut
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(index + 1), colX.no + 2, y + 4.5);

      // No Faktur
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const faktur = inv.no_invoice || inv.invoiceNumber || "-";
      doc.text(faktur, colX.faktur, y + 4.5);

      // Customer
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(46, 125, 50);
      const cust = (inv.customer || inv.customerName || "Pelanggan Umum").slice(0, 22);
      doc.text(cust, colX.customer, y + 4.5);

      // Cabang & Kasir
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      const wh = (inv.stock_location || inv.warehouse || "Jogja").toUpperCase();
      const kasir = inv.dibuat_oleh || "Staf Kasir";
      doc.text(wh, colX.gudangKasir, y + 4.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Kasir: ${kasir.slice(0, 14)}`, colX.gudangKasir, y + 8.5);

      // Item Rincian
      let itemSummary = "-";
      if (inv.items && inv.items.length > 0) {
        itemSummary = inv.items
          .map((it) => `${it.nama_barang || it.productName || "Item"} (${it.jumlah || it.quantity || 1}x)`)
          .join(", ");
      }
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(6.8);
      const truncatedItems = itemSummary.length > 32 ? `${itemSummary.slice(0, 30)}...` : itemSummary;
      doc.text(truncatedItems, colX.itemDetail, y + 4.5);

      // Total & Status Pembayaran
      const totalAmount = inv.total ?? inv.totalAmount ?? 0;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupiah(totalAmount), colX.totalStatus, y + 4.5);

      const status = (inv.status || inv.paymentStatus || "LUNAS").toUpperCase();
      const isLunas = status.includes("LUNAS") && !status.includes("BELUM");
      const method = (inv.paymentMethod || "Tunai").toUpperCase();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      if (isLunas) {
        doc.setTextColor(46, 125, 50);
        doc.text(`[LUNAS: ${method}]`, colX.totalStatus, y + 8.5);
      } else {
        doc.setTextColor(185, 28, 28);
        doc.text(`[TEMPO: ${method}]`, colX.totalStatus, y + 8.5);
      }

      y += rowHeight;
    });
  }

  y += 6;

  // 3. Produk Kopi Terlaris (Top Beans Sold)
  if (topProducts && topProducts.length > 0) {
    if (y > 245) {
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 36;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Biji Kopi & Produk Terlaris", margin, y);
    y += 4;

    doc.setFillColor(237, 247, 237);
    doc.roundedRect(margin, y, contentWidth, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);
    doc.text("Nama Produk / Biji Kopi", margin + 4, y + 4.2);
    doc.text("Kuantitas Terjual", margin + 110, y + 4.2);
    doc.text("Total Penjualan", pageWidth - margin - 35, y + 4.2);
    y += 6;

    topProducts.slice(0, 5).forEach((tp, idx) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`${idx + 1}. ${tp.name}`, margin + 4, y + 4.5);
      doc.text(`${tp.qty} pack / pcs`, margin + 110, y + 4.5);
      doc.setFont("helvetica", "bold");
      doc.text(formatRupiah(tp.total), pageWidth - margin - 35, y + 4.5);
      y += 6;
    });
  }

  // 4. Catatan Kaki & Penomoran Halaman di Seluruh Lembar
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Dokumen resmi Tanabrew Roastery • Sistem Manajemen Stok & Faktur Penjualan.",
      margin,
      pageHeight - 9
    );
    doc.text(
      `Halaman ${i} dari ${totalPages} | Lead Developer: Danial Gobel`,
      pageWidth - margin,
      pageHeight - 9,
      { align: "right" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
};

const sendEmail = async ({
  to,
  subject,
  html,
  attachments,
}: {
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}) => {
  const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || "danialgobel26@gmail.com").trim();
  const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "";
  const gmailPass = rawPass.replace(/\s+/g, "").trim();

  // 1. Prioritaskan Gmail SMTP (Nodemailer) jika App Password sudah dikonfigurasi
  // Mengapa? Karena Gmail SMTP 100% masuk Inbox Utama (Bebas Spam) & bisa kirim ke SEMUA user tanpa batas!
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: `Tanabrew Roastery <${gmailUser}>`,
        to: to.join(", "),
        subject,
        html,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      return {
        sent: true,
        provider: "gmail-smtp",
        messageId: info.messageId,
        accepted: info.accepted,
      };
    } catch (err: any) {
      console.warn("Gmail SMTP notice:", err?.message);
    }
  }

  // 2. Fallback ke Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "Tanabrew System <onboarding@resend.dev>";
      const sender = fromEmail.includes("@") ? fromEmail : "onboarding@resend.dev";

      const payload: any = {
        from: sender,
        to,
        subject,
        html,
      };

      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }

      const { data, error } = await resend.emails.send(payload);

      if (error) {
        return { sent: false, provider: "resend", error: error.message };
      }
      return { sent: true, provider: "resend", id: data?.id };
    } catch (err: any) {
      return { sent: false, provider: "resend", error: err?.message };
    }
  }

  return {
    sent: false,
    reason: "Belum ada kredensial email (GMAIL_APP_PASSWORD atau RESEND_API_KEY) yang aktif di Vercel.",
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayDateStr = nowWib.toISOString().split("T")[0];
  const timeStr = nowWib.toTimeString().split(" ")[0].slice(0, 5);
  const currentDayOfWeek = nowWib.getDay();

  const tomorrow = new Date(nowWib);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isEndOfMonthEve = tomorrow.getDate() === 1;

  const isTestMode = req.query?.test === "true" || req.query?.mode === "test";

  const results: Record<string, any> = {
    status: "active",
    executedAtWIB: `${todayDateStr} ${timeStr} WIB`,
    todayDate: todayDateStr,
    isEndOfMonthEve,
    isMonday: currentDayOfWeek === 1,
    isSunday: currentDayOfWeek === 0,
    isTestMode,
    tasks: {},
    notifications: {},
  };

  let ownerEmails: string[] = [];
  let adminEmails: string[] = [];

  // 1. Mengambil Pengguna dari Firestore dengan Fallback Aman
  try {
    const adminApp = await getFirebaseAdmin();
    if (adminApp) {
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);
      const usersSnap = await db.collection("users").get();
      usersSnap.forEach((doc) => {
        const data = doc.data() as UserProfile;
        if (data.email && data.isActive !== false) {
          if (data.role === "owner" || data.role === "webdev") {
            ownerEmails.push(data.email);
          } else if (data.role === "admin") {
            adminEmails.push(data.email);
          }
        }
      });
      results.tasks.usersFetched = {
        totalOwners: ownerEmails.length,
        totalAdmins: adminEmails.length,
      };
    }
  } catch (err: any) {
    results.tasks.usersError = `Firestore users notice: ${err?.message || "Quota limit"}. Menggunakan fallback email.`;
  }

  // Fallback recipient email matching Danial's account
  const queryEmail = typeof req.query?.email === "string" ? req.query.email.trim() : undefined;
  if (queryEmail) {
    ownerEmails = [queryEmail];
  } else {
    if (!ownerEmails.length) {
      const fallbackOwner = process.env.OWNER_EMAIL || "danialgobel26@gmail.com";
      ownerEmails.push(fallbackOwner);
    }
    if (!ownerEmails.includes("danialgobel26@gmail.com")) {
      ownerEmails.push("danialgobel26@gmail.com");
    }
  }

  // 2. Mengambil Invoices & Menghitung Agregat Penjualan (HANYA METODE RESMI: Tunai, Transfer, Tempo)
  let todayOmzet = 0;
  let jogjaOmzet = 0;
  let lombokOmzet = 0;
  let tunaiOmzet = 0;
  let transferOmzet = 0;
  let tempoOmzet = 0;
  let todayCount = 0;
  let tunaiCount = 0;
  let transferCount = 0;
  let tempoCount = 0;

  let invoiceList: InvoiceRecord[] = [];
  const productAggregator: Record<string, { name: string; qty: number; total: number }> = {};

  if (isTestMode) {
    // Data simulasi profesional berkualitas tinggi khusus Tanabrew
    invoiceList = [
      {
        id: "sim-1",
        no_invoice: "INV/TNB/2026/09/0001",
        customer: "Kedai Kopi Kulo (Sleman)",
        stock_location: "Jogja",
        dibuat_oleh: "Danial Gobel",
        paymentMethod: "Transfer Seabank",
        status: "LUNAS",
        total: 1250000,
        items: [
          { nama_barang: "Arabica Aceh Gayo Wine 1kg", jumlah: 5, harga: 200000, subtotal: 1000000 },
          { nama_barang: "Robusta Temanggung Natural 1kg", jumlah: 2, harga: 125000, subtotal: 250000 },
        ],
      },
      {
        id: "sim-2",
        no_invoice: "INV/TNB/2026/09/0002",
        customer: "Aris Munandar (Walk-in)",
        stock_location: "Jogja",
        dibuat_oleh: "Staff Kasir",
        paymentMethod: "Tunai (Cash)",
        status: "LUNAS",
        total: 350000,
        items: [
          { nama_barang: "House Blend Espresso 70/30 1kg", jumlah: 2, harga: 140000, subtotal: 280000 },
          { nama_barang: "Paper Filter V60 02", jumlah: 1, harga: 70000, subtotal: 70000 },
        ],
      },
      {
        id: "sim-3",
        no_invoice: "INV/TNB/2026/09/0003",
        customer: "Roastery Senja Mataram",
        stock_location: "Lombok",
        dibuat_oleh: "Staff Kasir Lombok",
        paymentMethod: "Transfer BSI",
        status: "LUNAS",
        total: 950000,
        items: [
          { nama_barang: "Arabica Sembalun Natural 1kg", jumlah: 4, harga: 190000, subtotal: 760000 },
          { nama_barang: "Robusta Sajang Lombok 1kg", jumlah: 2, harga: 95000, subtotal: 190000 },
        ],
      },
      {
        id: "sim-4",
        no_invoice: "INV/TNB/2026/09/0004",
        customer: "Cafe Titik Temu Senggigi",
        stock_location: "Lombok",
        dibuat_oleh: "Staff Kasir Lombok",
        paymentMethod: "Tempo 14 Hari",
        status: "BELUM LUNAS",
        total: 500000,
        items: [
          { nama_barang: "House Blend Roaster Choice 1kg", jumlah: 3, harga: 150000, subtotal: 450000 },
          { nama_barang: "Syrup Vanilla Tanabrew", jumlah: 1, harga: 50000, subtotal: 50000 },
        ],
      },
      {
        id: "sim-5",
        no_invoice: "INV/TNB/2026/09/0005",
        customer: "Mitra Kopi Malioboro",
        stock_location: "Jogja",
        dibuat_oleh: "Danial Gobel",
        paymentMethod: "Tunai (Cash)",
        status: "LUNAS",
        total: 800000,
        items: [
          { nama_barang: "Arabica Kerinci Anaerob 1kg", jumlah: 3, harga: 210000, subtotal: 630000 },
          { nama_barang: "Drip Bag Coffee Box", jumlah: 2, harga: 85000, subtotal: 170000 },
        ],
      },
    ];

    invoiceList.forEach((inv) => {
      const tot = inv.total || 0;
      todayOmzet += tot;
      todayCount += 1;
      if (inv.stock_location?.toLowerCase().includes("lombok")) {
        lombokOmzet += tot;
      } else {
        jogjaOmzet += tot;
      }

      const method = (inv.paymentMethod || "").toLowerCase();
      const status = (inv.status || "").toLowerCase();

      if (status.includes("belum") || method.includes("tempo")) {
        tempoCount++;
        tempoOmzet += tot;
      } else if (method.includes("transfer") || method.includes("bsi") || method.includes("seabank")) {
        transferCount++;
        transferOmzet += tot;
      } else {
        tunaiCount++;
        tunaiOmzet += tot;
      }

      inv.items?.forEach((it) => {
        const key = it.nama_barang || "Produk Lainnya";
        if (!productAggregator[key]) {
          productAggregator[key] = { name: key, qty: 0, total: 0 };
        }
        productAggregator[key].qty += it.jumlah || 1;
        productAggregator[key].total += it.subtotal || 0;
      });
    });
  } else {
    // Mode Riil: Baca dari Firestore
    try {
      const adminApp = await getFirebaseAdmin();
      if (adminApp) {
        const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
        const db = getFirestore(adminApp);

        const startOfToday = new Date(nowWib);
        startOfToday.setHours(0, 0, 0, 0);

        const invoicesSnap = await db
          .collection("invoices")
          .where("createdAt", ">=", Timestamp.fromDate(startOfToday))
          .get();

        invoicesSnap.forEach((doc) => {
          const inv = { id: doc.id, ...doc.data() } as InvoiceRecord;
          invoiceList.push(inv);

          const total = Number(inv.total ?? inv.totalAmount ?? 0);
          todayOmzet += total;
          todayCount += 1;

          const wh = (inv.stock_location || inv.warehouse || "").toLowerCase();
          if (wh.includes("lombok")) {
            lombokOmzet += total;
          } else {
            jogjaOmzet += total;
          }

          const method = (inv.paymentMethod || "").toLowerCase();
          const status = (inv.status || inv.paymentStatus || "").toLowerCase();

          if (status.includes("belum") || method.includes("tempo")) {
            tempoCount++;
            tempoOmzet += total;
          } else if (method.includes("transfer") || method.includes("seabank") || method.includes("bsi")) {
            transferCount++;
            transferOmzet += total;
          } else {
            tunaiCount++;
            tunaiOmzet += total;
          }

          const items = inv.items || [];
          items.forEach((it) => {
            const key = it.nama_barang || it.productName || "Kopi";
            if (!productAggregator[key]) {
              productAggregator[key] = { name: key, qty: 0, total: 0 };
            }
            productAggregator[key].qty += Number(it.jumlah ?? it.quantity ?? 1);
            productAggregator[key].total += Number(it.subtotal ?? (it.harga || 0) * (it.jumlah || 1));
          });
        });
      }
    } catch (err: any) {
      results.tasks.invoicesError = `Firestore invoices notice: ${err?.message || "Quota limit"}.`;
    }
  }

  const topProducts = Object.values(productAggregator).sort((a, b) => b.qty - a.qty);

  // 3. Dispatch Push Notification (OneSignal)
  const pushTitle = isTestMode ? "[Uji Coba] Laporan Penjualan Tanabrew" : "Laporan Penjualan Tanabrew";
  const pushMsg = `Omzet: ${formatRupiah(todayOmzet)} (${todayCount} Faktur). Jogja: ${formatRupiah(jogjaOmzet)}, Lombok: ${formatRupiah(lombokOmzet)}. Tunai: ${tunaiCount}, Transfer: ${transferCount}.`;

  const pushResult = await sendPushNotification({
    title: pushTitle,
    message: pushMsg,
    targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/beranda",
  });
  results.notifications.oneSignalPush = pushResult;

  // 4. Generate Publikasi PDF Resmi yang Sangat Detail dengan Logo Resmi & Tema Bersih
  const pdfBuffer = generateReportPdfBuffer({
    dateStr: todayDateStr,
    timeStr,
    todayOmzet,
    todayCount,
    jogjaOmzet,
    lombokOmzet,
    tunaiOmzet,
    transferOmzet,
    tempoOmzet,
    tunaiCount,
    transferCount,
    tempoCount,
    invoices: invoiceList,
    topProducts,
  });

  // 5. Bangun Tampilan Email HTML Interaktif & Elegan Tanpa Emotikon AI
  const transactionRowsHtml = invoiceList
    .slice(0, 10)
    .map(
      (inv, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px 4px; color: #64748b;">${idx + 1}</td>
        <td style="padding: 8px 4px; font-weight: bold; color: #2E7D32;">${inv.no_invoice || inv.invoiceNumber || "-"}</td>
        <td style="padding: 8px 4px; color: #1e293b;"><b>${inv.customer || inv.customerName || "Umum"}</b></td>
        <td style="padding: 8px 4px; color: #475569;">${(inv.stock_location || inv.warehouse || "Jogja").toUpperCase()}</td>
        <td style="padding: 8px 4px; font-weight: bold; text-align: right; color: #1e293b;">${formatRupiah(inv.total ?? inv.totalAmount ?? 0)}</td>
        <td style="padding: 8px 4px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; ${
            (inv.status || "").toUpperCase().includes("BELUM")
              ? "background-color: #fee2e2; color: #991b1b;"
              : "background-color: #edf7ed; color: #2e7d32;"
          }">
            ${inv.status || "LUNAS"}
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  const ownerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Laporan Rekap Penjualan Tanabrew</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- Header Bertema Hijau Khas Tanabrew (#2E7D32) -->
        <div style="background-color: #2E7D32; padding: 24px 20px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">TANABREW ROASTERY</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9; color: #edf7ed;">Laporan Rekapitulasi & Detail Penjualan &mdash; ${todayDateStr} (${timeStr} WIB)</p>
        </div>

        <!-- Konten Utama -->
        <div style="padding: 24px 20px; color: #1e293b;">
          <p style="font-size: 14px; margin-top: 0;">Halo <b>Danial Gobel & Tim Manajemen Tanabrew</b>,</p>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Berikut adalah ringkasan penjualan harian resmi beserta lampiran PDF dokumen faktur yang siap diunduh dan dicetak:</p>

          <!-- Kartu Total Omzet Utama -->
          <div style="background-color: #f8fafc; border: 2px solid #2E7D32; border-radius: 10px; padding: 18px; margin: 16px 0; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Total Omzet Resmi Hari Ini</div>
            <div style="font-size: 28px; font-weight: 900; color: #2E7D32; margin: 6px 0 8px;">${formatRupiah(todayOmzet)}</div>
            <div style="display: inline-block; background-color: #e2e8f0; color: #334155; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 16px;">
              ${todayCount} Faktur Transaksi Selesai
            </div>
          </div>

          <!-- Rincian Cabang Gudang & Pembayaran -->
          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Gudang Jogja</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1e293b;">${formatRupiah(jogjaOmzet)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Gudang Lombok</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1e293b;">${formatRupiah(lombokOmzet)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Metode Tunai (Cash)</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1e293b;">${tunaiCount} Transaksi (${formatRupiah(tunaiOmzet)})</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Metode Transfer Bank (Seabank/BSI)</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1e293b;">${transferCount} Transaksi (${formatRupiah(transferOmzet)})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Tempo / Piutang (Belum Lunas)</td>
              <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #b91c1c;">${tempoCount} Transaksi (${formatRupiah(tempoOmzet)})</td>
            </tr>
          </table>

          <!-- Tabel Ringkas Transaksi -->
          <div style="margin: 20px 0 10px; font-weight: bold; font-size: 13px; color: #0f172a;">Pratinjau Transaksi Terkini:</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f1f5f9; font-size: 11px; text-align: left; color: #475569;">
                <th style="padding: 6px 4px;">#</th>
                <th style="padding: 6px 4px;">No Faktur</th>
                <th style="padding: 6px 4px;">Pelanggan</th>
                <th style="padding: 6px 4px;">Cabang</th>
                <th style="padding: 6px 4px; text-align: right;">Total</th>
                <th style="padding: 6px 4px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${transactionRowsHtml}
            </tbody>
          </table>
          <p style="font-size: 11px; color: #94a3b8; margin-top: -12px;">*Rincian komplit seluruh produk yang dibeli dan kasir tercantum di file PDF lampiran email ini.</p>

          <!-- Tombol Akses Cepat -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://tanabrew-stok-and-invoice.vercel.app/riwayat" style="background-color: #2E7D32; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 10px 24px; border-radius: 20px; display: inline-block;">
              Buka Faktur & Riwayat Kasir
            </a>
          </div>
        </div>

        <!-- Footer Resmi -->
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Sistem Otomasi Tanabrew Stock & Invoice &copy; 2026.<br/>
          Didesain & Dikembangkan oleh Danial Gobel.
        </div>
      </div>
    </body>
    </html>
  `;

  // 6. Kirim Email Rekap dengan Lampiran PDF (Dual Provider: Gmail SMTP / Resend)
  const emailResult = await sendEmail({
    to: ownerEmails,
    subject: `[Tanabrew] Rekap Penjualan Harian: ${formatRupiah(todayOmzet)} (${todayDateStr})`,
    html: ownerHtml,
    attachments: [
      {
        filename: `Laporan-Penjualan-Tanabrew-${todayDateStr}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  results.notifications.emailDelivery = {
    recipients: ownerEmails,
    ...emailResult,
  };

  // 7. Catat Log ke Firestore jika memungkinkan
  try {
    const adminApp = await getFirebaseAdmin();
    if (adminApp) {
      const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);
      await db.collection("activity_logs").add({
        action: "CRON_DISPATCHER",
        description: `Master Cron: Rekap Omzet ${formatRupiah(todayOmzet)} (${todayCount} Transaksi, ${tunaiCount} Tunai, ${transferCount} Transfer).`,
        target_type: "system",
        target_id: "cron",
        target_name: "Master Cron Dispatcher",
        user_id: "system",
        user_name: "Sistem Otomatis",
        user_role: "system",
        created_at: FieldValue.serverTimestamp(),
      });
    }
  } catch {
    // Silent catch
  }

  const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || "";
  const isGmailConfigured = Boolean(rawPass.replace(/\s+/g, "").trim());

  return res.status(200).json({
    success: true,
    message: "Master Cron Dispatcher Tanabrew berhasil dijalankan.",
    audit: {
      provider: emailResult.sent ? (emailResult as any).provider : "none",
      gmailAppPasswordConfigured: isGmailConfigured,
      antiSpamAdvice: isGmailConfigured
        ? "Gmail SMTP aktif. Email rekap 100% masuk Inbox Utama dan dapat dikirim ke seluruh pengguna tim tanpa batasan sandbox."
        : "Sandi aplikasi Gmail belum dipasang di Vercel Environment Variables. Pasang GMAIL_USER dan GMAIL_APP_PASSWORD di Vercel agar email tidak masuk folder Spam.",
    },
    results,
  });
}
