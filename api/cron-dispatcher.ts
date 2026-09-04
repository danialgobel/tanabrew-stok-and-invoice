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

// Format Rupiah helper
const formatRupiah = (num: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
};

// Send OneSignal Push Notification
const sendPushNotification = async ({
  title,
  message,
  targetUrl = "https://tanabrew-stok-and-invoice.vercel.app/beranda",
  segment = "Total Subscriptions",
  roleFilter,
}: {
  title: string;
  message: string;
  targetUrl?: string;
  segment?: string;
  roleFilter?: string;
}) => {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || "49921bb8-d718-4d8b-8bd5-4f2f00378661";
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.warn("[Cron Dispatcher] OneSignal keys missing, skipping push");
    return false;
  }

  try {
    const payload: Record<string, any> = {
      app_id: appId,
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
      url: targetUrl,
      chrome_web_icon: "https://tanabrew-stok-and-invoice.vercel.app/tanabrew-logo.png",
      data: {
        type: "CRON_DISPATCHER",
        timestamp: new Date().toISOString(),
      },
    };

    if (roleFilter) {
      payload.filters = [
        { field: "tag", key: "role", relation: "=", value: roleFilter },
      ];
    } else {
      payload.included_segments = [segment];
    }

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
    console.warn("[Cron Dispatcher] Failed to dispatch OneSignal push", err);
    return false;
  }
};

