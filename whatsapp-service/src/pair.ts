import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import QRCode from "qrcode";

const SESSION_DIR = path.resolve(process.cwd(), "wa_session");
const CONFIG_FILE = path.resolve(process.cwd(), "wa_config.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));

const getChromePath = (): string | undefined => {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
};

async function main() {
  console.clear();
  console.log("========================================================");
  console.log("☕ TANABREW WHATSAPP PAIRING WIZARD (CHROME ENGINE) 🚀");
  console.log("========================================================\n");

  if (fs.existsSync(SESSION_DIR)) {
    const reset = await ask("Sesi WhatsApp lama terdeteksi. Reset dan buat sesi baru? (Y/n): ");
    if (reset.toLowerCase() !== "n") {
      try {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        console.log("🗑️  Folder sesi lama berhasil dibersihkan.\n");
      } catch (e: any) {
        console.warn("Gagal menghapus folder sesi:", e.message);
      }
    }
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  console.log("Pilih metode penautan WhatsApp:");
  console.log("1. Buka Jendela Chrome di Layar Laptop (SANGAT DIREKOMENDASIKAN - 100% Anti-Gagal)");
  console.log("2. Scan QR Code Langsung di Terminal");
  console.log("3. Kode 8 Digit di HP (Pairing Code)");
  const choice = (await ask("\nPilihan Anda [1]: ")) || "1";

  const isVisualChrome = choice === "1";
  const executablePath = getChromePath();

  console.log("\nMemulai engine Google Chrome...");
  if (executablePath) {
    console.log(`Menggunakan browser: ${executablePath}`);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
    puppeteer: {
      headless: !isVisualChrome,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr: string) => {
    if (choice === "2") {
      try {
        const qrTerminal = await QRCode.toString(qr, { type: "terminal", small: true });
        console.log("\nScan QR Code berikut dengan aplikasi WhatsApp di HP Anda:");
        console.log(qrTerminal);
        console.log("(Buka WhatsApp -> Titik Tiga (⋮) -> Perangkat Tertaut -> Tautkan Perangkat)\n");
      } catch (err: any) {
        console.error("Gagal merender QR di terminal:", err.message);
      }
    } else if (choice === "1") {
      console.log("\n🌐 Jendela Google Chrome telah terbuka di layar laptop Anda!");
      console.log("Silakan arahkan kamera WhatsApp di HP Anda ke QR Code yang tampil di layar Chrome.");
      console.log("(WhatsApp -> Setelan / Titik Tiga -> Perangkat Tertaut -> Tautkan Perangkat)\n");
    }
  });

  client.on("authenticated", () => {
    console.log("✅ Berhasil terautentikasi oleh server WhatsApp!");
  });

  client.on("ready", async () => {
    const userPhone = client.info?.wid?.user || "Nomor WhatsApp";
    const userName = client.info?.pushname || "Tanabrew Operator";

    console.log("\n========================================================");
    console.log("🎉 ALHAMDULILLAH! WHATSAPP BERHASIL TERHUBUNG! 🟢");
    console.log("========================================================");
    console.log(`Nomor HP : +${userPhone}`);
    console.log(`Akun     : ${userName}`);
    console.log(`Sesi     : Tersimpan aman dan permanen di wa_session/\n`);

    try {
      console.log("Memuat daftar grup WhatsApp dari akun Anda...");
      const chats = await client.getChats();
      const groups = chats
        .filter((c: any) => c.isGroup)
        .map((g: any) => ({
          id: g.id._serialized,
          name: g.name || "Tanpa Nama",
          count: g.groupMetadata?.participants?.length || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (groups.length === 0) {
        console.log("⚠️  Tidak ada grup yang ditemukan di akun WhatsApp ini.");
      } else {
        console.log("\n📋 DAFTAR GRUP WHATSAPP ANDA:");
        groups.forEach((g, idx) => {
          console.log(`  [${idx + 1}] ${g.name} (${g.count} anggota)`);
        });

        const groupChoiceStr = await ask("\nPilih nomor grup tujuan penerima invoice PDF (contoh: 1): ");
        const groupIdx = parseInt(groupChoiceStr, 10) - 1;

        if (!isNaN(groupIdx) && groups[groupIdx]) {
          const chosen = groups[groupIdx];
          const cfg = {
            target_group_id: chosen.id,
            target_group_name: chosen.name,
            updated_at: new Date().toISOString(),
            linked_phone: userPhone,
          };
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
          console.log(`\n✅ Grup tujuan disimpan: "${chosen.name}"`);
        }
      }
    } catch (gErr: any) {
      console.warn("Catatan: Grup dapat dipilih nanti melalui Web App.", gErr.message);
    }

    console.log("\n========================================================");
    console.log("🚀 PENYIAPAN SELESAI!");
    console.log("Sesi sudah tersimpan. Sekarang jalankan server utama dengan:");
    console.log("    npm run start");
    console.log("Atau gunakan shortcut 'Nyalakan WhatsApp Tanabrew' di Desktop!");
    console.log("========================================================\n");

    try {
      await client.destroy();
    } catch {}
    rl.close();
    process.exit(0);
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ Autentikasi gagal:", msg);
    rl.close();
    process.exit(1);
  });

  console.log("Menginisialisasi WhatsApp Web...");
  await client.initialize();

  if (choice === "3") {
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
    // Tunggu context browser siap
    await new Promise((r) => setTimeout(r, 4000));

    try {
      const code = await client.requestPairingCode(cleaned);
      console.log("\n========================================================");
      console.log("🔑 KODE PAIRING WHATSAPP ANDA:");
      console.log("");
      console.log(`        >>>   ${code.slice(0, 4)}-${code.slice(4)}   <<<        `);
      console.log("");
      console.log("Langkah di HP Anda:");
      console.log("1. Buka WhatsApp di HP Anda");
      console.log("2. Masuk ke: Setelan / Titik Tiga (⋮) -> Perangkat Tertaut");
      console.log("3. Ketuk 'Tautkan Perangkat'");
      console.log("4. Di bawah kamera, ketuk: 'Tautkan dengan nomor telepon saja'");
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
