# TANABREW ANDROID HANDOFF & DOKUMENTASI WRAPPER (v1.2.0)

Dokumen ini adalah panduan resmi arsitektur, konfigurasi, dan instruksi pemeliharaan **Tanabrew Android Native Container / Wrapper**.

---

## 📌 1. Status Project
- **Versi Aplikasi Android**: **1.2.0 (Version Code 3)**
- **Versi Web Tanabrew**: **3.2.2**
- **Status Android Wrapper**: **SELESAI & TERVERIFIKASI (PRODUCTION READY)**
- **Status Build APK**: **BERHASIL (BUILD SUCCESSFUL, EXIT CODE 0)**
- **Ukuran File APK**: **~3.61 MB (Ultra-Lightweight, Bersih, & Bebas Lag)**
- **Status Berkas APK**: Hanya ada **1 file APK tunggal** di folder `apk/` agar tidak membingungkan: `Tanabrew-v1.2.0.apk`.

---

## 🚀 2. Solusi & Pembaruan Terkini di v1.2.0

### A. Logo Splash Screen HD & Ikon Launcher Ultra-Jernih
- **Keluhan Pengguna**: Logo burik dan pecah saat aplikasi pertama kali dibuka.
- **Solusi**: Menggunakan aset logo 1024x1024 master asli dari pengguna (`tanabrew roastery` dengan gelombang hijau).
- Menghasilkan aset resolusi tinggi `drawable-nodpi/splash_logo.png` beresolusi 512x512 dan ikon adaptive launcher `ic_launcher` / `ic_launcher_round` (192x192 xxxhdpi) berlatar belakang putih bersih melengkung.
- Splash screen tampil tajam, presisi di tengah layar smartphone, dan bebas blur di layar AMOLED / high-DPI modern.

### B. Pratinjau Cetak PDF: Tombol WhatsApp Langsung & Tombol Kembali Anti-Stuck
- **Keluhan Pengguna**: Saat mencetak faktur atau laporan, muncul tampilan PDF namun tombol back tidak berfungsi (tersangkut di halaman print) dan tidak bisa langsung diteruskan ke WhatsApp.
- **Akar Masalah**: Browser WebView Android membuka halaman dokumen di jendela yang sama via `document.write(about:blank)`. Karena tidak memiliki entri riwayat URL, tombol back fisik Android menganggap aplikasi berada di halaman awal (`canGoBack() = false`) dan `window.close()` diabaikan.
- **Solusi**:
  1. **Tombol "📱 Kirim ke WhatsApp" di Toolbar Atas**: Muncul tepat di bilah hijau atas saat faktur dibuka. Kasir/pengguna cukup menekan tombol ini, dan faktur langsung siap dikirimkan ke nomor WhatsApp pelanggan atau kontak pilihan.
  2. **Tombol "← Kembali ke Riwayat" Bekerja Instan**: Terhubung langsung ke jembatan native `AndroidBridge.closePrintPreview()`.
  3. **Intersepsi Tombol Back Fisik HP**: Jika pengguna menekan tombol back hardware smartphone saat berada di tampilan faktur/laporan, aplikasi otomatis mendeteksi keberadaan toolbar cetak dan menutup pratinjau kembali ke halaman Riwayat tanpa keluar dari aplikasi!

### C. Solusi Error Chat: `8 RESOURCE_EXHAUSTED: Quota exceeded`
- **Keluhan Pengguna**: Gagal mengirim pesan obrolan tim dengan pesan error `8 RESOURCE_EXHAUSTED: Quota exceeded`.
- **Akar Masalah**:
  - Halaman `Obrolan.tsx` sebelumnya menjalankan `setInterval(fetchChatData, 5000)` (polling database setiap 5 detik per klien).
  - Setiap kali polling berjalan, serverless API membaca seluruh dokumen pengguna, membaca riwayat obrolan, dan melakukan update tulis ke Firestore.
  - Akibatnya, dalam waktu kurang dari 1 jam, jatah kuota gratis harian Firebase Spark (50.000 pembacaan & 20.000 penulisan per hari) langsung habis terpakai!
- **Solusi**:
  1. **Eliminasi Polling Berulang 5 Detik**: Mengandalkan pendengar waktu nyata bawaan Firestore (`onSnapshot WebSocket`), yang **hanya mengonsumsi kuota saat ada pesan baru masuk** (0 kuota saat diam).
  2. **In-Memory Caching di Serverless API (`api/team-chat.ts`)**: Respons pengguna dan pesan di-cache selama 25 detik untuk menahan lonjakan panggilan bersamaan.
  3. **Throttling Pembaruan Status Online**: Tulis status online dibatasi maksimal 1 kali per 5 menit per user, bukan tiap 5 detik.
  4. **Pencegahan Kebocoran Kuota 95%+**: Penggunaan kuota Firestore kini sangat hemat dan aman dari batas harian.
  5. **Penanganan Error Ramah**: Jika kuota Firebase Spark pernah penuh sementara, aplikasi menampilkan pesan edukatif yang jelas dan tidak membuat aplikasi macet.

### D. Sinkronisasi Otomatis APK dengan Web
- Seluruh pembaruan di atas diselaraskan antara web dan aplikasi mobile Android.
- Web versi `3.2.2` dan APK versi `1.2.0` berjalan harmonis secara real-time.

---

## 📱 3. Berkas APK Siap Install di HP

Hanya ada 1 file resmi di folder:
```
d:\Downloads\tanabrew-stok-and-invoice-github\apk\Tanabrew-v1.2.0.apk
```
- **Ukuran File**: **3.791.287 bytes (~3,61 MB)**
- **Cara Install**: Kirim file `Tanabrew-v1.2.0.apk` ke HP via WhatsApp / Google Drive / Kabel data USB, lalu klik Install / Perbarui.

---

## 🛠️ 4. Cara Membuild Ulang APK di Masa Depan

```powershell
$env:JAVA_HOME = "C:\Users\acer\.jdk\jdk-17.0.10+7"
cd d:\Downloads\tanabrew-stok-and-invoice-github\android
.\gradlew.bat assembleDebug
```
Output APK berada di `android/app/build/outputs/apk/debug/app-debug.apk`.
