import type { App } from "firebase-admin/app";

type InvoiceNotificationType = 
  | "CREATE_INVOICE" 
  | "PRINT_INVOICE" 
  | "UPDATE_PAYMENT_STATUS" 
  | "TEST_NOTIFICATION" 
  | "OWNER_ANNOUNCEMENT"
  | "TEAM_CHAT_MESSAGE";
type InvoiceNotificationRole = "owner" | "admin" | "staff" | "webdev";

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

type InvoiceNotificationPayload = {
  type: InvoiceNotificationType;
  invoiceId?: string;
  invoiceNumber?: string;
  customer?: string;
  total?: number;
  actorName: string;
  actorRole: InvoiceNotificationRole;
  title?: string;
  message?: string;
};

type FirebaseServiceAccountJson = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

const ONE_MINUTE = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let firebaseAdminAppPromise: Promise<App> | null = null;
const allowedTypes: InvoiceNotificationType[] = [
  "CREATE_INVOICE",
  "PRINT_INVOICE",
  "UPDATE_PAYMENT_STATUS",
  "TEST_NOTIFICATION",
  "OWNER_ANNOUNCEMENT",
  "TEAM_CHAT_MESSAGE",
];

const getHeader = (req: ApiRequest, name: string) => {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseBody = (body: unknown) => {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }

  return null;
};

const isValidPayload = (payload: Record<string, unknown> | null): payload is InvoiceNotificationPayload => {
  if (!payload) return false;

  const type = payload.type as InvoiceNotificationType;
  const actorRole = payload.actorRole as InvoiceNotificationRole;
  const total = Number(payload.total || 0);
  const isTestNotification = type === "TEST_NOTIFICATION";
  const isOwnerAnnouncement = type === "OWNER_ANNOUNCEMENT";
  const isTeamChatMessage = type === "TEAM_CHAT_MESSAGE";

  return (
    allowedTypes.includes(type) &&
    (isTestNotification || isOwnerAnnouncement || isTeamChatMessage || (typeof payload.invoiceId === "string" && payload.invoiceId.trim().length > 0)) &&
    (isOwnerAnnouncement || isTestNotification || isTeamChatMessage || (typeof payload.invoiceNumber === "string" && payload.invoiceNumber.trim().length > 0)) &&
    (isOwnerAnnouncement || isTestNotification || isTeamChatMessage || typeof payload.customer === "string") &&
    typeof payload.actorName === "string" &&
    payload.actorName.trim().length > 0 &&
    (actorRole === "owner" || actorRole === "admin" || actorRole === "staff" || actorRole === "webdev") &&
    Number.isFinite(total) &&
    total >= 0
  );
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatActor = (role: InvoiceNotificationRole, name: string) =>
  `${role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Staff"} ${name}`.trim();

const buildNotificationContent = (payload: InvoiceNotificationPayload) => {
  const actor = formatActor(payload.actorRole, payload.actorName);
  const total = formatCurrency(Number(payload.total || 0));

  if (payload.type === "TEST_NOTIFICATION") {
    return {
      title: "Tanabrew Test Otomatis",
      message: "Notifikasi otomatis Tanabrew berhasil dikirim dari Vercel.",
    };
  }

  if (payload.type === "OWNER_ANNOUNCEMENT") {
    return {
      title: payload.title || "Arahan Owner Tanabrew",
      message: payload.message || "Ada arahan baru dari Owner.",
    };
  }

  if (payload.type === "TEAM_CHAT_MESSAGE") {
    return {
      title: payload.title || `[Pesan Tim] ${payload.actorName}`,
      message: payload.message || "Ada pesan baru di obrolan tim.",
    };
  }

  if (payload.type === "CREATE_INVOICE") {
    return {
      title: "Tanabrew - Invoice Baru",
      message: `${payload.invoiceNumber} dibuat oleh ${actor}\nTotal: ${total}`,
    };
  }

  if (payload.type === "PRINT_INVOICE") {
    return {
      title: "Tanabrew - Invoice Dicetak",
      message: `${payload.invoiceNumber} dicetak oleh ${actor}\nCustomer: ${payload.customer || "-"}`,
    };
  }

  return {
    title: "Tanabrew - Invoice Lunas",
    message: `${payload.invoiceNumber} ditandai lunas oleh ${actor}\nTotal: ${total}`,
  };
};

const getRequestOrigin = (req: ApiRequest) => {
  const host = getHeader(req, "host");
  if (!host) return "";

  const proto = getHeader(req, "x-forwarded-proto") || "https";
  return `${proto}://${host}`;
};

const checkRateLimit = (req: ApiRequest, authorization: string) => {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${authorization.slice(0, 32)}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + ONE_MINUTE });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return false;
  }

  current.count += 1;
  return true;
};

const toSafeDetails = (value: unknown) => {
  if (!value) return "";

  if (typeof value === "string") return value.slice(0, 280);

  if (typeof value === "object") {
    const response = value as { errors?: unknown; error?: unknown; message?: unknown };
    const details = response.errors || response.error || response.message || response;

    try {
      return JSON.stringify(details).slice(0, 280);
    } catch {
      return "Detail error tidak dapat dibaca.";
    }
  }

  return String(value).slice(0, 280);
};

const parseOneSignalResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getRuntimeName = () => (process.env.VERCEL ? "vercel" : "node");

const getEnvDebug = () => ({
  hasOneSignalAppId: Boolean(process.env.ONESIGNAL_APP_ID),
  hasOneSignalRestKey: Boolean(process.env.ONESIGNAL_REST_API_KEY),
  hasFirebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  runtime: getRuntimeName(),
});

const getSafeErrorMessage = (error: unknown) => {
  const message = error instanceof Error && error.message ? error.message : "Unknown error.";
  return message
    .replace(/-----BEGIN[\s\S]+?-----END [^-]+-----/g, "[redacted]")
    .replace(/\\n/g, "\\n")
    .slice(0, 500);
};

const maskUid = (uid: string) => {
  if (!uid) return "";
  if (uid.length <= 12) return `${uid.slice(0, 3)}...`;

  return `${uid.slice(0, 6)}...${uid.slice(-5)}`;
};

const getServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  }

  const serviceAccount = JSON.parse(raw) as FirebaseServiceAccountJson;
  const projectId = serviceAccount.project_id || serviceAccount.projectId;
  const clientEmail = serviceAccount.client_email || serviceAccount.clientEmail;
  const privateKey = serviceAccount.private_key || serviceAccount.privateKey;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid.");
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
};

const getFirebaseAdminApp = async (): Promise<App> => {
  if (!firebaseAdminAppPromise) {
    firebaseAdminAppPromise = (async () => {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const existingApp = getApps()[0];
      if (existingApp) return existingApp;

      return initializeApp({
        credential: cert(getServiceAccount()),
      });
    })().catch((error) => {
      firebaseAdminAppPromise = null;
      throw error;
    });
  }

  return firebaseAdminAppPromise;
};

const getAdminDb = async () => {
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(await getFirebaseAdminApp());
};

const getAdminAuth = async () => {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(await getFirebaseAdminApp());
};

const verifyFirebaseToken = async (authorization: string) => {
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const auth = await getAdminAuth();
  const decodedToken = await auth.verifyIdToken(token);
  return decodedToken.uid;
};

