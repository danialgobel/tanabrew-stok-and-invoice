type OneSignalUserRole = "admin" | "staff";

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

type SyncOneSignalUserPayload = {
  uid: string;
  role: OneSignalUserRole;
  name: string;
  email: string;
};

const ONE_MINUTE = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

const toTagValue = (value: unknown) => String(value || "").trim();

const isValidPayload = (payload: Record<string, unknown> | null): payload is SyncOneSignalUserPayload => {
  if (!payload) return false;

  const uid = toTagValue(payload.uid);
  const role = toTagValue(payload.role);

  return (
    uid.length > 0 &&
    (role === "admin" || role === "staff") &&
    (payload.name === undefined || typeof payload.name === "string") &&
    (payload.email === undefined || typeof payload.email === "string")
  );
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

const parseOneSignalResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const toSafeDetails = (value: unknown) => {
  if (!value) return "";

  if (typeof value === "string") return value.slice(0, 500);

  if (typeof value === "object") {
    const response = value as { errors?: unknown; error?: unknown; message?: unknown };
    const details = response.errors || response.error || response.message || response;

    try {
      return JSON.stringify(details).slice(0, 500);
    } catch {
      return "Detail response tidak dapat dibaca.";
    }
  }

  return String(value).slice(0, 500);
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  console.info("[Tanabrew OneSignal Sync] request received");

  const authorization = getHeader(req, "authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 24) {
    return res.status(401).json({
      success: false,
      error: "AUTH_REQUIRED",
      message: "Authorization token is required.",
    });
  }

  // TODO: Verify Firebase ID tokens with firebase-admin once service account env is available.
  if (!checkRateLimit(req, authorization)) {
    return res.status(429).json({
      success: false,
      error: "RATE_LIMITED",
      message: "Terlalu banyak permintaan sinkronisasi. Coba lagi nanti.",
    });
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const envDebug = {
    hasAppId: Boolean(appId),
    hasRestKey: Boolean(restApiKey),
  };
  console.info("[Tanabrew OneSignal Sync] env status", envDebug);

  if (!appId || !restApiKey) {
    return res.status(500).json({
      success: false,
      error: "ONESIGNAL_ENV_MISSING",
      message: "OneSignal environment variables are not configured.",
      debug: envDebug,
    });
  }

  const body = parseBody(req.body);
  if (!isValidPayload(body)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_PAYLOAD",
      message: "Payload sinkronisasi tag tidak valid.",
    });
  }

  const tags = {
    role: body.role,
    uid: toTagValue(body.uid),
    name: toTagValue(body.name),
    email: toTagValue(body.email),
  };

  const endpoint = `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(tags.uid)}`;

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          tags,
        },
      }),
    });
    const data = await parseOneSignalResponse(response);

    console.info("[Tanabrew OneSignal Sync] response status", {
      status: response.status,
      ok: response.ok,
    });
    console.info("[Tanabrew OneSignal Sync] response body", toSafeDetails(data));

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "ONESIGNAL_SYNC_FAILED",
        message: "Gagal menyinkronkan tag OneSignal.",
        oneSignalStatus: response.status,
        details: toSafeDetails(data),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tag OneSignal berhasil disinkronkan.",
      oneSignalStatus: response.status,
    });
  } catch (error) {
    console.error("[Tanabrew OneSignal Sync] request error", error);
    return res.status(502).json({
      success: false,
      error: "ONESIGNAL_SYNC_FAILED",
      message: "Gagal menghubungi OneSignal.",
    });
  }
}
