import type { App } from "firebase-admin/app";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import { TANABREW_LOGO_BASE64 } from "../src/lib/tanabrewLogoBase64";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
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
  targetUrl = "https://tanabrew-stok-and-invoice.vercel.app/riwayat",
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
  const contentWidth = pageWidth - margin * 2; // 182mm

  const drawHeader = (currentPage: number) => {
    // 1. Logo Resmi Tanabrew (logo-pricelist.png)
    try {
      doc.addImage(TANABREW_LOGO_BASE64, "PNG", margin, 10, 44, 13.3);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("TANABREW ROASTERY", margin, 18);
    }

    // 2. Meta Info Kanan (Identik dengan format cetak laporan Tanabrew)
    const rightX = pageWidth - margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(73, 98, 79); // #49624F
    doc.text(`Tanggal cetak: ${dateStr} ${timeStr}`, rightX, 13, { align: "right" });
    doc.text("Dicetak oleh: Sistem Tanabrew (Cron)", rightX, 18, { align: "right" });
    doc.text(`Role: Owner / Admin ${currentPage > 1 ? `(Hal ${currentPage})` : ""}`, rightX, 23, { align: "right" });

    // 3. Garis Pembatas Header Hijau Zamrud (3px solid #2e7d32)
    doc.setDrawColor(46, 125, 50);
    doc.setLineWidth(0.8);
    doc.line(margin, 27, pageWidth - margin, 27);

    if (currentPage === 1) {
      // 4. Judul Laporan Resmi
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(46, 125, 50);
      doc.text("Laporan Rekapitulasi Invoice Penjualan", margin, 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(73, 98, 79);
      doc.text(`Periode: ${dateStr} (Penutupan Kasir Harian)`, margin, 40);
    }
  };

  let currentPage = 1;
  drawHeader(currentPage);

  let y = 45;

  // 1. Tiga Kartu Ringkasan Penjualan (Sesuai Desain Laporan Web App Tanabrew)
  const cardW = (contentWidth - 6) / 3; // 58.6mm per kartu
  const cardH = 20;

  // Kartu 1: Total Pemasukan
  doc.setFillColor(244, 251, 244); // #F4FBF4
  doc.setDrawColor(165, 214, 167); // #A5D6A7
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(73, 98, 79);
  doc.text("TOTAL PEMASUKAN", margin + 4, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(46, 125, 50);
  doc.text(formatRupiah(todayOmzet), margin + 4, y + 14);

  // Kartu 2: Total Invoice
  const c2X = margin + cardW + 3;
  doc.setFillColor(244, 251, 244); // #F4FBF4
  doc.setDrawColor(165, 214, 167); // #A5D6A7
  doc.setLineWidth(0.3);
  doc.roundedRect(c2X, y, cardW, cardH, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(73, 98, 79);
  doc.text("TOTAL INVOICE", c2X + 4, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(46, 125, 50);
  doc.text(`${todayCount} Invoice`, c2X + 4, y + 14);

  // Kartu 3: Rincian Cabang & Metode
  const c3X = c2X + cardW + 3;
  doc.setFillColor(244, 251, 244); // #F4FBF4
  doc.setDrawColor(165, 214, 167); // #A5D6A7
  doc.setLineWidth(0.3);
  doc.roundedRect(c3X, y, cardW, cardH, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(73, 98, 79);
  doc.text("RINCIAN CABANG", c3X + 4, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(46, 125, 50);
  doc.text(`Jogja: ${formatRupiah(jogjaOmzet)}`, c3X + 4, y + 11.5);
  doc.text(`Lombok: ${formatRupiah(lombokOmzet)}`, c3X + 4, y + 16.5);

  y += cardH + 8;

  // 2. Kolom Tabel Rapi & Anti-Bertabrakan (Total 182mm)
  const cols = {
    no: margin, // 7mm lebar
    invoice: margin + 7, // 36mm lebar
    customer: margin + 43, // 35mm lebar
    cabang: margin + 78, // 26mm lebar
    item: margin + 104, // 38mm lebar
    total: margin + 142, // 24mm lebar
    status: margin + 166, // 16mm lebar
  };

  const drawTableHeader = (curY: number) => {
    // Header tabel hijau zamrud (#2E7D32) khas laporan web app
    doc.setFillColor(46, 125, 50);
    doc.rect(margin, curY, contentWidth, 7.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("No", cols.no + 1.5, curY + 5);
    doc.text("No Invoice", cols.invoice, curY + 5);
    doc.text("Customer", cols.customer, curY + 5);
    doc.text("Cabang / Kasir", cols.cabang, curY + 5);
    doc.text("Item / Biji Kopi", cols.item, curY + 5);
    doc.text("Total", cols.total, curY + 5);
    doc.text("Status", cols.status, curY + 5);
    return curY + 7.5;
  };

  y = drawTableHeader(y);

  if (!invoices || invoices.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Tidak ada invoice yang tercatat pada penutupan kasir hari ini.", margin + 4, y + 9);
    y += 16;
  } else {
    invoices.forEach((inv, index) => {
      // Auto-Paging jika melebihi batas bawah (265mm)
      if (y > 260) {
        doc.addPage();
        currentPage++;
        drawHeader(currentPage);
        y = 32;
        y = drawTableHeader(y);
      }

      const isEven = index % 2 === 0;
      const rowH = 8.5;

      // Background zebra selaras web app (#F7FBF7)
      if (isEven) {
        doc.setFillColor(247, 251, 247);
        doc.rect(margin, y, contentWidth, rowH, "F");
      }

      // Garis batas antar baris (#CFE8D1)
      doc.setDrawColor(207, 232, 209);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH, margin + contentWidth, y + rowH);

      // Nomor
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(20, 56, 28);
      doc.text(String(index + 1), cols.no + 1.5, y + 5.5);

      // No Invoice
      doc.setFont("helvetica", "bold");
      const noInv = (inv.no_invoice || inv.invoiceNumber || "-").slice(0, 21);
      doc.text(noInv, cols.invoice, y + 5.5);

      // Customer
      doc.setFont("helvetica", "normal");
      const cust = (inv.customer || inv.customerName || "Umum").slice(0, 20);
      doc.text(cust, cols.customer, y + 5.5);

      // Cabang / Kasir
      const wh = (inv.stock_location || inv.warehouse || "Jogja").slice(0, 6);
      const kasir = (inv.dibuat_oleh || "Kasir").split(" ")[0].slice(0, 8);
      doc.text(`${wh} (${kasir})`, cols.cabang, y + 5.5);

      // Item / Biji Kopi
      let itemSummary = "-";
      if (inv.items && inv.items.length > 0) {
        itemSummary = inv.items
          .map((it) => `${(it.nama_barang || it.productName || "Kopi").slice(0, 14)} (${it.jumlah || it.quantity || 1}x)`)
          .join(", ");
      }
      doc.text(itemSummary.slice(0, 24), cols.item, y + 5.5);

      // Total
      const tot = inv.total ?? inv.totalAmount ?? 0;
      doc.setFont("helvetica", "bold");
      doc.text(formatRupiah(tot), cols.total, y + 5.5);

      // Status Badge (Kotak status hijau/merah khas web app)
      const st = (inv.status || inv.paymentStatus || "LUNAS").toUpperCase();
      const isLunas = st.includes("LUNAS") && !st.includes("BELUM");

      if (isLunas) {
        doc.setFillColor(223, 243, 223); // #DFF3DF
        doc.setDrawColor(165, 214, 167); // #A5D6A7
        doc.roundedRect(cols.status, y + 2, 14, 4.8, 1, 1, "FD");
        doc.setFontSize(6);
        doc.setTextColor(31, 107, 42); // #1F6B2A
        doc.text("LUNAS", cols.status + 7, y + 5.2, { align: "center" });
      } else {
        doc.setFillColor(255, 225, 225); // #FFE1E1
        doc.setDrawColor(243, 184, 184); // #F3B8B8
        doc.roundedRect(cols.status, y + 2, 15, 4.8, 1, 1, "FD");
        doc.setFontSize(5.5);
        doc.setTextColor(159, 29, 29); // #9F1D1D
        doc.text("TEMPO", cols.status + 7.5, y + 5.2, { align: "center" });
      }

      y += rowH;
    });
  }

  y += 6;

  // 3. Ringkasan Biji Kopi Terlaris
  if (topProducts && topProducts.length > 0) {
    if (y > 240) {
      doc.addPage();
      currentPage++;
      drawHeader(currentPage);
      y = 32;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(46, 125, 50);
    doc.text("Biji Kopi Terlaris Hari Ini", margin, y);
    y += 4;

    doc.setFillColor(46, 125, 50);
    doc.rect(margin, y, contentWidth, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("No", cols.no + 1.5, y + 4.2);
    doc.text("Nama Produk / Biji Kopi", cols.invoice, y + 4.2);
    doc.text("Kuantitas Terjual", cols.item, y + 4.2);
    doc.text("Total Penjualan", cols.total, y + 4.2);
    y += 6;

    topProducts.slice(0, 5).forEach((tp, idx) => {
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(247, 251, 247);
        doc.rect(margin, y, contentWidth, 6.5, "F");
      }
      doc.setDrawColor(207, 232, 209);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(20, 56, 28);
      doc.text(String(idx + 1), cols.no + 1.5, y + 4.5);
      doc.text(tp.name.slice(0, 36), cols.invoice, y + 4.5);
      doc.text(`${tp.qty} pack / kg`, cols.item, y + 4.5);
      doc.setFont("helvetica", "bold");
      doc.text(formatRupiah(tp.total), cols.total, y + 4.5);
      y += 6.5;
    });
  }

  // 4. Catatan Kaki & Penomoran Halaman di Seluruh Lembar
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(207, 232, 209);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Dokumen resmi Tanabrew Roastery • Sistem Manajemen Stok & Invoice.",
      margin,
      pageHeight - 7
    );
    doc.text(
      `Halaman ${i} dari ${totalPages} | Developer: Danial Gobel`,
      pageWidth - margin,
      pageHeight - 7,
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
  // Keuntungan: 100% masuk Inbox Utama (Anti-Spam) & Bebas kirim ke semua penerima
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const sendPromise = transporter.sendMail({
        from: `Tanabrew Roastery <${gmailUser}>`,
        to: to.join(", "),
        subject,
        html,
        attachments: attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      let timerId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<{ timeout: true }>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("SMTP connection timeout (8s)")), 8000);
      });

      let info: any;
      try {
        info = await Promise.race([sendPromise, timeoutPromise]);
      } finally {
        if (timerId) clearTimeout(timerId);
      }

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

const sendJson = (res: any, statusCode: number, data: any) => {
  try {
    res.statusCode = statusCode;
    if (typeof res.setHeader === "function") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    if (typeof res.json === "function") {
      return res.json(data);
    }
    return res.end(JSON.stringify(data));
  } catch {
    try {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "Serialization error" }));
    } catch {
      return;
    }
  }
};

const sendData = (
  res: any,
  statusCode: number,
  contentType: string,
  data: any,
  disposition?: string
) => {
  try {
    res.statusCode = statusCode;
    if (typeof res.setHeader === "function") {
      res.setHeader("Content-Type", contentType);
      if (disposition) {
        res.setHeader("Content-Disposition", disposition);
      }
    }
    if (typeof res.send === "function") {
      return res.send(data);
    }
    return res.end(data);
  } catch {
    try {
      res.statusCode = 500;
      return res.end("Error sending data");
    } catch {
      return;
    }
  }
};

export default async function handler(req: any, res: any) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }

  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  try {
    const rawUrl = req.url || "/api/cron-dispatcher";
    const parsedUrl = new URL(rawUrl, "https://tanabrew-stok-and-invoice.vercel.app");
    const queryTest = (req.query?.test as string) || parsedUrl.searchParams.get("test") || "";
    const queryMode = (req.query?.mode as string) || parsedUrl.searchParams.get("mode") || "";
    const queryPreview = (req.query?.preview as string) || parsedUrl.searchParams.get("preview") || "";
    const queryEmail = (req.query?.email as string) || parsedUrl.searchParams.get("email") || "";

    const isTestMode = queryTest === "true" || queryMode === "test";

    const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const todayDateStr = nowWib.toISOString().split("T")[0];
    const timeStr = nowWib.toTimeString().split(" ")[0].slice(0, 5);
    const currentDayOfWeek = nowWib.getDay();

    const tomorrow = new Date(nowWib);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isEndOfMonthEve = tomorrow.getDate() === 1;

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

  // ATURAN PENGIRIMAN EMAIL PENERIMA (ANTI-SPAM KE TIM LAIN):
  // Jika sedang mode test (?test=true), HANYA kirim ke Danial Gobel agar tidak mengganggu anggota tim lain.
  let recipientEmails: string[] = [];
  if (isTestMode) {
    const customQueryEmail = typeof req.query?.email === "string" ? req.query.email.trim() : null;
    if (customQueryEmail) {
      recipientEmails = [customQueryEmail];
    } else {
      recipientEmails = ["danialgobel26@gmail.com", "2300018377@webmail.uad.ac.id"];
    }
  } else {
    recipientEmails = [...ownerEmails, ...adminEmails];
    if (!recipientEmails.length) {
      recipientEmails = ["danialgobel26@gmail.com"];
    }
  }

  // 2. Mengambil Invoices & Menghitung Agregat Penjualan
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
    // Data simulasi realistis Tanabrew
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
    // Mode Nyata dari Firestore
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

  // 3. Dispatch Push Notification Ringkas, Jelas, Menarik (Tidak Padat Teks)
  const pushTitle = "Tanabrew Roastery";
  const pushMsg = `Omzet Hari Ini: ${formatRupiah(todayOmzet)} (${todayCount} Invoice). Ketuk untuk melihat laporan.`;

  const pushResult = await sendPushNotification({
    title: pushTitle,
    message: pushMsg,
    targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/riwayat",
  });
  results.notifications.oneSignalPush = pushResult;

  // 4. Generate Publikasi PDF Resmi Bergaya Web App Tanabrew (reportPrint.ts)
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

  // 5. Tampilan Email HTML Bertema Asli Tanabrew (Persis reportPrint.ts)
  const invoiceTableRowsHtml = invoiceList
    .slice(0, 10)
    .map((inv, idx) => {
      const isLunas = (inv.status || "LUNAS").toUpperCase().includes("LUNAS") && !(inv.status || "").toUpperCase().includes("BELUM");
      const isEven = idx % 2 === 0;
      return `
        <tr style="background-color: ${isEven ? "#f7fbf7" : "#ffffff"}; font-size: 12px;">
          <td style="padding: 8px; border: 1px solid #cfe8d1; text-align: center; color: #49624f;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #cfe8d1; font-weight: bold; color: #14381c;">${inv.no_invoice || inv.invoiceNumber || "-"}</td>
          <td style="padding: 8px; border: 1px solid #cfe8d1; color: #14381c;">${inv.customer || inv.customerName || "Umum"}</td>
          <td style="padding: 8px; border: 1px solid #cfe8d1; color: #49624f;">${(inv.stock_location || inv.warehouse || "Jogja").toUpperCase()}</td>
          <td style="padding: 8px; border: 1px solid #cfe8d1; font-weight: bold; text-align: right; color: #14381c;">${formatRupiah(inv.total ?? inv.totalAmount ?? 0)}</td>
          <td style="padding: 8px; border: 1px solid #cfe8d1; text-align: center;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: bold; ${
              isLunas
                ? "background-color: #dff3df; color: #1f6b2a; border: 1px solid #a5d6a7;"
                : "background-color: #ffe1e1; color: #9f1d1d; border: 1px solid #f3b8b8;"
            }">
              ${isLunas ? "LUNAS" : "TEMPO"}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  const ownerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Laporan Rekapitulasi Invoice Penjualan Tanabrew</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4fbf4; margin: 0; padding: 20px; color: #14381c;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(46, 125, 50, 0.08); border: 1px solid #a5d6a7;">
        
        <!-- Header Bertema Hijau Zamrud Resmi Tanabrew (#2E7D32) -->
        <div style="background-color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #2e7d32; text-align: left;">
          <div style="margin-bottom: 12px;">
            <img src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png" alt="Tanabrew Roastery" style="height: 38px; width: auto; display: block;" />
          </div>
          <div style="text-align: left; font-size: 11px; color: #49624f; line-height: 1.5;">
            <div style="font-weight: bold; color: #14381c; font-size: 13px;">Laporan Invoice Harian</div>
            <div>${todayDateStr} • ${timeStr} WIB</div>
          </div>
        </div>

        <!-- Konten Utama -->
        <div style="padding: 24px 20px;">
          <h2 style="color: #2e7d32; margin: 0 0 4px; font-size: 18px; font-weight: bold;">Laporan Rekapitulasi Invoice Penjualan</h2>
          <p style="margin: 0 0 16px; font-size: 12px; color: #49624f;">Periode: ${todayDateStr} (Penutupan Kasir Harian)</p>

          <!-- 3 Kartu Ringkasan (Identik reportPrint.ts) -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin: 12px -8px 20px;">
            <tr>
              <td style="background-color: #f4fbf4; border: 1px solid #a5d6a7; border-radius: 8px; padding: 12px; vertical-align: top;">
                <div style="font-size: 10px; color: #49624f; text-transform: uppercase; font-weight: bold;">Total Pemasukan</div>
                <div style="font-size: 18px; font-weight: bold; color: #2e7d32; margin-top: 4px;">${formatRupiah(todayOmzet)}</div>
              </td>
              <td style="background-color: #f4fbf4; border: 1px solid #a5d6a7; border-radius: 8px; padding: 12px; vertical-align: top;">
                <div style="font-size: 10px; color: #49624f; text-transform: uppercase; font-weight: bold;">Total Invoice</div>
                <div style="font-size: 18px; font-weight: bold; color: #2e7d32; margin-top: 4px;">${todayCount} Invoice</div>
              </td>
              <td style="background-color: #f4fbf4; border: 1px solid #a5d6a7; border-radius: 8px; padding: 12px; vertical-align: top;">
                <div style="font-size: 10px; color: #49624f; text-transform: uppercase; font-weight: bold;">Rincian Cabang</div>
                <div style="font-size: 11px; font-weight: bold; color: #2e7d32; margin-top: 4px;">Jogja: ${formatRupiah(jogjaOmzet)}</div>
                <div style="font-size: 11px; font-weight: bold; color: #2e7d32; margin-top: 2px;">Lombok: ${formatRupiah(lombokOmzet)}</div>
              </td>
            </tr>
          </table>

          <!-- Tabel Invoice Penjualan -->
          <div style="font-weight: bold; font-size: 13px; color: #2e7d32; margin: 16px 0 8px;">Daftar Invoice Terkini</div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #2e7d32; color: #ffffff; font-size: 11px; text-align: left;">
                <th style="padding: 8px; border: 1px solid #2e7d32; text-align: center;">No</th>
                <th style="padding: 8px; border: 1px solid #2e7d32;">No Invoice</th>
                <th style="padding: 8px; border: 1px solid #2e7d32;">Customer</th>
                <th style="padding: 8px; border: 1px solid #2e7d32;">Cabang</th>
                <th style="padding: 8px; border: 1px solid #2e7d32; text-align: right;">Total</th>
                <th style="padding: 8px; border: 1px solid #2e7d32; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceTableRowsHtml}
            </tbody>
          </table>

          <p style="font-size: 11px; color: #64748b; margin-top: -12px;">*File lampiran PDF resmi siap dicetak telah disertakan pada email ini.</p>

          <!-- Tombol Akses Cepat Web App -->
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://tanabrew-stok-and-invoice.vercel.app/riwayat" style="background-color: #2e7d32; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 11px 26px; border-radius: 8px; display: inline-block;">
              Buka Riwayat Penjualan & Invoice
            </a>
          </div>
        </div>

        <!-- Footer Resmi -->
        <div style="background-color: #f4fbf4; padding: 14px; text-align: center; font-size: 11px; color: #49624f; border-top: 1px solid #a5d6a7;">
          Sistem Manajemen Stok & Invoice Tanabrew Roastery &copy; 2026.<br/>
          Developer: Danial Gobel.
        </div>
      </div>
    </body>
    </html>
  `;

  // PREVIEW MODES: Langsung tampilkan di browser tanpa perlu kirim email jika ada query ?preview=...
  if (queryPreview === "pdf") {
    return sendData(
      res,
      200,
      "application/pdf",
      pdfBuffer,
      "inline; filename=\"preview-laporan-tanabrew.pdf\""
    );
  }

  if (queryPreview === "email" || queryPreview === "html") {
    return sendData(res, 200, "text/html; charset=utf-8", ownerHtml);
  }

  // 6. Kirim Email Rekap dengan Lampiran PDF (Hanya ke Danial selama mode test)
  const emailSubject = `Laporan Penjualan Hari Ini: ${formatRupiah(todayOmzet)} (${todayDateStr})`;
  const emailResult = await sendEmail({
    to: recipientEmails,
    subject: emailSubject,
    html: ownerHtml,
    attachments: [
      {
        filename: `Laporan-Invoice-Tanabrew-${todayDateStr}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  results.notifications.emailDelivery = {
    recipients: recipientEmails,
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
        description: `Master Cron: Rekap Omzet ${formatRupiah(todayOmzet)} (${todayCount} Invoice).`,
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

  return sendJson(res, 200, {
    success: true,
    message: "Master Cron Dispatcher Tanabrew berhasil dijalankan.",
    audit: {
      provider: emailResult.sent ? (emailResult as any).provider : "none",
      gmailAppPasswordConfigured: isGmailConfigured,
      currentRecipients: recipientEmails,
      allRegisteredRecipients: {
        owners: ownerEmails,
        admins: adminEmails,
        totalOwner: ownerEmails.length,
        totalAdmin: adminEmails.length,
        policy: isTestMode
          ? "Mode Test Aktif: Email HANYA dikirimkan ke akun Danial Gobel agar tidak mengganggu anggota tim lain."
          : "Mode Terjadwal 23:00 WIB: Email dikirim ke seluruh Owner & Admin terdaftar.",
      },
      previewLinks: {
        viewPdfInBrowser: "https://tanabrew-stok-and-invoice.vercel.app/api/cron-dispatcher?preview=pdf&test=true",
        viewEmailInBrowser: "https://tanabrew-stok-and-invoice.vercel.app/api/cron-dispatcher?preview=email&test=true",
      },
    },
    results,
  });
  } catch (criticalErr: any) {
    console.error("Critical Cron Dispatcher Error:", criticalErr);
    return sendJson(res, 200, {
      success: false,
      error: criticalErr?.message || String(criticalErr),
      stack: criticalErr?.stack,
    });
  }
}