const loadNotificationRecipientUids = async (roles: InvoiceNotificationRole[] = ["owner", "admin", "staff", "webdev"]) => {
  const db = await getAdminDb();
  const snapshots = await Promise.all(
    roles.map((role) => db.collection("users").where("role", "==", role).get()),
  );
  const recipients = new Map<string, InvoiceNotificationRole>();
  const roleCounts: Record<string, number> = {};
  roles.forEach(r => { roleCounts[r] = 0; });

  snapshots.forEach((snapshot, index) => {
    const role = roles[index];
    roleCounts[role] = snapshot.size;

    snapshot.docs.forEach((userDoc) => {
      const data = userDoc.data();
      const uid = userDoc.id && userDoc.id.trim()
        ? userDoc.id.trim()
        : (typeof data.uid === "string" && data.uid.trim() ? data.uid.trim() : "");

      if (uid) {
        recipients.set(uid, role);
      }
    });
  });

  return {
    recipientUids: Array.from(recipients.keys()),
    roleCounts,
    sampleRecipientMasked: maskUid(Array.from(recipients.keys())[0] || ""),
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") {
    let firebaseAdminImportable = false;
    let firebaseAdminImportError = "";

    try {
      await import("firebase-admin/app");
      firebaseAdminImportable = true;
    } catch (error) {
      firebaseAdminImportError = getSafeErrorMessage(error);
    }

    return res.status(200).json({
      success: false,
      message: "Use POST to send notification.",
      debug: {
        ...getEnvDebug(),
        firebaseAdminImportable,
        firebaseAdminImportError,
      },
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  console.info("[Tanabrew Notification] request received");

  const authorization = getHeader(req, "authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 24) {
    return res.status(401).json({ success: false, error: "Authorization token is required." });
  }

  if (!checkRateLimit(req, authorization)) {
    return res.status(429).json({ success: false, error: "Terlalu banyak permintaan notifikasi. Coba lagi nanti." });
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const envDebug = getEnvDebug();
  console.info("[Tanabrew Notification] env status", envDebug);

  if (!appId || !restApiKey || !firebaseServiceAccountJson) {
    return res.status(500).json({
      success: false,
      error: "NOTIFICATION_ENV_MISSING",
      message: "Notification environment variables are not configured.",
      debug: envDebug,
    });
  }

  const body = parseBody(req.body);
  if (!isValidPayload(body)) {
    return res.status(400).json({ success: false, error: "Payload notifikasi tidak valid." });
  }

  try {
    await getFirebaseAdminApp();
    console.info("[Tanabrew Notification] firebase admin init status", { success: true });
  } catch (error) {
    const details = getSafeErrorMessage(error);
    console.error("[Tanabrew Notification] firebase admin init status", { success: false, details });
    return res.status(500).json({
      success: false,
      error: "FIREBASE_ADMIN_INIT_FAILED",
      message: "Firebase Admin gagal diinisialisasi.",
      details,
    });
  }

  try {
    const requesterUid = await verifyFirebaseToken(authorization);
    console.info("[Tanabrew Notification] requester verified", { hasUid: Boolean(requesterUid) });

    if (body.type === "OWNER_ANNOUNCEMENT") {
      const db = await getAdminDb();
      const userDoc = await db.collection("users").doc(requesterUid).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      if (!userData || (userData.role !== "owner" && userData.role !== "webdev")) {
        console.warn("[Tanabrew Notification] unauthorized announcement attempt", {
          uid: requesterUid,
          role: userData?.role
        });
        return res.status(403).json({
          success: false,
          error: "UNAUTHORIZED_ANNOUNCEMENT",
          message: "Hanya owner atau webdev yang dapat mengirim arahan owner."
        });
      }
    }
  } catch (error) {
    console.warn("[Tanabrew Notification] token verification failed", { details: getSafeErrorMessage(error) });
    return res.status(401).json({
      success: false,
      error: "AUTH_INVALID",
      message: "Authorization token is invalid.",
    });
  }

  let recipientUids: string[] = [];
  try {
    const recipientData = await loadNotificationRecipientUids();
    recipientUids = recipientData.recipientUids;
    console.info("[Tanabrew Notification] users query status", { success: true });
    console.info("[Tanabrew Notification] recipient roles loaded", recipientData.roleCounts);
    console.info("[Tanabrew Notification] recipient count", {
      count: recipientUids.length,
      sampleRecipientMasked: recipientData.sampleRecipientMasked,
    });
  } catch (error) {
    console.error("[Tanabrew Notification] users query status", { success: false, details: getSafeErrorMessage(error) });
    return res.status(502).json({
      success: false,
      error: "RECIPIENTS_LOAD_FAILED",
      message: "Gagal memuat target user notifikasi.",
      details: getSafeErrorMessage(error),
    });
  }

  const isBroadcast = body.type === "OWNER_ANNOUNCEMENT" || body.type === "TEST_NOTIFICATION" || body.type === "TEAM_CHAT_MESSAGE";
  if (!isBroadcast && recipientUids.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NO_NOTIFICATION_RECIPIENTS",
      message: "Tidak ada user yang bisa dikirimi notifikasi.",
    });
  }

  const { title, message } = buildNotificationContent(body);
  const origin = getRequestOrigin(req);
  const targetUrl = body.type === "TEAM_CHAT_MESSAGE"
    ? (origin ? `${origin}/obrolan` : "/obrolan")
    : (origin ? `${origin}/riwayat` : "/riwayat");

  const notificationPayload: Record<string, unknown> = {
    app_id: appId,
    target_channel: "push",
    headings: { en: title },
    contents: { en: message },
    url: targetUrl,
    chrome_web_icon: origin ? `${origin}/tanabrew-logo.png` : "/tanabrew-logo.png",
    data: {
      type: body.type,
      invoiceId: body.invoiceId || "",
      invoiceNumber: body.invoiceNumber || "",
    },
  };

  if (isBroadcast) {
    // Broadcast to ALL subscribed web and mobile devices
    notificationPayload.included_segments = ["Total Subscriptions"];
  } else {
    notificationPayload.include_aliases = {
      external_id: recipientUids,
    };
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notificationPayload),
    });
    const data = await parseOneSignalResponse(response);
    console.info("[Tanabrew Notification] OneSignal response status", {
      type: body.type,
      status: response.status,
      hasMessageId: Boolean(typeof data === "object" && data && "id" in data && data.id),
      recipientCount: recipientUids.length,
    });
    console.info("[Tanabrew Notification] OneSignal response body", toSafeDetails(data));

    if (!response.ok) {
      console.error("[Tanabrew Notification] OneSignal request failed", {
        status: response.status,
        statusText: response.statusText,
        details: toSafeDetails(data),
      });
      return res.status(502).json({
        success: false,
        error: "OneSignal request failed",
        message: "Gagal mengirim notifikasi OneSignal.",
        oneSignalStatus: response.status,
        details: toSafeDetails(data) || response.statusText,
      });
    }

    if (!(typeof data === "object" && data && "id" in data && data.id)) {
      return res.status(502).json({
        success: false,
        error: "ONESIGNAL_MESSAGE_ID_MISSING",
        message: "OneSignal tidak mengembalikan message id.",
        oneSignalStatus: response.status,
        details: toSafeDetails(data),
      });
    }

    return res.status(200).json({ success: true, messageId: data.id, recipientCount: recipientUids.length });
  } catch (error) {
    console.error("[Tanabrew Notification] OneSignal request error", error);
    return res.status(502).json({ success: false, error: "ONESIGNAL_REQUEST_FAILED", message: "Gagal menghubungi OneSignal." });
  }
}