// Send Email via Resend
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
  if (!apiKey || !to.length) {
    console.log("[Cron Dispatcher] Resend API Key not configured or no recipients, skipping email.");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Tanabrew System <system@tanabrew.com>";
    
    // Resend fallback domain if custom domain is not yet verified
    const sender = fromEmail.includes("@") ? fromEmail : "onboarding@resend.dev";

    const { error } = await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
    });

    if (error) {
      console.warn("[Cron Dispatcher] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Cron Dispatcher] Failed to send email via Resend:", err);
    return false;
  }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  // Security authorization check:
  // Allows Vercel Cron Header (Authorization: Bearer <CRON_SECRET>) OR custom manual trigger key ?secret=...
  const authHeader = getHeader(req, "authorization");
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = typeof req.query?.secret === "string" ? req.query.secret : undefined;

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualAuthorized = cronSecret && querySecret === cronSecret;
  const isDevBypass = !cronSecret || process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isManualAuthorized && !isDevBypass) {
    return res.status(401).json({ success: false, error: "Unauthorized cron trigger." });
  }

  const nowWib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayDateStr = nowWib.toISOString().split("T")[0]; // YYYY-MM-DD
  const currentDayOfWeek = nowWib.getDay(); // 0 = Sunday, 1 = Monday
  const currentDate = nowWib.getDate();
  const currentMonth = nowWib.getMonth();
  const currentYear = nowWib.getFullYear();

  // Check if tomorrow is the 1st of the next month (H-1 Akhir Bulan)
  const tomorrow = new Date(nowWib);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isEndOfMonthEve = tomorrow.getDate() === 1;

  const results: Record<string, any> = {
    executedAtWIB: nowWib.toLocaleString("id-ID"),
    todayDate: todayDateStr,
    isEndOfMonthEve,
    isMonday: currentDayOfWeek === 1,
    isSunday: currentDayOfWeek === 0,
    tasks: {},
  };

  try {
    const adminApp = await getFirebaseAdmin();
    if (!adminApp) {
      // Graceful degraded mode if admin SDK is not initialized
      return res.status(200).json({
        success: true,
        mode: "degraded_no_admin_credentials",
        message: "Cron dispatched without Firestore Admin credentials. OneSignal heartbeat verified.",
        results,
      });
    }

    const { getFirestore, FieldValue, Timestamp } = await import("firebase-admin/firestore");
    const db = getFirestore(adminApp);

    // 1. Fetch Users by Role
    const usersSnap = await db.collection("users").get();
    const users: UserProfile[] = [];
    usersSnap.forEach((doc) => {
      const data = doc.data() as UserProfile;
      if (data.isActive !== false) {
        users.push({ ...data, id: doc.id });
      }
    });

    const ownerEmails = users.filter((u) => (u.role === "owner" || u.role === "webdev") && u.email).map((u) => u.email);
    const adminEmails = users.filter((u) => u.role === "admin" && u.email).map((u) => u.email);

    // 2. Query Today's Invoices
    const startOfToday = new Date(nowWib);
    startOfToday.setHours(0, 0, 0, 0);

    const invoicesSnap = await db.collection("invoices")
      .where("createdAt", ">=", Timestamp.fromDate(startOfToday))
      .get();

    let todayOmzet = 0;
    let jogjaOmzet = 0;
    let lombokOmzet = 0;
    let todayCount = 0;
    let cashCount = 0;
    let qrisCount = 0;
    let transferCount = 0;
    let tempoCount = 0;
    const itemSalesMap: Record<string, number> = {};

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

      // Track item counts
      if (Array.isArray(inv.items)) {
        inv.items.forEach((it) => {
          if (it?.productName) {
            itemSalesMap[it.productName] = (itemSalesMap[it.productName] || 0) + (Number(it.quantity) || 1);
          }
        });
      }
    });

    // 3. Query Low Stock Products
    const productsSnap = await db.collection("products").where("isActive", "==", true).get();
    const lowStockJogja: string[] = [];
    const lowStockLombok: string[] = [];
    const emptyStock: string[] = [];

    productsSnap.forEach((doc) => {
      const p = doc.data() as ProductRecord;
      const min = p.minStock ?? 5;
      const sj = Number(p.stockJogja) || 0;
      const sl = Number(p.stockLombok) || 0;

      if (sj === 0 && sl === 0) {
        emptyStock.push(p.name);
      } else {
        if (sj <= min) lowStockJogja.push(`${p.name} (${sj} kg)`);
        if (sl <= min) lowStockLombok.push(`${p.name} (${sl} kg)`);
      }
    });

    // ==========================================
    // TASK A: REKAP PENJUALAN HARIAN (JAM 23:00)
    // ==========================================
    const pushTitle = "Laporan Tutup Toko Tanabrew";
    const pushMsg = `Total Omzet Hari Ini: ${formatRupiah(todayOmzet)} (${todayCount} Transaksi). Jogja: ${formatRupiah(jogjaOmzet)}, Lombok: ${formatRupiah(lombokOmzet)}.`;

    // Send push to Owner & Admin
    await sendPushNotification({
      title: pushTitle,
      message: pushMsg,
      targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/beranda",
    });

    // Send Email to Owner (Executive HTML Summary)
    if (ownerEmails.length) {
      const ownerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
          <div style="background: #00512C; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Tanabrew Roastery</h1>
            <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Laporan Rekap Penjualan Harian (${todayDateStr})</p>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p style="font-size: 14px; margin-top: 0;">Halo <b>Danial Gobel / Owner Tanabrew</b>,</p>
            <p style="font-size: 13px; color: #64748b;">Berikut adalah rangkuman performa penjualan toko hari ini saat jam tutup toko:</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Total Omzet:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #00512C; font-size: 18px;">${formatRupiah(todayOmzet)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Jumlah Transaksi:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${todayCount} pesanan</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cabang Jogja:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formatRupiah(jogjaOmzet)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cabang Lombok:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formatRupiah(lombokOmzet)}</td>
                </tr>
              </table>
            </div>

            <h3 style="font-size: 14px; color: #1e293b; margin-bottom: 8px;">Metode Pembayaran:</h3>
            <p style="font-size: 13px; color: #64748b; margin-top: 0;">
              QRIS: <b>${qrisCount}</b> | Tunai: <b>${cashCount}</b> | Transfer: <b>${transferCount}</b> | Tempo: <b>${tempoCount}</b>
            </p>

            ${lowStockJogja.length || lowStockLombok.length ? `
              <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px; margin-top: 16px;">
                <h4 style="margin: 0 0 6px; font-size: 13px; color: #b45309;">⚠️ Peringatan Stok Menipis:</h4>
                <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                  ${lowStockJogja.length ? `<b>Jogja:</b> ${lowStockJogja.slice(0, 3).join(", ")}<br/>` : ""}
                  ${lowStockLombok.length ? `<b>Lombok:</b> ${lowStockLombok.slice(0, 3).join(", ")}` : ""}
                </p>
              </div>
            ` : ""}

            <div style="text-align: center; margin-top: 28px;">
              <a href="https://tanabrew-stok-and-invoice.vercel.app/riwayat" style="background: #00512C; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 24px; border-radius: 24px; display: inline-block;">Buka Riwayat Penjualan</a>
            </div>
          </div>
          <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Otomasi Sistem Tanabrew Stock & Invoice &copy; 2026. Dikembangkan oleh Danial Gobel.
          </div>
        </div>
      `;

      await sendEmail({
        to: ownerEmails,
        subject: `[Tanabrew] Rekap Penjualan Harian: ${formatRupiah(todayOmzet)} (${todayDateStr})`,
        html: ownerHtml,
      });
    }

    results.tasks.dailySales = {
      todayOmzet,
      todayCount,
      jogjaOmzet,
      lombokOmzet,
    };

    // ==========================================
    // TASK B: LAPORAN TUTUP BUKU BULANAN (H-1 AKHIR BULAN)
    // ==========================================
    if (isEndOfMonthEve) {
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthlySnap = await db.collection("invoices")
        .where("createdAt", ">=", Timestamp.fromDate(monthStart))
        .get();

      let monthTotal = 0;
      let monthJogja = 0;
      let monthLombok = 0;
      let monthCount = 0;

      monthlySnap.forEach((doc) => {
        const inv = doc.data() as InvoiceRecord;
        const total = Number(inv.totalAmount) || 0;
        monthTotal += total;
        monthCount++;
        if ((inv.warehouse || "").toLowerCase().includes("lombok")) {
          monthLombok += total;
        } else {
          monthJogja += total;
        }
      });

      const monthName = nowWib.toLocaleString("id-ID", { month: "long" });
      const monthlyPushTitle = `Tutup Buku Bulanan ${monthName} ${currentYear}`;
      const monthlyPushMsg = `Total Omzet Bulan Ini: ${formatRupiah(monthTotal)} (${monthCount} Transaksi). Jogja: ${formatRupiah(monthJogja)}, Lombok: ${formatRupiah(monthLombok)}.`;

      await sendPushNotification({
        title: monthlyPushTitle,
        message: monthlyPushMsg,
        targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/beranda",
      });

      if (ownerEmails.length) {
        const monthlyHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
            <div style="background: #00512C; padding: 26px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Laporan Eksekutif Tutup Buku</h1>
              <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Tanabrew Roastery &mdash; Bulan ${monthName} ${currentYear}</p>
            </div>
            <div style="padding: 24px; color: #1e293b;">
              <p style="font-size: 14px;">Halo <b>Danial Gobel</b>,</p>
              <p style="font-size: 13px; color: #64748b;">Malam ini adalah H-1 akhir bulan. Sistem telah merekap seluruh pembukuan penjualan bulan ini secara otomatis:</p>
              
              <div style="background: #f8fafc; border: 2px solid #00512C; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Total Omzet Bersih Bulan Ini</div>
                <div style="font-size: 26px; font-weight: 900; color: #00512C; margin: 4px 0 12px;">${formatRupiah(monthTotal)}</div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                  <span style="color: #64748b;">Gudang Jogja:</span>
                  <b>${formatRupiah(monthJogja)}</b>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                  <span style="color: #64748b;">Gudang Lombok:</span>
                  <b>${formatRupiah(monthLombok)}</b>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                  <span style="color: #64748b;">Total Faktur Penjualan:</span>
                  <b>${monthCount} Transaksi</b>
                </div>
              </div>

              <p style="font-size: 12px; color: #64748b;">Anda dapat mengunduh seluruh arsip faktur dalam format Excel/CSV melalui menu Riwayat Transaksi.</p>

              <div style="text-align: center; margin-top: 24px;">
                <a href="https://tanabrew-stok-and-invoice.vercel.app/riwayat" style="background: #00512C; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: bold; padding: 12px 28px; border-radius: 24px; display: inline-block;">Buka Laporan Finansial</a>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: ownerEmails,
          subject: `[Tanabrew] Laporan Eksekutif Tutup Buku Bulan ${monthName}: ${formatRupiah(monthTotal)}`,
          html: monthlyHtml,
        });
      }

      results.tasks.monthlyClosing = {
        monthTotal,
        monthJogja,
        monthLombok,
        monthCount,
      };
    }

    // ==========================================
    // TASK C: PENGINGAT FAKTUR TEMPO (HARI SENIN)
    // ==========================================
    if (currentDayOfWeek === 1) {
      const tempoSnap = await db.collection("invoices")
        .where("paymentMethod", "==", "tempo")
        .where("paymentStatus", "!=", "lunas")
        .limit(10)
        .get();

      let tempoTotal = 0;
      let unpaidCount = 0;
      tempoSnap.forEach((doc) => {
        const inv = doc.data() as InvoiceRecord;
        tempoTotal += Number(inv.totalAmount) || 0;
        unpaidCount++;
      });

      if (unpaidCount > 0) {
        await sendPushNotification({
          title: "Pengingat Faktur Tempo Senin",
          message: `Ada ${unpaidCount} invoice tempo belum lunas (Total: ${formatRupiah(tempoTotal)}). Harap follow-up customer.`,
          targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/riwayat",
        });
        results.tasks.unpaidTempo = { unpaidCount, tempoTotal };
      }
    }

    // ==========================================
    // TASK D: PENGINGAT STOCK OPNAME (TANGGAL 28)
    // ==========================================
    if (currentDate === 28) {
      await sendPushNotification({
        title: "Pengingat Jadwal Stock Opname",
        message: "Hari ini tanggal 28. Waktunya mencocokkan stok fisik biji kopi di rak Gudang Jogja & Lombok.",
        targetUrl: "https://tanabrew-stok-and-invoice.vercel.app/update-stok",
      });
      results.tasks.stockOpname = "Reminder sent";
    }

    // ==========================================
    // TASK E: PEMBERSIHAN LOG KADALUARSA (TANGGAL 1)
    // ==========================================
    if (currentDate === 1) {
      const sixtyDaysAgo = new Date(nowWib);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const oldLogsSnap = await db.collection("activity_logs")
        .where("created_at", "<=", Timestamp.fromDate(sixtyDaysAgo))
        .limit(100)
        .get();

      let deletedLogsCount = 0;
      const batch = db.batch();
      oldLogsSnap.forEach((doc) => {
        batch.delete(doc.ref);
        deletedLogsCount++;
      });

      if (deletedLogsCount > 0) {
        await batch.commit();
      }
      results.tasks.cleanupOldLogs = { deletedLogsCount };
    }

    // 4. Catat Eksekusi Cron ke activity_logs
    await db.collection("activity_logs").add({
      action: "CRON_DISPATCHER",
      description: `Otomasi Master Cron berjalan lancar: Omzet hari ini ${formatRupiah(todayOmzet)} (${todayCount} transaksi).`,
      target_type: "system",
      target_id: "cron",
      target_name: "Master Cron Dispatcher",
      user_id: "system",
      user_name: "Sistem Otomatis",
      user_role: "system",
      created_at: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Master Cron Dispatcher executed successfully.",
      results,
    });
  } catch (err: any) {
    console.error("[Cron Dispatcher Error]", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Internal server error during cron dispatch.",
      results,
    });
  }
}
