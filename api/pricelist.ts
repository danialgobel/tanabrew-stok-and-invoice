import type { App } from "firebase-admin/app";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string | string[]) => void;
  json: (data: any) => void;
  send: (body: any) => void;
  redirect: (url: string) => void;
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

const DEFAULT_IMAGE =
  "https://raw.githubusercontent.com/danialgobel/price-list-id-card/main/images/pricelist.jpg";

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
  // Allow public CORS for customer access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  try {
    const adminApp = await getFirebaseAdminApp();

    if (req.method === "GET") {
      if (adminApp) {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore(adminApp);
        const docSnap = await db.collection("products").doc("config_pricelist").get();

        if (docSnap.exists) {
          const data = docSnap.data();
          const imageUrl = data?.image_url || DEFAULT_IMAGE;
          res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
          return res.status(200).json({
            success: true,
            image_url: imageUrl,
            updated_at: data?.updated_at || null,
          });
        }
      }

      // Default fallback
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      return res.status(200).json({
        success: true,
        image_url: DEFAULT_IMAGE,
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const imageUrl = body.image_url;

      if (!imageUrl) {
        return res.status(400).json({ error: "image_url is required" });
      }

      if (adminApp) {
        const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
        const db = getFirestore(adminApp);
        await db.collection("products").doc("config_pricelist").set(
          {
            is_system_config: true,
            image_url: imageUrl,
            updated_at: FieldValue.serverTimestamp(),
            updated_by: body.updated_by || "Owner",
          },
          { merge: true },
        );

        return res.status(200).json({ success: true, message: "Pricelist updated" });
      }

      return res.status(500).json({ error: "Firebase Admin not configured" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Pricelist API error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error",
      image_url: DEFAULT_IMAGE,
    });
  }
}
