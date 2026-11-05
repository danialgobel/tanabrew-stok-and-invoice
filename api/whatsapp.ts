import type { App } from "firebase-admin/app";

type ApiRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
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

const verifyUserAuth = async (req: ApiRequest) => {
  const authHeader = getHeader(req, "authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing Bearer token.");
  }

  const token = authHeader.substring(7);
  const app = await getFirebaseAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  const decoded = await getAuth(app).verifyIdToken(token);

  const { getFirestore } = await import("firebase-admin/firestore");
  const userDoc = await getFirestore(app).collection("users").doc(decoded.uid).get();
  const userData = userDoc.data();
  const role = userData?.role || "staff";

  return { uid: decoded.uid, email: decoded.email, role, name: userData?.name || "" };
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Sync-Secret");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  const app = await getFirebaseAdminApp();
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const db = getFirestore(app);

  const payload = parseBody(req.body);
  const actionFromQuery = typeof req.query?.action === "string" ? req.query.action : "";
  const actionFromBody = typeof payload?.action === "string" ? payload.action : "";
  const action = actionFromBody || actionFromQuery;

  // =========================================================================
  // 1. AUTO-SYNC DAEMON FROM LAPTOP (SYNC_URL)
  // Tidak memerlukan Bearer user token, dilindungi oleh secret key
  // =========================================================================
  if (req.method === "POST" && (action === "sync_url" || payload?.service_url && payload?.sync_secret)) {
    const SYNC_SECRET = process.env.WHATSAPP_SERVICE_API_KEY || "tanabrew-wa-sync-key-2026";
    const providedSecret = (payload?.sync_secret as string) || getHeader(req, "x-sync-secret");

    if (!providedSecret || providedSecret !== SYNC_SECRET) {
      res.status(401).json({ success: false, error: "Unauthorized: Invalid sync secret." });
      return;
    }

    const serviceUrl = ((payload?.service_url as string) || "").trim().replace(/\/$/, "");
    if (!serviceUrl.startsWith("http://") && !serviceUrl.startsWith("https://")) {
      res.status(400).json({ success: false, error: "service_url tidak valid." });
      return;
    }

    await db.collection("system_settings").doc("whatsapp").set(
      {
        service_url: serviceUrl,
        last_sync_at: FieldValue.serverTimestamp(),
        sync_source: "laptop-daemon",
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      message: "Tunnel URL berhasil disinkronkan ke cloud.",
      service_url: serviceUrl,
    });
    return;
  }

  // =========================================================================
  // SEMUA AKSI LAIN MEMERLUKAN AUTH USER
  // =========================================================================
  try {
    const user = await verifyUserAuth(req);

    // 1. Read saved configuration
    const configDoc = await db.collection("system_settings").doc("whatsapp").get();
    const savedConfig = configDoc.exists ? configDoc.data() : null;
    const waServiceUrl = (savedConfig?.service_url || process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    const waServiceApiKey = process.env.WHATSAPP_SERVICE_API_KEY || "";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (waServiceApiKey) {
      headers["Authorization"] = `Bearer ${waServiceApiKey}`;
    }

    // =========================================================================
    // 2. GET / STATUS
    // =========================================================================
    if (req.method === "GET" || action === "status") {
      if (!waServiceUrl) {
        res.status(200).json({
          success: true,
          serviceConfigured: false,
          connected: false,
          connecting: false,
          message: "WHATSAPP_SERVICE_URL belum dikonfigurasi.",
          savedConfig,
        });
        return;
      }

      try {
        const statusResp = await fetch(`${waServiceUrl}/status`, { method: "GET", headers });
        if (!statusResp.ok) {
          const text = await statusResp.text();
          res.status(200).json({
            success: false,
            serviceConfigured: true,
            connected: false,
            error: `Gagal menghubungi WhatsApp service (${statusResp.status}): ${text.slice(0, 150)}`,
            savedConfig,
          });
          return;
        }

        const statusData = (await statusResp.json()) as Record<string, any>;
        let groups: any[] = [];
        if (statusData.connected) {
          try {
            const groupsResp = await fetch(`${waServiceUrl}/groups`, { method: "GET", headers });
            if (groupsResp.ok) {
              const groupsData = (await groupsResp.json()) as Record<string, any>;
              groups = groupsData.groups || [];
            }
          } catch { }
        }

        res.status(200).json({
          success: true,
          serviceConfigured: true,
          ...statusData,
          groups,
          savedConfig,
        });
      } catch (fetchErr: any) {
        res.status(200).json({
          success: false,
          serviceConfigured: true,
          connected: false,
          connecting: false,
          error: `Server laptop tidak dapat dihubungi (${fetchErr.message}). Pastikan shortcut WhatsApp di laptop aktif.`,
          savedConfig,
        });
      }
      return;
    }

    // =========================================================================
    // 3. POST / CONFIG (SAVE GROUP & SERVICE URL)
    // =========================================================================
    if (action === "config" || action === "save_config" || (!action && (payload?.target_group_id || payload?.service_url))) {
      if (user.role !== "owner" && user.role !== "admin" && user.role !== "webdev") {
        res.status(403).json({ success: false, error: "Hanya Owner/Admin yang dapat mengubah konfigurasi." });
        return;
      }

      const targetGroupId = payload?.target_group_id as string;
      const targetGroupName = payload?.target_group_name as string;
      const serviceUrl = ((payload?.service_url as string) || "").trim();

      const updateData: Record<string, any> = {
        updated_at: FieldValue.serverTimestamp(),
        updated_by: user.name,
        updated_by_uid: user.uid,
      };

      if (targetGroupId) {
        updateData.target_group_id = targetGroupId;
        updateData.target_group_name = targetGroupName || "Grup WhatsApp";
      }
      if (serviceUrl) {
        updateData.service_url = serviceUrl.replace(/\/$/, "");
      }

      await db.collection("system_settings").doc("whatsapp").set(updateData, { merge: true });

      res.status(200).json({
        success: true,
        message: "Konfigurasi WhatsApp berhasil disimpan.",
        data: updateData,
      });
      return;
    }

    // =========================================================================
    // 4. POST / PAIR CODE
    // =========================================================================
    if (action === "pair_code" || action === "pair-code" || payload?.phoneNumber) {
      if (!waServiceUrl) {
        res.status(400).json({ success: false, error: "Server WhatsApp belum dikonfigurasi." });
        return;
      }

      const phoneNumber = payload?.phoneNumber as string;
      if (!phoneNumber) {
        res.status(400).json({ success: false, error: "phoneNumber wajib diisi." });
        return;
      }

      const response = await fetch(`${waServiceUrl}/request-pair-code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phoneNumber }),
      });

      const respData = await response.json();
      if (!response.ok || !respData.success) {
        res.status(response.status || 500).json({
          success: false,
          error: respData.error || "Gagal meminta pairing code.",
        });
        return;
      }

      res.status(200).json(respData);
      return;
    }

    // =========================================================================
    // 5. POST / DISCONNECT
    // =========================================================================
    if (action === "disconnect") {
      if (user.role !== "owner" && user.role !== "admin" && user.role !== "webdev") {
        res.status(403).json({ success: false, error: "Hanya Owner/Admin yang dapat memutuskan sesi." });
        return;
      }

      if (!waServiceUrl) {
        res.status(400).json({ success: false, error: "Server WhatsApp belum dikonfigurasi." });
        return;
      }

      const response = await fetch(`${waServiceUrl}/disconnect`, {
        method: "POST",
        headers,
      });

      const respData = await response.json();
      res.status(response.status || 200).json(respData);
      return;
    }

    res.status(400).json({ success: false, error: `Action '${action}' tidak dikenali.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
}
