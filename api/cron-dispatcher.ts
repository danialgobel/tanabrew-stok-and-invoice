import type { App } from "firebase-admin/app";
import { Resend } from "resend";

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
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  warehouse: "jogja" | "lombok" | string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: any;
  items?: InvoiceItem[];
};

type ProductRecord = {
  id: string;
  name: string;
  stockJogja: number;
  stockLombok: number;
  minStock?: number;
  category?: string;
};

const getHeader = (req: ApiRequest, name: string) => {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
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

const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string[];
  subject: string;
  html: string;
}) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY belum dikonfigurasi di Vercel Environment Variables. Tambahkan kunci Resend gratis di Vercel agar email langsung terkirim.",
    };
  }

  if (!to || to.length === 0) {
    return { sent: false, reason: "Tidak ada alamat email penerima yang valid." };
  }

  try {
    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Tanabrew System <onboarding@resend.dev>";
    const sender = fromEmail.includes("@") ? fromEmail : "onboarding@resend.dev";

    const { data, error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
    });

    if (error) {
      return { sent: false, error: error.message };
    }
    return { sent: true, id: data?.id };
  } catch (err: any) {
    return { sent: false, error: err?.message };
  }
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
  const currentDayOfWeek = nowWib.getDay();
  const currentDate = nowWib.getDate();
  const currentMonth = nowWib.getMonth();
  const currentYear = nowWib.getFullYear();

  const tomorrow = new Date(nowWib);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isEndOfMonthEve = tomorrow.getDate() === 1;

  const isTestMode = req.query?.test === "true" || req.query?.mode === "test";

  const results: Record<string, any> = {
    status: "active",
    executedAtWIB: nowWib.toLocaleString("id-ID"),
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

  // 1. Fetch Users with Safe Fallback
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

  // Fallback recipient email if Firestore is exhausted
  if (!ownerEmails.length) {
    const fallbackOwner = process.env.OWNER_EMAIL || "danialgobel@gmail.com";
    ownerEmails.push(fallbackOwner);
  }

  // 2. Fetch Invoices with Safe Fallback
  let todayOmzet = isTestMode ? 3850000 : 0;
  let jogjaOmzet = isTestMode ? 2400000 : 0;
  let lombokOmzet = isTestMode ? 1450000 : 0;
  let todayCount = isTestMode ? 24 : 0;
  let cashCount = isTestMode ? 8 : 0;
  let qrisCount = isTestMode ? 12 : 0;
  let transferCount = isTestMode ? 4 : 0;
  let tempoCount = 0;

  try {
    const adminApp = await getFirebaseAdmin();
    if (adminApp && !isTestMode) {
      const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);

      const startOfToday = new Date(nowWib);
      startOfToday.setHours(0, 0, 0, 0);

      const invoicesSnap = await db.collection("invoices")
        .where("createdAt", ">=", Timestamp.fromDate(startOfToday))
        .get();

      invoicesSnap.forEach((doc) => {
        const inv = doc.data() as InvoiceRecord;
        const total = Number(inv.totalAmount) || 0;
        todayOmzet += total;
        todayCount += 1;

        const wh = (inv.warehouse || "").toLowerCase();
        if (wh.includes("lombok")) {
          lombokOmzet += total;
        } else {
          jogjaOmzet += total;
        }

        const method = (inv.paymentMethod || "").toLowerCase();
        if (method.includes("qris")) qrisCount++;
        else if (method.includes("cash") || method.includes("tunai")) cashCount++;
        else if (method.includes("transfer")) transferCount++;
        else if (method.includes("tempo")) tempoCount++;
      });
    }
  } catch (err: any) {
    results.tasks.invoicesError = `Firestore invoices notice: ${err?.message || "Quota limit"}.`;
  }

  // 3. Dispatch Push Notification (OneSignal)
  const pushTitle = isTestMode
    ? "[Uji Coba] Laporan Tutup Toko Tanabrew"
    : "Laporan Tutup Toko Tanabrew";
  const pushMsg = `Total Omzet: ${formatRupiah(todayOmzet)} (${todayCount} Transaksi). Jogja: ${formatRupiah(jogjaOmzet)}, Lombok: ${formatRupiah(lombokOmzet)}.`;

  const pushResult = await sendPushNotification({
    title: pushTitle,
    message: pushMsg,
    targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/beranda",
  });
  results.notifications.oneSignalPush = pushResult;

  // 4. Dispatch Email Report (HTML Profesional Tanabrew)
  const ownerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Laporan Rekap Penjualan Tanabrew</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
        
        <!-- Header Bertema Hijau Khas Tanabrew -->
        <div style="background-color: #00512C; padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">TANABREW ROASTERY</h1>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9; color: #e2e8f0;">Laporan Rekap Penjualan Harian &mdash; ${todayDateStr}</p>
        </div>

        <!-- Konten Utama -->
        <div style="padding: 28px 24px; color: #1e293b;">
          <p style="font-size: 14px; margin-top: 0;">Halo <b>Danial Gobel / Owner Tanabrew</b>,</p>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Berikut adalah ringkasan penjualan resmi pada penutupan kasir hari ini:</p>

          <!-- Kartu Total Omzet Utama -->
          <div style="background-color: #f8fafc; border: 2px solid #00512C; border-radius: 16px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px;">Total Omzet Hari Ini</div>
            <div style="font-size: 28px; font-weight: 900; color: #00512C; margin: 6px 0 12px;">${formatRupiah(todayOmzet)}</div>
            <div style="display: inline-block; background-color: #e2e8f0; color: #334155; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px;">
              ${todayCount} Transaksi Selesai
            </div>
          </div>

          <!-- Rincian Cabang Gudang -->
          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">Gudang Jogja</td>
              <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1e293b;">${formatRupiah(jogjaOmzet)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 0; color: #64748b;">Gudang Lombok</td>
              <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #1e293b;">${formatRupiah(lombokOmzet)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b;">Metode Terbanyak</td>
              <td style="padding: 10px 0; font-weight: bold; text-align: right; color: #00512C;">QRIS (${qrisCount}) &bull; Tunai (${cashCount})</td>
            </tr>
          </table>

          <!-- Tombol Akses Cepat -->
          <div style="text-align: center; margin-top: 28px;">
            <a href="https://tanabrew-stok-and-invoice.vercel.app/riwayat" style="background-color: #00512C; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 28px; border-radius: 24px; display: inline-block;">
              Buka Faktur & Riwayat Penjualan
            </a>
          </div>
        </div>

        <!-- Footer Resmi -->
        <div style="background-color: #f8fafc; padding: 18px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          Sistem Otomasi Tanabrew Stock & Invoice &copy; 2026.<br/>
          Didesain & Dikembangkan oleh Danial Gobel.
        </div>
      </div>
    </body>
    </html>
  `;

  const emailResult = await sendEmail({
    to: ownerEmails,
    subject: `[Tanabrew] Rekap Penjualan Harian: ${formatRupiah(todayOmzet)} (${todayDateStr})`,
    html: ownerHtml,
  });
  results.notifications.emailDelivery = {
    recipients: ownerEmails,
    ...emailResult,
  };

  // 5. Catat Log ke Firestore jika memungkinkan
  try {
    const adminApp = await getFirebaseAdmin();
    if (adminApp) {
      const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);
      await db.collection("activity_logs").add({
        action: "CRON_DISPATCHER",
        description: `Otomasi Master Cron: Rekap Omzet ${formatRupiah(todayOmzet)} (${todayCount} Transaksi).`,
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
    // Silent catch if logging is quota limited
  }

  return res.status(200).json({
    success: true,
    message: "Master Cron Dispatcher dijalankan dengan sukses.",
    instructions: {
      emailActivation: "Untuk mengaktifkan pengiriman email langsung ke Gmail, daftarkan akun gratis di https://resend.com, lalu tambahkan variabel RESEND_API_KEY di Dashboard Vercel > Settings > Environment Variables.",
      testUrl: "Buka URL ini dengan ?test=true untuk simulasi data penjualan lengkap kapan saja.",
    },
    results,
  });
}
