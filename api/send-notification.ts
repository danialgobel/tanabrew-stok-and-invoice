type InvoiceNotificationType = "CREATE_INVOICE" | "PRINT_INVOICE" | "UPDATE_PAYMENT_STATUS" | "TEST_NOTIFICATION";
type InvoiceNotificationRole = "admin" | "staff";

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
  invoiceNumber: string;
  customer: string;
  total: number;
  actorName: string;
  actorRole: InvoiceNotificationRole;
};

const ONE_MINUTE = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const allowedTypes: InvoiceNotificationType[] = [
  "CREATE_INVOICE",
  "PRINT_INVOICE",
  "UPDATE_PAYMENT_STATUS",
  "TEST_NOTIFICATION",
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

  return (
    allowedTypes.includes(type) &&
    (isTestNotification || (typeof payload.invoiceId === "string" && payload.invoiceId.trim().length > 0)) &&
    typeof payload.invoiceNumber === "string" &&
    payload.invoiceNumber.trim().length > 0 &&
    typeof payload.customer === "string" &&
    typeof payload.actorName === "string" &&
    payload.actorName.trim().length > 0 &&
    (actorRole === "admin" || actorRole === "staff") &&
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
  `${role === "admin" ? "Admin" : "Staff"} ${name}`.trim();

const buildNotificationContent = (payload: InvoiceNotificationPayload) => {
  const actor = formatActor(payload.actorRole, payload.actorName);
  const total = formatCurrency(Number(payload.total || 0));

  if (payload.type === "TEST_NOTIFICATION") {
    return {
      title: "Tanabrew Test Otomatis",
      message: "Notifikasi otomatis Tanabrew berhasil dikirim dari Vercel.",
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const authorization = getHeader(req, "authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 24) {
    return res.status(401).json({ success: false, error: "Authorization token is required." });
  }

  // TODO: Verify Firebase ID tokens with firebase-admin once service account env is available.
  if (!checkRateLimit(req, authorization)) {
    return res.status(429).json({ success: false, error: "Terlalu banyak permintaan notifikasi. Coba lagi nanti." });
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  console.info("OneSignal env check", {
    hasAppId: Boolean(appId),
    hasRestKey: Boolean(restApiKey),
  });

  if (!appId || !restApiKey) {
    return res.status(500).json({
      success: false,
      error: "OneSignal environment variables are not configured.",
    });
  }

  const body = parseBody(req.body);
  if (!isValidPayload(body)) {
    return res.status(400).json({ success: false, error: "Payload notifikasi tidak valid." });
  }

  const { title, message } = buildNotificationContent(body);
  const origin = getRequestOrigin(req);
  const notificationPayload = {
    app_id: appId,
    target_channel: "push",
    included_segments: ["Subscribed Users"],
    headings: { en: title },
    contents: { en: message },
    url: origin ? `${origin}/riwayat` : "/riwayat",
    chrome_web_icon: origin ? `${origin}/tanabrew-logo.png` : "/tanabrew-logo.png",
    data: {
      type: body.type,
      invoiceId: body.invoiceId || "",
      invoiceNumber: body.invoiceNumber,
    },
  };

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notificationPayload),
    });
    const data = await response.json().catch(() => ({}));
    console.info("OneSignal notification response", {
      type: body.type,
      status: response.status,
      hasMessageId: Boolean(data.id),
      response: data,
    });

    if (!response.ok) {
      console.error("OneSignal notification failed", {
        status: response.status,
        statusText: response.statusText,
        response: data,
      });
      return res.status(502).json({
        success: false,
        error: "OneSignal request failed",
        details: toSafeDetails(data) || response.statusText,
      });
    }

    if (!data.id) {
      return res.status(502).json({
        success: false,
        error: "OneSignal accepted request but no message id returned. Target audience may be empty.",
        details: toSafeDetails(data),
      });
    }

    return res.status(200).json({ success: true, messageId: data.id });
  } catch (error) {
    console.error("OneSignal notification request error", error);
    return res.status(502).json({ success: false, error: "Gagal menghubungi OneSignal." });
  }
}
