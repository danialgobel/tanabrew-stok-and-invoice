# Pedoman Pengembangan AI Agent & Arsitektur Tanabrew (Agent Guidelines)

Dokumen ini adalah **panduan wajib (*mandatory SOP*)** bagi seluruh AI Assistant / AI Coding Agent dan Developer yang bekerja pada repositori **Tanabrew Stok & Invoice**.

### 📚 Direktori Modul Dokumentasi Teknis
Untuk rincian arsitektur mendalam, silakan rujuk modul dokumentasi berikut:
* [Product Requirement Document (PRD)](docs/PRD.md)
* [Arsitektur & Desain Sistem](docs/ARCHITECTURE.md)
* [Kamus Basis Data & Skema Firestore](docs/DATABASE_SCHEMA.md)
* [Sistem Notifikasi & Pelacakan Pengunjung](docs/NOTIFICATION_SYSTEM.md)
* [Panduan Deployment & Operasional Jangka Panjang](docs/DEPLOYMENT_AND_OPERATIONS.md)
* [Aturan Kestabilan Kode & Anti-Crash](.agents/rules/code-stability.md)
* [Aturan Kueri & Optimasi Kuota Firestore](.agents/rules/firestore-best-practices.md)
* [Standar & SOP Multi-Platform (Web, Android, iOS)](.agents/rules/cross-platform-standards.md)
* [Panduan & Handoff Android APK](docs/TANABREW_ANDROID_HANDOFF.md)

---

## 🏛️ 1. Arsitektur & Teknologi Proyek

