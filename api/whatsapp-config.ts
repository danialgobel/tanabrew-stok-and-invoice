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
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const user = await verifyUserAuth(req);

    if (user.role !== "owner" && user.role !== "admin" && user.role !== "webdev") {
      res.status(403).json({ success: false, error: "Hanya Owner/Admin/Developer yang dapat mengubah pengaturan WhatsApp." });
      return;
    }

    const payload = parseBody(req.body);
    const targetGroupId = payload?.target_group_id as string;
    const targetGroupName = payload?.target_group_name as string;

    if (!targetGroupId || typeof targetGroupId !== "string") {
      res.status(400).json({ success: false, error: "target_group_id wajib diisi." });
      return;
    }

    const app = await getFirebaseAdminApp();
    const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
    const db = getFirestore(app);

    await db.collection("system_settings").doc("whatsapp").set(
      {
        target_group_id: targetGroupId,
        target_group_name: targetGroupName || "Grup WhatsApp",
        updated_at: FieldValue.serverTimestamp(),
        updated_by: user.name || user.email,
        updated_by_uid: user.uid,
        updated_by_role: user.role,
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      message: `Grup tujuan WhatsApp berhasil disimpan: ${targetGroupName || targetGroupId}`,
    });
  } catch (error: any) {
    console.error("Error in /api/whatsapp-config:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Internal server error",
    });
  }
}
