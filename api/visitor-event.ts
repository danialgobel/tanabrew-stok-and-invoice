import type { App } from "firebase-admin/app";

type VisitorEventType = "VISIT_PRICELIST" | "VISIT_SHOPEE";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
};

type FirebaseServiceAccountJson = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

// Rate limit: 30 seconds cooldown per IP per event type
const COOLDOWN_MS = 30 * 1000;
const cooldownStore = new Map<string, number>();
let firebaseAdminAppPromise: Promise<App> | null = null;

const getHeader = (req: ApiRequest, name: string) => {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseBody = (body: unknown): { event?: VisitorEventType } | null => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (body && typeof body === "object") {
    return body as { event?: VisitorEventType };
  }
  return null;
};

const getRequestOrigin = (req: ApiRequest) => {
  const host = getHeader(req, "host");
  if (!host) return "";
  const proto = getHeader(req, "x-forwarded-proto") || "https";
  return `${proto}://${host}`;
};

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const serviceAccount = JSON.parse(raw) as FirebaseServiceAccountJson;
    const projectId = serviceAccount.project_id || serviceAccount.projectId;
    const clientEmail = serviceAccount.client_email || serviceAccount.clientEmail;
    const privateKey = serviceAccount.private_key || serviceAccount.privateKey;

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

const getFirebaseAdminApp = async (): Promise<App | null> => {
  const account = getServiceAccount();
  if (!account) return null;

  if (!firebaseAdminAppPromise) {
    firebaseAdminAppPromise = (async () => {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const existingApp = getApps()[0];
      if (existingApp) return existingApp;

      return initializeApp({
        credential: cert(account),
      });
    })().catch((error) => {
      firebaseAdminAppPromise = null;
      throw error;
    });
  }

  return firebaseAdminAppPromise;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Allow public CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const event = body?.event;

  if (event !== "VISIT_PRICELIST" && event !== "VISIT_SHOPEE") {
    return res.status(400).json({ success: false, error: "Invalid event type" });
  }

  // Anti-Spam / Cooldown check per IP + Event
  const forwardedFor = getHeader(req, "x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const rateLimitKey = `${ip}:${event}`;
  const now = Date.now();
  const lastTime = cooldownStore.get(rateLimitKey) || 0;

  if (now - lastTime < COOLDOWN_MS) {
    // Return early silently to prevent push spam
    return res.status(200).json({
      success: true,
      skipped: true,
      message: "Cooldown active, notification skipped",
    });
  }

  cooldownStore.set(rateLimitKey, now);

  // Clean old cooldown entries periodically
  if (cooldownStore.size > 2000) {
    for (const [k, time] of cooldownStore.entries()) {
      if (now - time > COOLDOWN_MS * 2) {
        cooldownStore.delete(k);
      }
    }
  }

  const origin = getRequestOrigin(req);
  const isPricelist = event === "VISIT_PRICELIST";
  
  // Notification Content: Tanpa emot emot sesuai permintaan Owner
  const notificationTitle = "Tanabrew";
  const notificationMessage = isPricelist
    ? "seseorang mengunjungi pricelist"
    : "seseorang mengunjungi shopee tanabrew";
  const targetUrl = isPricelist
    ? (origin ? `${origin}/pricelist` : "https://tanabrew-stok-and-invoice.vercel.app/pricelist")
    : "https://id.shp.ee/qYbNbEvQ";

  // 1. Dispatch Push Notification via OneSignal REST API (broadcast to all total subscriptions)
  const appId = process.env.ONESIGNAL_APP_ID || "49921bb8-d718-4d8b-8bd5-4f2f00378661";
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  let oneSignalSent = false;
  let messageId: string | null = null;

  if (appId && restApiKey) {
    try {
      const payload = {
        app_id: appId,
        target_channel: "push",
        headings: { en: notificationTitle },
        contents: { en: notificationMessage },
        url: targetUrl,
        chrome_web_icon: origin ? `${origin}/tanabrew-logo.png` : "https://tanabrew-stok-and-invoice.vercel.app/tanabrew-logo.png",
        included_segments: ["Total Subscriptions"],
        data: {
          type: event,
          createdAt: new Date().toISOString(),
        },
      };

      const osRes = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          Authorization: `Key ${restApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (osRes.ok) {
        const data = (await osRes.json()) as { id?: string };
        messageId = data?.id || null;
        oneSignalSent = true;
      } else {
        console.warn("[Visitor Event] OneSignal returned error", osRes.status, await osRes.text());
      }
    } catch (err) {
      console.warn("[Visitor Event] Failed to send OneSignal push", err);
    }
  }

  // 2. Record to Firestore activity_logs (so it appears on Beranda live ticker)
  try {
    const adminApp = await getFirebaseAdminApp();
    if (adminApp) {
      const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);
      await db.collection("activity_logs").add({
        action: event,
        description: notificationMessage,
        target_type: "pricelist",
        target_id: "public",
        target_name: isPricelist ? "Price List" : "Shopee Store",
        user_id: "visitor",
        user_name: "Pengunjung",
        user_role: "visitor",
        created_at: FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn("[Visitor Event] Failed to write activity log", err);
  }

  return res.status(200).json({
    success: true,
    event,
    oneSignalSent,
    messageId,
  });
}