* **Core Framework**: React 18, Vite, TypeScript, React Router v6.
* **Database & Cloud**: Google Firebase (Firestore Database, Firebase Authentication, Server Timestamp).
* **State & Query**: TanStack React Query + React Custom Hooks & Context (`AuthContext.tsx`, `useProducts.ts`).
* **Styling & Design System**: Tailwind CSS + Vanilla CSS Tokens (`src/index.css`), Shadcn UI Primitives, Lucide Icons, Fisika Pegas Spring Bezier (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **Responsive Paradigm**:
  - **Smartphone & Tablet (< 1024px)**: *Floating Glassmorphic Bottom Navigation Bar* melayang (`BottomNav.tsx`), gesture tarik-layar muat ulang (`PullToRefresh.tsx`), dan dialog drawer layar sentuh.
  - **Desktop (≥ 1024px — Opsi 01 Enhanced)**: *Permanent Collapsible Left Sidebar* (`DesktopSidebar.tsx`), Multi-Kolom 12-Grid di Beranda, Split-Screen POS Touch Tiles di Cetak Invoice, dan Master-Detail Split Pane di Riwayat Transaksi.
* **Perlindungan Crash Global**: Aplikasi dibungkus oleh `<ErrorBoundary>` di `src/App.tsx` untuk mencegah *blank white screen* jika terjadi kendala data sementara.

---

## 🚨 2. ATURAN UTAMA: Manajemen Rilis & Pop-up Update (Wajib!)

Setiap kali Anda melakukan pembaruan, menambahkan fitur baru, mengubah tampilan UI, atau memperbaiki bug:

### A. Wajib Memperbarui Konfigurasi Rilis (`src/config/appRelease.ts`)
1. **Naikkan Nomor Versi (`version` & `versionLabel`)**:
   - Gunakan Semantic Versioning (contoh: `3.0.0` ➔ `3.0.1` untuk perbaikan bug / tweak, atau `3.1.0` untuk fitur baru).
2. **Perbarui Tanggal Rilis (`releaseDate`)**:
   - Tulis tanggal lokal Indonesia saat update dilakukan (contoh: `"2 September 2026"`).
3. **Perbarui Daftar Catatan Pembaruan (`highlights`) — Khusus Pembaruan Hari Ini (Per Hari)**:
   - Tuliskan **hanya poin-poin pembaruan yang dikerjakan pada hari/rilis tersebut** secara jelas, singkat, dan padat per item.
   - Pindahkan poin-poin rilis versi sebelumnya ke array `RELEASE_HISTORY` agar modal pop-up tetap fokus, ringkas, dan tidak menumpuk riwayat hari-hari yang lalu.
   - Pop-up modal sudah memiliki wadah scroll vertikal yang halus (*smooth scrolling*), sehingga seluruh poin pembaruan hari tersebut dapat dibaca dengan nyaman tanpa terpotong.
   - Gunakan badge yang sesuai:
     - `"Baru"` (untuk fitur / tampilan baru)
     - `"Peningkatan"` (untuk optimalisasi UI & performa)
     - `"Perbaikan"` (untuk bugfix & pembenahan error)
     - `"Fitur"` (untuk kapabilitas fungsional baru)

### B. Perilaku Sistem Pop-up Update (`AppUpdateAnnouncementModal.tsx`)
1. **Satu Modal Tunggal (Anti-Numpuk)**: Walaupun terjadi beberapa update berturut-turut, sistem hanya akan menampilkan 1 modal pop-up versi terbaru (`CURRENT_RELEASE`).
2. **Berlaku untuk Semua Role & Device**: Muncul bagi `Owner`, `Admin`, `Staff`, dan `Developer` di semua jenis perangkat.
3. **Mencegah Pop-up Berulang**: Menggunakan `localStorage.getItem("tanabrew_seen_app_version")`. Setelah ditekan *"Mengerti & Mulai Gunakan"*, pop-up tidak akan muncul lagi sampai versi berikutnya dinaikkan.
4. **Tersinkronisasi dengan Halaman Akun**: Teks versi di Halaman Akun ([src/pages/Akun.tsx](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/pages/Akun.tsx)) otomatis membaca dari `CURRENT_RELEASE.versionLabel` dan dapat diklik untuk membuka changelog kapan saja.

---

## 🧭 3. Panduan Modul & Alur Kerja Halaman

### 1. `Beranda.tsx` (Dashboard & Analitik)
- **Tata Letak Desktop 12 Kolom**: Sisi kiri (8 kolom) menampung 4 Kartu Stok Gudang, Grafik Omzet Area 7 Hari, dan Tabel Inventaris Live. Sisi kanan (4 kolom) menampung Kartu Pengguna, Kapsul Ticker Aktivitas, Ringkasan Transaksi Hari Ini, dan Perintah Owner.
- **Kapsul Ticker Aktivitas**: Kapsul 1 baris ramping dengan rotasi otomatis 2 detik. Tombol silang (✕) menyimpan status tutup secara persisten di `localStorage` & Firestore sehingga tidak muncul kembali saat refresh.
- **Pop-up Interaktif**: Setiap kartu metrik dapat diklik untuk membuka modal pop-up detail, grafik omzet, dan rincian transaksi.

### 2. `CetakInvoice.tsx` (POS Kasir & Pembuat Faktur)
- **Katalog Produk Touch Tiles POS (Square Style)**: Menampilkan biji kopi dalam kartu visual dengan badge stok live Jogja/Lombok, pencarian real-time, filter kategori instan, dan 1-tap tambah ke keranjang kasir.
- **Dukungan Dua Mode Tampilan**: Kasir dapat beralih antara *Grid Katalog POS* atau *Form Baris Manual*.
- **Tombol Pecahan Uang Cepat (*Quick Cash*)**: Tombol instan `Uang Pas`, `50k`, `100k`, `200k`, `500k` di panel kanan untuk menghitung kembalian otomatis tanpa ketik manual di keyboard.
- **Penomoran Otomatis**: Format standar `INV/TNB/YYYY/MM/XXXX` terintegrasi dengan `src/lib/dateUtils.ts` dan `src/lib/invoiceNumber.ts`.

### 3. `Riwayat.tsx` (Master-Detail Split Pane & Laporan)
- **Master-Detail Split Pane di Layar Desktop**: Sisi kiri (5 kolom) memuat pencarian, filter tanggal/status, dan daftar kartu invoice. Sisi kanan (7 kolom sticky) menampilkan pratinjau dokumen faktur resmi secara seketika.
- **Aksi Dokumen Lengkap**: Tombol *Cetak Ulang PDF*, *Kirim WhatsApp*, *Tandai Lunas*, *Edit*, dan *Hapus Invoice* dapat diakses langsung tanpa pop-up modal bertumpuk.

### 4. `UpdateStok.tsx` (Inventaris Multi-Gudang & Price List PDF)
- Melacak stok independen untuk **Gudang Jogja** dan **Gudang Lombok**.
- Modul pencetakan Price List PDF A4 Full-Bleed kualitas cetak tinggi (`src/lib/pricelistPrint.ts`) dengan pemecahan nama produk otomatis (*auto-splitting*) dan mode pengisian manual.

### 5. `GodMode.tsx` (Dev Center & Super Admin)
- Dikhususkan bagi role `owner` dan `webdev`.
- Menampilkan terminal log audit, database explorer, tools backup/restore, dan integrasi WhatsApp client.

### 6. `PriceListPublic.tsx` (`/pricelist` & `/menu`)
- Halaman menu publik untuk scan QR / ID Card pelanggan tanpa perlu autentikasi/login.

---

## 🛡️ 4. Aturan Stabilitas Kode & Mencegah Error Layar Putih (Blank Screen)

1. **Gunakan Safe Optional Chaining**: Selalu gunakan `userProfile?.role`, `invoice.items?.map(...)`, dan nilai fallback default (`|| []`, `|| 0`, `|| ""`).
2. **Hindari `return null` pada Halaman Utama**: Jika otorisasi tidak terpenuhi, render komponen notifikasi ramah *"Akses Terbatas"* dengan tombol *"Kembali ke Beranda"*.
3. **Penyelarasan Date Parsing**: Gunakan selalu fungsi pembantu dari `src/lib/dateUtils.ts` (`formatInvoiceDate`, `toValidDateInputValue`, dll.) untuk memproses tanggal Firestore maupun string.
4. **Verifikasi Import React Hooks**: Pastikan `useState`, `useEffect`, `useMemo`, `useCallback`, dan `useRef` selalu diimpor dengan benar di baris teratas file komponen.

---

## 🏗️ 5. Standar Pengujian Sebelum Commit & Push

Sebelum melakukan commit dan push ke GitHub:
1. **Jalankan Pengujian Unit**:
   ```bash
   npm test -- --run
   ```
2. **Jalankan Pengujian Build Produksi**:
   ```bash
   npm run build
   ```
3. **Pastikan 0 Error**: Pastikan kedua perintah di atas selesai dengan status `exit code 0`.
4. **Patuhi Instruksi User**: Jika user meminta untuk mencoba di server lokal terlebih dahulu (*trial local*), jangan lakukan `git push` sampai user memberikan instruksi tegas untuk push.

---

## 📱 6. SOP & Standar Pengembangan Multi-Platform (Web PWA, Android, iOS)

Repositori Tanabrew mengelola 3 platform sekaligus (*Web/Web PWA, Android App, dan iOS App*) dari satu basis kode inti (*Single Source of Truth*). Setiap developer dan AI Coding Agent wajib mematuhi aturan berikut agar pembaruan di salah satu platform **tidak pernah merusak platform lainnya**:

### A. Isolasi Modul Platform (*Platform Adapter Pattern*)
1. **Dilarang Keras** mencampur logika percabangan native yang rumit langsung di dalam berkas UI (seperti `Beranda.tsx`, `CetakInvoice.tsx`, `Riwayat.tsx`).
2. Seluruh logika khusus platform wajib dibungkus di modul `src/lib/` (misal: `printUtils.ts`, `onesignal.ts`).
3. Gunakan selalu deteksi resmi Capacitor:
   ```typescript
   import { Capacitor } from "@capacitor/core";

   const isNative = Capacitor.isNativePlatform();
   const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
   ```
4. **Karantina Kode**: Jika memodifikasi fitur khusus iOS, hanya ubah blok kondisi iOS. Kode Web dan Android harus tetap murni dan terlindungi.

### B. Prinsip *Graceful Fallback* (Anti-Crash Lintas Platform)
1. Fitur native (seperti printer thermal, kamera, notifikasi, atau AirPrint) wajib memiliki penanganan cadangan (*fallback*) ke standar web jika gagal dipanggil di WebView.
2. Jika fungsi native memicu *rejection* atau *popup blocker*, sistem harus mengalihkan secara halus (misal: pencetakan via *hidden iframe* atau unduhan PDF langsung) tanpa memunculkan layar putih (*blank screen*) atau tombol membeku.

### C. Alur Kerja Rilis Bertahap (*Web PWA First, Then Native Sync*)
1. **Tahap 1 (Web & Web PWA)**: Fitur baru atau perbaikan tampilan wajib diuji dan dipastikan 100% stabil di Web/PWA terlebih dahulu.
2. **Tahap 2 (Validasi Build)**: Jalankan `npm test -- --run` dan `npm run build` hingga exit code 0.
3. **Tahap 3 (Sinkronisasi Proyek Native)**:
   ```bash
   npx cap sync
   ```
4. **Tahap 4 (Pengujian Khusus Native)**: Uji coba di Android/iOS hanya diperlukan jika perubahan menyentuh modul perangkat keras/native tertentu.

### D. Disiplin Kebersihan Kode (*Clean Architecture*)
1. Hindari membuat berkas komponen raksasa (*God Component* > 800 baris). Modal atau kartu mandiri baru wajib dibuat sebagai file terpisah di `src/components/`.
2. Jangan melakukan perombakan massal (*massive refactor*) pada sistem kasir dan stok yang sedang berjalan stabil di toko. Lakukan perapian secara bertahap dan terukur.
