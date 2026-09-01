import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import {
  initWhatsApp,
  getWhatsAppStatus,
  requestPairingCode,
  getWhatsAppGroups,
  sendInvoicePdf,
  disconnectWhatsApp,
} from "./whatsapp.js";

dotenv.config();

const app = express();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit

const PORT = Number(process.env.PORT) || 3001;
const API_KEY = process.env.WHATSAPP_SERVICE_API_KEY || "";

app.use(cors());
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

// Middleware: API Key Authentication
const requireAuth: express.RequestHandler = (req, res, next) => {
  if (!API_KEY) {
    // If no API Key configured on server, permit requests (e.g. initial dev)
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : req.headers["x-api-key"];

  if (!token || token !== API_KEY) {
    res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing API key.",
    });
    return;
  }

  next();
};

// 1. Health Check (Public)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "tanabrew-whatsapp-service",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 2. WhatsApp Status
app.get("/status", requireAuth, (_req, res) => {
  const status = getWhatsAppStatus();
  res.json({
    success: true,
    ...status,
  });
});

// 3. QR Code endpoint
app.get("/qr", requireAuth, (_req, res) => {
  const status = getWhatsAppStatus();
  res.json({
    success: true,
    connected: status.connected,
    connecting: status.connecting,
    qrCode: status.qrCode,
  });
});

// 4. Request 8-digit Pairing Code
app.post("/pair-code", requireAuth, async (req, res) => {
  const { phoneNumber } = req.body || {};
  if (!phoneNumber || typeof phoneNumber !== "string") {
    res.status(400).json({ success: false, error: "Nomor telepon (phoneNumber) wajib diisi." });
    return;
  }

  try {
    const code = await requestPairingCode(phoneNumber);
    res.json({ success: true, pairingCode: code });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get List of WhatsApp Groups
app.get("/groups", requireAuth, async (_req, res) => {
  try {
    const groups = await getWhatsAppGroups();
    res.json({ success: true, groups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Send Invoice PDF
app.post("/send-invoice", requireAuth, upload.single("pdfFile"), async (req, res) => {
  try {
    let groupId = req.body?.groupId as string;
    let fileName = (req.body?.fileName as string) || "Invoice.pdf";
    let caption = (req.body?.caption as string) || "";
    let pdfBuffer: Buffer | null = null;

    if (req.file?.buffer) {
      pdfBuffer = req.file.buffer;
      if (req.file.originalname) {
        fileName = req.file.originalname;
      }
    } else if (req.body?.pdfBase64) {
      const base64Data = (req.body.pdfBase64 as string).replace(/^data:application\/pdf;base64,/, "");
      pdfBuffer = Buffer.from(base64Data, "base64");
    }

    if (!groupId) {
      res.status(400).json({ success: false, error: "groupId wajib diisi." });
      return;
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      res.status(400).json({ success: false, error: "File PDF (pdfFile atau pdfBase64) wajib disertakan." });
      return;
    }

    const result = await sendInvoicePdf({
      groupId,
      pdfBuffer,
      fileName,
      caption,
    });

    res.json({
      success: true,
      messageId: result.messageId,
      message: "Invoice PDF berhasil dikirim ke grup WhatsApp.",
    });
  } catch (err: any) {
    console.error("Error sending invoice to WhatsApp:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Gagal mengirim invoice ke WhatsApp.",
    });
  }
});

// 7. Disconnect WhatsApp
app.post("/disconnect", requireAuth, async (_req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: "WhatsApp disconnected and session cleared." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server & Initialize WhatsApp
app.listen(PORT, "0.0.0.0", () => {
  console.log(`=============================================`);
  console.log(`🚀 Tanabrew WhatsApp Service running on port ${PORT}`);
  console.log(`🔑 Auth protection: ${API_KEY ? "ENABLED (Bearer token required)" : "DISABLED"}`);
  console.log(`=============================================`);
  void initWhatsApp();
});
