import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState,
  type GroupMetadata,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

export interface WhatsAppGroupInfo {
  id: string;
  name: string;
  participantCount?: number;
}

export interface WhatsAppStatus {
  connected: boolean;
  connecting: boolean;
  user: {
    id: string;
    name?: string;
  } | null;
  qrCode: string | null;
  pairingCode: string | null;
  lastError: string | null;
}

const AUTH_DIR = path.resolve(process.cwd(), "wa_auth");
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

let sock: WASocket | null = null;
let currentQr: string | null = null;
let currentQrDataUrl: string | null = null;
let currentPairingCode: string | null = null;
let isConnected = false;
let isConnecting = false;
let lastErrorMessage: string | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

export async function initWhatsApp(forceNewSession = false): Promise<void> {
  if (sock && !forceNewSession) {
    logger.info("WhatsApp socket already initialized.");
    return;
  }

  if (forceNewSession && fs.existsSync(AUTH_DIR)) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      logger.info("Cleared previous session directory.");
    } catch (err) {
      logger.error({ err }, "Failed to clear auth directory");
    }
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  isConnecting = true;
  lastErrorMessage = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using Baileys version ${version.join(".")}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }), // keep terminal clean
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      browser: ["Tanabrew Roastery", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQr = qr;
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
          logger.info("New QR Code generated for pairing.");
        } catch (qrErr) {
          logger.error({ qrErr }, "Failed to generate QR Data URL");
        }
      }

      if (connection === "connecting") {
        isConnecting = true;
        isConnected = false;
        logger.info("WhatsApp connecting...");
      }

      if (connection === "open") {
        isConnected = true;
        isConnecting = false;
        currentQr = null;
        currentQrDataUrl = null;
        currentPairingCode = null;
        lastErrorMessage = null;
        logger.info({ user: sock?.user }, "WhatsApp connection OPEN and READY!");
      }

      if (connection === "close") {
        isConnected = false;
        isConnecting = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        lastErrorMessage = (lastDisconnect?.error as Error)?.message || `Disconnected with code: ${statusCode}`;

        logger.warn({ statusCode, shouldReconnect, err: lastDisconnect?.error }, "WhatsApp connection CLOSED");

        if (shouldReconnect) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            logger.info("Reconnecting to WhatsApp...");
            void initWhatsApp();
          }, 5000);
        } else {
          logger.warn("Logged out from WhatsApp. Resetting session...");
          currentQr = null;
          currentQrDataUrl = null;
          currentPairingCode = null;
          if (fs.existsSync(AUTH_DIR)) {
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            } catch {}
          }
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            void initWhatsApp(true);
          }, 3000);
        }
      }
    });
  } catch (error: any) {
    isConnecting = false;
    isConnected = false;
    lastErrorMessage = error?.message || "Failed to initialize WhatsApp socket";
    logger.error({ error }, "Error during initWhatsApp");
  }
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return {
    connected: isConnected,
    connecting: isConnecting,
    user: isConnected && sock?.user ? {
      id: sock.user.id.split(":")[0] || sock.user.id,
      name: sock.user.name || undefined,
    } : null,
    qrCode: currentQrDataUrl,
    pairingCode: currentPairingCode,
    lastError: lastErrorMessage,
  };
}

export async function requestPairingCode(phoneNumber: string): Promise<string> {
  if (!sock) {
    throw new Error("WhatsApp socket is not initialized.");
  }
  if (isConnected) {
    throw new Error("WhatsApp is already connected.");
  }

  const cleanedNumber = phoneNumber.replace(/\D/g, "");
  if (cleanedNumber.length < 10) {
    throw new Error("Nomor telepon tidak valid. Masukkan dengan format internasional (contoh: 628123456789).");
  }

  try {
    const code = await sock.requestPairingCode(cleanedNumber);
    currentPairingCode = code;
    logger.info(`Pairing code requested for ${cleanedNumber}: ${code}`);
    return code;
  } catch (error: any) {
    logger.error({ error }, "Failed to request pairing code");
    throw new Error(error?.message || "Gagal meminta pairing code WhatsApp.");
  }
}

export async function getWhatsAppGroups(): Promise<WhatsAppGroupInfo[]> {
  if (!sock || !isConnected) {
    throw new Error("WhatsApp belum terhubung.");
  }

  try {
    const groupsMap: Record<string, GroupMetadata> = await sock.groupFetchAllParticipating();
    const groupsList: WhatsAppGroupInfo[] = Object.values(groupsMap).map((g) => ({
      id: g.id,
      name: g.subject || "Tanpa Nama",
      participantCount: g.participants?.length || 0,
    }));

    // Sort alphabetically by name
    groupsList.sort((a, b) => a.name.localeCompare(b.name));
    return groupsList;
  } catch (error: any) {
    logger.error({ error }, "Failed to fetch WhatsApp groups");
    throw new Error(error?.message || "Gagal mengambil daftar grup WhatsApp.");
  }
}

export async function sendInvoicePdf(params: {
  groupId: string;
  pdfBuffer: Buffer;
  fileName: string;
  caption: string;
}): Promise<{ messageId: string }> {
  if (!sock || !isConnected) {
    throw new Error("WhatsApp tidak terhubung. Pastikan server WhatsApp aktif.");
  }

  const { groupId, pdfBuffer, fileName, caption } = params;

  if (!groupId || !groupId.includes("@g.us")) {
    throw new Error(`Group ID WhatsApp tidak valid: ${groupId}`);
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error("File PDF kosong.");
  }

  try {
    logger.info({ groupId, fileName, sizeBytes: pdfBuffer.length }, "Sending invoice PDF to WhatsApp group...");

    const sent = await sock.sendMessage(groupId, {
      document: pdfBuffer,
      mimetype: "application/pdf",
      fileName: fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
      caption: caption || `Invoice ${fileName}`,
    });

    const messageId = sent?.key?.id || "msg-" + Date.now();
    logger.info({ messageId, groupId }, "Invoice PDF successfully delivered to WhatsApp group!");
    return { messageId };
  } catch (error: any) {
    logger.error({ error, groupId, fileName }, "Failed to send invoice PDF to WhatsApp group");
    throw new Error(error?.message || "Gagal mengirim dokumen PDF ke grup WhatsApp.");
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    try {
      await sock.logout();
    } catch {}
    try {
      sock.end(undefined);
    } catch {}
    sock = null;
  }

  isConnected = false;
  isConnecting = false;
  currentQr = null;
  currentQrDataUrl = null;
  currentPairingCode = null;

  if (fs.existsSync(AUTH_DIR)) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
  }

  logger.info("WhatsApp session disconnected and auth directory cleared.");
  void initWhatsApp(true);
}
