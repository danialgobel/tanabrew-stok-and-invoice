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

const verifyRequester = async (authorization: string) => {
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const auth = await getAdminAuth();
  const decodedToken = await auth.verifyIdToken(token);
  const uid = decodedToken.uid;

  const db = await getAdminDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;

  if (!userData || (userData.role !== "webdev" && userData.role !== "owner")) {
    throw new Error("Akses ditolak: Hanya role Developer atau Owner yang diizinkan.");
  }

  return { uid, userData };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const authorization = getHeader(req, "authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 24) {
    return res.status(401).json({ success: false, error: "Authorization token is required." });
  }

  try {
    await verifyRequester(authorization);
  } catch (authErr: any) {
    return res.status(403).json({ success: false, error: authErr.message || "Unauthorized" });
  }

  const db = await getAdminDb();

  // GET: List all users from Firestore via Admin SDK cross-verified with Firebase Auth
  if (req.method === "GET") {
    try {
      const snap = await db.collection("users").get();
      const auth = await getAdminAuth();
      const authUsersResult = await auth.listUsers().catch(() => null);
      const activeAuthUids = authUsersResult ? new Set(authUsersResult.users.map((u) => u.uid)) : null;

      const users: any[] = [];
      for (const d of snap.docs) {
        if (activeAuthUids && !activeAuthUids.has(d.id)) {
          void db.collection("users").doc(d.id).delete().catch(() => {});
          continue;
        }
        users.push({
          id: d.id,
          ...d.data(),
        });
      }

      return res.status(200).json({ success: true, users });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || "Gagal memuat pengguna" });
    }
  }

  // POST: Change Role or Delete User
  if (req.method === "POST") {
    const body = parseBody(req.body);
    if (!body || !body.action) {
      return res.status(400).json({ success: false, error: "Action is required." });
    }

    const { action, userId, newRole } = body as { action: string; userId?: string; newRole?: string };

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ success: false, error: "userId is required." });
    }

    if (action === "update_role") {
      if (!newRole || !["owner", "admin", "staff", "webdev"].includes(newRole)) {
        return res.status(400).json({ success: false, error: "Role tidak valid." });
      }

      try {
        const { FieldValue } = await import("firebase-admin/firestore");
        await db.collection("users").doc(userId).set(
          {
            role: newRole,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.status(200).json({ success: true, message: `Role berhasil diubah menjadi ${newRole}` });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    if (action === "delete_user") {
      try {
        await db.collection("users").doc(userId).delete();
        return res.status(200).json({ success: true, message: "User berhasil dihapus." });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    if (action === "switch_user" || action === "create_custom_token") {
      try {
        const auth = await getAdminAuth();
        const customToken = await auth.createCustomToken(userId);
        return res.status(200).json({
          success: true,
          customToken,
          message: "Token otentikasi akun berhasil dibuat."
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message || "Gagal membuat custom token." });
      }
    }

    return res.status(400).json({ success: false, error: `Action '${action}' tidak dikenal.` });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, error: "Method not allowed." });
}
