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

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

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

  const app = await getFirebaseAdminApp();
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const db = getFirestore(app);

  let invoiceId: string | undefined;

  try {
    const user = await verifyUserAuth(req);

    if (user.role !== "owner" && user.role !== "admin" && user.role !== "webdev") {
      res.status(403).json({
        success: false,
        error: "Hanya Owner/Admin/Developer yang dapat mengirim invoice ke WhatsApp.",
      });
      return;
    }

    const payload = parseBody(req.body);
    invoiceId = payload?.invoiceId as string;
    const pdfBase64 = payload?.pdfBase64 as string;
    const forceSend = Boolean(payload?.forceSend);
    let groupId = payload?.groupId as string;
    let groupName = (payload?.groupName as string) || "Grup WhatsApp";
    let fileName = (payload?.fileName as string) || "Invoice.pdf";
    let caption = payload?.caption as string;

    if (!invoiceId) {
      res.status(400).json({ success: false, error: "invoiceId wajib diisi." });
      return;
    }

    if (!pdfBase64) {
      res.status(400).json({ success: false, error: "pdfBase64 wajib diisi." });
      return;
    }

    // 1. Check invoice in Firestore & Prevent Duplication
    const invoiceRef = db.collection("invoices").doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      res.status(404).json({ success: false, error: "Invoice tidak ditemukan di database." });
      return;
    }

    const invoiceData = invoiceSnap.data() || {};
    const existingStatus = invoiceData.whatsapp_status;

    if (existingStatus?.status === "SENT" && !forceSend) {
      res.status(200).json({
        success: true,
        alreadySent: true,
        message: `Invoice ${invoiceData.no_invoice || invoiceId} sudah pernah dikirim ke grup ${existingStatus.group_name || "WhatsApp"}.`,
        sentAt: existingStatus.sent_at,
      });
      return;
    }

    // 2. Resolve Target Group if not explicitly passed
    if (!groupId) {
      const configDoc = await db.collection("system_settings").doc("whatsapp").get();
      const configData = configDoc.exists ? configDoc.data() : null;
      groupId = configData?.target_group_id;
      groupName = configData?.target_group_name || "Grup Tanabrew";
    }

    if (!groupId) {
      res.status(400).json({
        success: false,
        error: "Grup WhatsApp tujuan belum dipilih. Buka menu Pengaturan WhatsApp untuk memilih grup tujuan.",
      });
      return;
    }

    // 3. Build Caption if not provided
    if (!caption) {
      const noInv = invoiceData.no_invoice || invoiceId;
      const cust = invoiceData.customer || "Umum";
      const totalFmt = formatCurrency(invoiceData.total || 0);
      const statusPay = invoiceData.status || "LUNAS";
      const dibuatOleh = invoiceData.dibuat_oleh || user.name;

      caption = `📄 *INVOICE TANABREW ROASTERY*\n\n` +
        `• *No. Invoice:* ${noInv}\n` +
        `• *Customer:* ${cust}\n` +
        `• *Total:* ${totalFmt}\n` +
        `• *Status:* ${statusPay}\n` +
        `• *Kasir:* ${dibuatOleh}\n\n` +
        `_Invoice otomatis dikirim oleh sistem Tanabrew._`;
    }

    const waServiceUrl = (process.env.WHATSAPP_SERVICE_URL || "").replace(/\/$/, "");
    const waServiceApiKey = process.env.WHATSAPP_SERVICE_API_KEY || "";

    if (!waServiceUrl) {
      throw new Error("WHATSAPP_SERVICE_URL belum dikonfigurasi pada server Vercel.");
    }

    // 4. Set state to SENDING in Firestore
    await invoiceRef.set(
      {
        whatsapp_status: {
          status: "SENDING",
          group_id: groupId,
          group_name: groupName,
          last_attempt: FieldValue.serverTimestamp(),
          attempt_count: FieldValue.increment(1),
          triggered_by: user.name,
          triggered_by_uid: user.uid,
        },
      },
      { merge: true }
    );

    // 5. Send to WhatsApp microservice
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (waServiceApiKey) {
      headers["Authorization"] = `Bearer ${waServiceApiKey}`;
    }

    const response = await fetch(`${waServiceUrl}/send-invoice`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        groupId,
        pdfBase64,
        fileName,
        caption,
      }),
    });

    const respText = await response.text();
    let respJson: Record<string, any> = {};
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { error: respText };
    }

    if (!response.ok || respJson.success !== true) {
      const errorMsg = respJson.error || `HTTP ${response.status}: Gagal mengirim ke WhatsApp`;
      await invoiceRef.set(
        {
          whatsapp_status: {
            status: "FAILED",
            group_id: groupId,
            group_name: groupName,
            error_message: errorMsg,
            last_attempt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      res.status(502).json({
        success: false,
        error: errorMsg,
      });
      return;
    }

    // 6. Update status to SENT in Firestore
    await invoiceRef.set(
      {
        whatsapp_status: {
          status: "SENT",
          group_id: groupId,
          group_name: groupName,
          message_id: respJson.messageId || "",
          sent_at: FieldValue.serverTimestamp(),
          error_message: null,
        },
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      message: `Invoice berhasil dikirim ke grup ${groupName}.`,
      messageId: respJson.messageId,
      groupName,
    });
  } catch (error: any) {
    console.error("Error in /api/whatsapp-send:", error);

    if (invoiceId) {
      try {
        await db.collection("invoices").doc(invoiceId).set(
          {
            whatsapp_status: {
              status: "FAILED",
              error_message: error?.message || "Internal server error",
              last_attempt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
      } catch {}
    }

    res.status(500).json({
      success: false,
      error: error?.message || "Internal server error",
    });
  }
}
