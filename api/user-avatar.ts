import type { App } from "firebase-admin/app";

type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string | string[]) => void;
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
  const uid = typeof req.query?.uid === "string" ? req.query.uid : "";
  const name = typeof req.query?.name === "string" ? req.query.name : "Tanabrew";

  // Fallback fallback URL
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2E7D32&color=fff&size=192&bold=true`;

  if (!uid) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(fallbackUrl);
  }

  try {
    const adminApp = await getFirebaseAdminApp();
    if (adminApp) {
      const { getFirestore } = await import("firebase-admin/firestore");
      const db = getFirestore(adminApp);
      const userDoc = await db.collection("users").doc(uid).get();

      if (userDoc.exists) {
        const data = userDoc.data();
        const photoUrl = data?.photo_url;

        // If user has a base64 image
        if (typeof photoUrl === "string" && photoUrl.startsWith("data:image/")) {
          const matches = photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], "base64");

            res.setHeader("Content-Type", mimeType);
            res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
            return res.send(buffer);
          }
        } else if (typeof photoUrl === "string" && photoUrl.startsWith("https://")) {
          return res.redirect(photoUrl);
        }
      }
    }
  } catch (err) {
    console.warn("Avatar fetch error:", err);
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.redirect(fallbackUrl);
}
