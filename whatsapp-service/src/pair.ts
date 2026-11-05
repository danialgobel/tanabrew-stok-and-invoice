import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type ConnectionState,
  type GroupMetadata,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const AUTH_DIR = path.resolve(process.cwd(), "wa_auth");
const CONFIG_FILE = path.resolve(process.cwd(), "wa_config.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));

async function main() {
  console.clear();
  console.log("========================================================");
  console.log("☕ TANABREW WHATSAPP PAIRING WIZARD (CLI) 🚀");
  console.log("========================================================\n");

  if (fs.existsSync(AUTH_DIR)) {
    const reset = await ask("Sesi WhatsApp lama terdeteksi. Reset dan buat sesi baru? (Y/n): ");
    if (reset.toLowerCase() !== "n") {
      try {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        console.log("🗑️  Folder sesi lama berhasil dibersihkan.\n");
      } catch (e: any) {
        console.warn("Gagal menghapus folder sesi:", e.message);
      }
    }
  }

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  console.log("Pilih metode penautan WhatsApp:");
  console.log("1. Kode 8 Digit di HP (Sangat Direkomendasikan, 100% Bebas Kamera)");
  console.log("2. Scan QR Code Langsung di Layar Terminal");
  const choice = (await ask("\nPilihan Anda [1]: ")) || "1";

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`\nMenghubungkan ke WhatsApp gateway (Baileys v${version.join(".")}, isLatest: ${isLatest})...`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    browser: Browsers.macOS("Desktop"),
  });

  sock.ev.on("creds.update", saveCreds);

  let pairingCodeRequested = false;

  sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && choice === "2") {
      try {
        const qrTerminal = await QRCode.toString(qr, { type: "terminal", small: true });
        console.log("\nScan QR Code berikut dengan aplikasi WhatsApp di HP Anda:");
        console.log(qrTerminal);
        console.log("(Buka WhatsApp -> Titik Tiga (⋮) -> Perangkat Tertaut -> Tautkan Perangkat)\n");
      } catch (err: any) {
        console.error("Gagal merender QR di terminal:", err.message);
      }
    }

    if (connection === "open") {
      const userPhone = sock.user?.id ? sock.user.id.split(":")[0] : "Nomor WhatsApp";
      const userName = sock.user?.name || "Tanabrew Operator";

      console.log("\n========================================================");
      console.log("🎉 ALHAMDULILLAH! WHATSAPP BERHASIL TERHUBUNG! 🟢");
      console.log("========================================================");
      console.log(`Nomor HP : +${userPhone}`);
      console.log(`Akun     : ${userName}`);
      console.log(`Sesi     : Tersimpan aman di folder wa_auth/\n`);

      try {
        console.log("Memuat daftar grup WhatsApp dari akun Anda...");
        const groupsMap: Record<string, GroupMetadata> = await sock.groupFetchAllParticipating();
        const groups = Object.values(groupsMap).sort((a, b) => (a.subject || "").localeCompare(b.subject || ""));

        if (groups.length === 0) {
          console.log("⚠️  Tidak ada grup yang ditemukan di akun WhatsApp ini.");
        } else {
          console.log("\n📋 DAFTAR GRUP WHATSAPP ANDA:");
          groups.forEach((g, idx) => {
            console.log(`  [${idx + 1}] ${g.subject} (${g.participants?.length || 0} anggota)`);
          });

          const groupChoiceStr = await ask("\nPilih nomor grup tujuan penerima invoice PDF (contoh: 1): ");
          const groupIdx = parseInt(groupChoiceStr, 10) - 1;

          if (!isNaN(groupIdx) && groups[groupIdx]) {
            const chosen = groups[groupIdx];
            const cfg = {
              target_group_id: chosen.id,
              target_group_name: chosen.subject,
              updated_at: new Date().toISOString(),
              linked_phone: userPhone,
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
            console.log(`\n✅ Grup tujuan disimpan: "${chosen.subject}"`);
          }
        }
      } catch (gErr: any) {
        console.warn("Catatan: Grup dapat dipilih nanti melalui Web App.", gErr.message);
      }

      console.log("\n========================================================");
      console.log("🚀 PENYIAPAN SELESAI!");
      console.log("Sekarang jalankan server utama dengan:");
      console.log("    npm run start");
      console.log("========================================================\n");
      rl.close();
      process.exit(0);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("\n❌ Sesi dikeluarkan dari WhatsApp di HP. Silakan jalankan pairing ulang.");
        rl.close();
        process.exit(1);
      }
    }
  });

  if (choice === "1") {
    let rawPhone = await ask("\nMasukkan Nomor WhatsApp Anda (contoh: 085746385424 atau 6285746385424): ");
    let cleaned = rawPhone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "62" + cleaned.slice(1);
    } else if (cleaned.startsWith("8")) {
      cleaned = "62" + cleaned;
    }

    if (cleaned.length < 10) {
      console.error("❌ Nomor telepon tidak valid. Minimal 10 digit.");
      rl.close();
      process.exit(1);
    }

    console.log(`\nMeminta kode pairing resmi dari WhatsApp untuk nomor: +${cleaned}...`);
    // Wait 2.5s for WebSocket handshake to be ready
    await new Promise((r) => setTimeout(r, 2500));

    try {
      const code = await sock.requestPairingCode(cleaned);
      pairingCodeRequested = true;

      console.log("\n========================================================");
      console.log("🔑 KODE PAIRING WHATSAPP ANDA:");
      console.log("");
      console.log(`        >>>   ${code.slice(0, 4)}-${code.slice(4)}   <<<        `);
      console.log("");
      console.log("Langkah di HP Anda:");
      console.log("1. Buka WhatsApp di HP Anda");
      console.log("2. Masuk ke: Setelan / Titik Tiga (⋮) -> Perangkat Tertaut");
      console.log("3. Ketuk 'Tautkan Perangkat'");
      console.log("4. Di bawah layar kamera, ketuk: 'Tautkan dengan nomor telepon saja'");
      console.log(`5. Masukkan kode 8 karakter di atas: ${code}`);
      console.log("========================================================");
      console.log("Menunggu Anda memasukkan kode di HP... (jangan tutup terminal)");
    } catch (codeErr: any) {
      console.error("\n❌ Gagal meminta kode pairing:", codeErr.message);
      rl.close();
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
