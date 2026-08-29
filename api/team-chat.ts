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

const verifyUser = async (authorization: string) => {
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const auth = await getAdminAuth();
  const decodedToken = await auth.verifyIdToken(token);
  const uid = decodedToken.uid;

  const db = await getAdminDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : null;

  return { uid, userData, email: decodedToken.email };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const authorization = getHeader(req, "authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 24) {
    return res.status(401).json({ success: false, error: "Authorization token is required." });
  }

  let user: { uid: string; userData: any; email?: string };
  try {
    user = await verifyUser(authorization);
  } catch (authErr: any) {
    return res.status(401).json({ success: false, error: authErr.message || "Unauthorized" });
  }

  const db = await getAdminDb();
  const { FieldValue } = await import("firebase-admin/firestore");

  // GET: Load all team members and recent messages
  if (req.method === "GET") {
    try {
      // 1. Update requester's last_active_at
      await db.collection("users").doc(user.uid).set(
        { last_active_at: FieldValue.serverTimestamp() },
        { merge: true }
      );

      // 2. Fetch all users from Firestore and cross-verify with Firebase Auth
      const usersSnap = await db.collection("users").get();
      const auth = await getAdminAuth();
      const authUsersResult = await auth.listUsers().catch(() => null);
      const activeAuthUids = authUsersResult ? new Set(authUsersResult.users.map((u) => u.uid)) : null;

      const nowMs = Date.now();
      const users: any[] = [];

      for (const doc of usersSnap.docs) {
        // If Firebase Auth verification is available, purge deleted accounts
        if (activeAuthUids && !activeAuthUids.has(doc.id)) {
          void db.collection("users").doc(doc.id).delete().catch(() => {});
          continue;
        }

        const data = doc.data();
        let lastActiveMs = 0;
        if (data.last_active_at) {
          try {
            lastActiveMs = data.last_active_at.toMillis ? data.last_active_at.toMillis() : new Date(data.last_active_at).getTime();
          } catch {}
        }
        // Online if active within last 5 minutes (300000 ms)
        const isOnline = doc.id === user.uid || (nowMs - lastActiveMs < 5 * 60 * 1000);

        users.push({
          uid: doc.id,
          name: data.name || data.email?.split("@")[0] || "User",
          email: data.email || "",
          role: data.role || "staff",
          photo_url: data.photo_url || "",
          last_active_at: data.last_active_at || null,
          is_online: isOnline,
        });
      }

      // 3. Fetch latest messages from team_messages
      const msgSnap = await db.collection("team_messages")
        .orderBy("created_at", "desc")
        .limit(100)
        .get();

      const messages = msgSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })).reverse();

      return res.status(200).json({ success: true, users, messages });
    } catch (err: any) {
      console.error("[Team Chat GET Error]", err);
      return res.status(500).json({ success: false, error: err.message || "Gagal memuat obrolan tim" });
    }
  }

  // POST: Send new message
  if (req.method === "POST") {
    const body = parseBody(req.body);
    const messageText = (body?.message as string || "").trim();

    if (!messageText) {
      return res.status(400).json({ success: false, error: "Pesan tidak boleh kosong." });
    }

    try {
      const senderName = user.userData?.name || user.email?.split("@")[0] || "Rekan Tim";
      const senderRole = user.userData?.role || "staff";
      const senderPhoto = user.userData?.photo_url || "";

      // 1. Save to team_messages collection
      const docRef = await db.collection("team_messages").add({
        sender_uid: user.uid,
        sender_name: senderName,
        sender_role: senderRole,
        sender_photo: senderPhoto,
        message: messageText,
        created_at: FieldValue.serverTimestamp(),
      });

      // 2. Update user's last_active_at
      await db.collection("users").doc(user.uid).set(
        { last_active_at: FieldValue.serverTimestamp() },
        { merge: true }
      );

      // 3. Trigger OneSignal notification
      const appId = process.env.ONESIGNAL_APP_ID;
      const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
      if (appId && restApiKey) {
        try {
          const host = getHeader(req, "host");
          const proto = getHeader(req, "x-forwarded-proto") || "https";
          const origin = host ? `${proto}://${host}` : "";

          const avatarUrl = origin
            ? `${origin}/api/user-avatar?uid=${user.uid}&name=${encodeURIComponent(senderName)}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=2E7D32&color=fff&size=192&bold=true`;

          await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
              Authorization: `Key ${restApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_id: appId,
              target_channel: "push",
              headings: { en: `[Pesan Tim] ${senderName} (${senderRole.toUpperCase()})` },
              contents: { en: messageText.length > 90 ? `${messageText.slice(0, 90)}...` : messageText },
              url: origin ? `${origin}/obrolan` : "/obrolan",
              chrome_web_icon: avatarUrl,
              large_icon: avatarUrl,
              chrome_web_image: avatarUrl,
              big_picture: avatarUrl,
              ios_attachments: { avatar: avatarUrl },
              included_segments: ["Total Subscriptions"],
              data: { type: "TEAM_CHAT_MESSAGE" },
            }),
          });
        } catch (notifErr) {
          console.warn("[Team Chat Notif Warning]", notifErr);
        }
      }

      return res.status(200).json({ success: true, messageId: docRef.id });
    } catch (err: any) {
      console.error("[Team Chat POST Error]", err);
      return res.status(500).json({ success: false, error: err.message || "Gagal mengirim pesan" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, error: "Method not allowed." });
}
