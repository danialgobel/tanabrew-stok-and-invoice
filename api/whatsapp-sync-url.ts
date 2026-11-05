import type { App } from "firebase-admin/app";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
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

let firebaseAdminAppPromise: Promise<App> | null = null;

const getHeader = (req: ApiRequest, name: string) => {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
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
  if (firebaseAdminAppPromise) return firebaseAdminAppPromise;

  firebaseAdminAppPromise = (async () => {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const existing = getApps();
    if (existing.length > 0) return existing[0];

    const { projectId, clientEmail, privateKey } = getServiceAccount();
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  })();

  return firebaseAdminAppPromise;
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Sync-Secret");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = parseBody(req.body);
    const serviceUrl = ((payload?.service_url as string) || "").trim();
    const syncSecret = ((payload?.sync_secret as string) || getHeader(req, "x-sync-secret") || "").trim();

    // Verification secret: matches WA service API key or Tanabrew internal secret
    const expectedSecret = process.env.WHATSAPP_SERVICE_API_KEY || "tanabrew-wa-secret-2026";
    if (syncSecret !== expectedSecret && syncSecret !== "tanabrew-wa-secret-2026") {
      res.status(401).json({ success: false, error: "Unauthorized: Invalid sync secret" });
      return;
    }

    if (!serviceUrl || !serviceUrl.startsWith("http")) {
      res.status(400).json({ success: false, error: "service_url must be a valid HTTP/HTTPS URL" });
      return;
    }

    const app = await getFirebaseAdminApp();
    const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
    const db = getFirestore(app);

    await db.collection("system_settings").doc("whatsapp").set(
      {
        service_url: serviceUrl.replace(/\/$/, ""),
        last_synced_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      message: `WhatsApp service URL successfully registered: ${serviceUrl}`,
      service_url: serviceUrl,
    });
  } catch (error: any) {
    console.error("Error in /api/whatsapp-sync-url:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Internal server error",
    });
  }
}
