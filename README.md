# Tanabrew Stock & Invoice - Dokumentasi Lengkap & AI Checkpoint

Aplikasi **Tanabrew Stock & Invoice** adalah platform manajemen inventaris, kasir (POS), pencatatan pendapatan/pengeluaran, dan penagihan (invoice) yang terintegrasi langsung dengan database cloud (Google Firebase Firestore) dan sinkronisasi otomatis ke Google Sheets (Spreadsheet Service).

Aplikasi ini didesain sebagai Progressive Web App (PWA) agar dapat di-install sebagai aplikasi shortcut pada ponsel maupun desktop staff dengan navigasi ala aplikasi mobile native.

---

## 🚀 AI Agent Context (Status Checkpoint Terakhir)

> [!IMPORTANT]
> **Status Fitur Price List & PWA Cache**: Fitur Price List PDF berkualitas tinggi telah **selesai 100%** dan terintegrasi dengan data stok produk. Sistem caching Vercel juga telah dioptimalkan agar shortcut aplikasi perangkat staff otomatis memperbarui konten saat dideploy.

### Fitur Terkini yang Diselesaikan & Sempurna:
1. **Modul Cetak Price List PDF (`src/lib/pricelistPrint.ts`)**:
   - Layout berukuran A4 beresolusi tinggi, berbasis vektor tajam (teks dapat diblok) menggunakan pencetakan `window.print()`.
   - Menggunakan logo resmi lengkap `/logo-pricelist.png` (waves `SSS`, `TM`, divider `|`, dan teks `tanabrew roastery` orisinal) dengan koreksi margin putih bawaan gambar via CSS negative-margin.
   - Pola latar belakang menggunakan siluet daun palem/monstera SVG dengan lekukan jari yang dalam (palmate leaf) pudar (`#f6faf7`) di atas warna mint (`#edf4f0`).
   - Fitur full-bleed (tanpa batas margin putih pinggiran kertas) dengan setelan `@page { margin: 0; }`.
   - Huruf *Tanabrew Roastery Trademark* bergaya cursive menggunakan Google Font `Dancing Script`.
   - Hierarki ukuran font yang tegas: Kriteria Kategori (`19px` bold) jauh lebih besar daripada Nama Produk (`13.5px` bold) dan Harga (`13.5px` semi-bold).

2. **Panel Konfigurasi di Halaman Update Stok (`src/pages/UpdateStok.tsx`)**:
   - Tombol **Cetak Price List** hijau emerald di samping tombol cetak laporan stok.
   - Modal 2 langkah:
     - **Langkah 1**: Filter lokasi stok (Jogja / Lombok / Semua). Produk dengan stok = 0 di lokasi terpilih disembunyikan otomatis.
     - **Langkah 2**: Manajemen kriteria (tambah/hapus kategori) dan penyusunan produk.
   - Menghubungkan produk dari database secara instan via select dropdown, lengkap dengan **Auto-Splitting** (memecah nama produk database berformat `Nama - Deskripsi` menjadi kolom nama dan kolom deskripsi terpisah).
   - Tombol **`+ Manual`**: Memungkinkan pengisian manual (Nama, Harga, dan Deskripsi secara langsung) untuk barang kustom yang tidak ada di database.
   - Autosave ke `localStorage` (key: `tanabrew_pricelist_config`) agar data susunan tidak hilang ketika browser dimuat ulang.

3. **Penyelesaian Caching Aplikasi Shortcut/PWA (`vercel.json`)**:
   - Menyetel header `Cache-Control: public, max-age=0, must-revalidate` untuk file `index.html` dan `manifest.webmanifest`.
   - **Tujuan**: Memaksa shortcut di HP/device staff untuk selalu mengecek server Vercel ketika dibuka, sehingga setiap pembaruan aplikasi langsung ter-update otomatis pada perangkat mereka tanpa tersangkut cache lama.
   - File statis `/assets/*` tetap di-cache setahun (`max-age=31536000, immutable`) demi kecepatan muat yang optimal.

---

## 🛠️ Modul & Fitur Aplikasi Secara Keseluruhan

Aplikasi ini mencakup modul-modul bisnis utama berikut:

### 1. Sistem Autentikasi & Hak Akses (`src/context/AuthContext.tsx`)
- Menggunakan Firebase Authentication untuk login, registrasi, dan kelola sesi.
- Menyediakan Role-Based Access Control (RBAC) dengan hak akses:
  - **Owner/Admin (GodMode)**: Hak akses penuh ke grafik pendapatan, pengeluaran, hapus data transaksi, dan konfigurasi sistem.
  - **Staff/Kasir**: Hak akses terbatas untuk melakukan transaksi kasir, update mutasi stok, cetak invoice, dan mencatat pengeluaran/pendapatan operasional harian.

### 2. Dashboard Analitik & Beranda (`src/pages/Beranda.tsx`)
- Menampilkan total penjualan harian, mingguan, bulanan, dan tahunan.
- Menampilkan grafik interaktif pendapatan vs pengeluaran.
- Log aktivitas terbaru (Activity Log) yang melacak tindakan user (misal: "Staff A mengubah stok Jogja Kopi Gayo menjadi 10").
- Widget peringatan stok kritis/hampir habis (Low Stock Warning).

### 3. POS Kasir & Transaksi (`src/pages/Riwayat.tsx`, `CetakInvoice.tsx`)
- Pencatatan transaksi penjualan secara real-time.
- Pembuatan nomor invoice otomatis menggunakan kode unik berdasarkan tahun/bulan/nomor urut.
- Cetak Invoice dalam format struk belanja yang ramah printer termal maupun cetak PDF standar.
- Menyimpan status pembayaran (LUNAS / PIUTANG) dan metode pembayaran (Tunai, Transfer, QRIS).

### 4. Pencatatan Keuangan (`src/pages/Pendapatan.tsx`, `Pengeluaran.tsx`)
- **Pendapatan**: Mencatat pemasukan di luar transaksi utama (misalnya penjualan sisa ampas kopi, merchandise, dll).
- **Pengeluaran**: Mencatat biaya operasional (seperti pembelian cup plastik, biaya listrik, sewa ruko, gaji karyawan).
- Data keuangan ini langsung terintegrasi dan siap disinkronisasikan ke Google Sheets.

### 5. Manajemen Inventaris Multilokasi (`src/pages/UpdateStok.tsx`)
- Melacak jumlah stok barang di dua gudang/outlet fisik terpisah: **Jogja** dan **Lombok**.
- Fitur mutasi stok cepat (tambah stok masuk, kurangi stok rusak, penyesuaian opname).
- Pencetakan Lembar Laporan Stok fisik untuk audit manual.
- Generator Price List PDF yang dinamis (fitur baru).

### 6. Sinkronisasi Google Sheets (`src/lib/spreadsheet/`)
- Modul otomatisasi sinkronisasi yang mem-posting data transaksi kasir, pendapatan, dan pengeluaran ke baris-baris Google Sheets melalui API endpoint (Google Apps Script).
- **Retry Mechanism**: Jika terjadi kegagalan jaringan, sistem akan mencoba mem-posting ulang secara berkala.
- **Sync Logging**: Menampilkan daftar transaksi mana yang sukses disinkronkan, mana yang gagal, dan memberikan tombol untuk memicu sinkronisasi manual ulang.

### 7. PWA Mobile UI & Push Notification (`src/lib/onesignal.ts`)
- Navigasi mobile-friendly dengan bar navigasi bawah (`BottomNav.tsx`) yang lengket di layar handphone.
- Fitur geser ke bawah untuk menyegarkan data (`PullToRefresh.tsx`) yang meniru pengalaman aplikasi mobile native.
- OneSignal SDK terintegrasi untuk mengirimkan notifikasi push ketika stok habis atau terdapat pengumuman penting bagi staff.

---

## 📂 Struktur Direktori Proyek

```bash
├── public/                 # File statis (favicon, manifest, robots, logo-pricelist.png, dll)
├── src/
│   ├── components/         # Reusable UI Components
│   │   ├── ui/             # Shadcn UI primitives (Button, Dialog, Select, Input, dll)
│   │   ├── BottomNav.tsx   # Bar navigasi bawah untuk perangkat mobile
│   │   ├── ConfirmDialog.tsx# Dialog konfirmasi aksi berbahaya (seperti hapus data)
│   │   └── PullToRefresh.tsx# Gesture tarik-layar untuk memuat ulang data
│   ├── context/
│   │   └── AuthContext.tsx # Provider autentikasi Firebase
│   ├── hooks/              # Custom React Hooks
│   ├── lib/                # Layanan & Utilitas Helper
│   │   ├── spreadsheet/    # Google Sheets Integration Services & Unit Tests
│   │   ├── firebase.ts     # Inisialisasi SDK Firebase Firestore & Auth
│   │   ├── pricelistPrint.ts# [BARU] Template desain cetak Price List PDF A4
│   │   ├── reportPrint.ts  # Template desain cetak Laporan Stok & Mutasi
│   │   └── onesignal.ts    # Integrasi notifikasi push OneSignal
│   ├── pages/              # Halaman Tampilan (Screens)
│   │   ├── Beranda.tsx     # Dashboard Grafik & Peringatan Stok
│   │   ├── Riwayat.tsx     # POS Kasir & Transaksi Log
│   │   ├── UpdateStok.tsx  # Halaman Stok & Generator Price List
│   │   ├── Pendapatan.tsx  # Input pendapatan luar kasir
│   │   ├── Pengeluaran.tsx # Input biaya operasional
│   │   ├── Spreadsheet.tsx # Halaman monitoring log sinkronisasi Google Sheets
│   │   └── GodMode.tsx     # Pengaturan Developer & Reset Database
│   ├── types/              # Type definition TypeScript
│   ├── App.tsx             # Pengaturan Router Rute & Proteksi Halaman
│   └── main.tsx            # React DOM entrypoint
├── index.html              # Template HTML utama (Preconnect Google Fonts)
├── vercel.json             # Konfigurasi rewrite & anti-cache header Vercel
├── tailwind.config.ts      # Konfigurasi desain & token warna Tailwind CSS
└── package.json            # Informasi dependency & script build/test
```

---

## 💻 Cara Menjalankan Proyek Secara Lokal

### Prasyarat:
Pastikan Anda telah menginstal Node.js (versi 18+) di komputer Anda.

1. **Clone repository**:
   ```bash
   git clone https://github.com/danialgobel/tanabrew-stok-and-invoice.git
   cd tanabrew-stok-and-invoice
   ```

2. **Instal dependency**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variables**:
   Buat file `.env.local` atau isi `.env` di root folder dengan kredensial Firebase Anda:
   ```env
   VITE_FIREBASE_API_KEY=xxx
   VITE_FIREBASE_AUTH_DOMAIN=xxx
   VITE_FIREBASE_PROJECT_ID=xxx
   VITE_FIREBASE_STORAGE_BUCKET=xxx
   VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
   VITE_FIREBASE_APP_ID=xxx
   ```

4. **Jalankan server development**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:8080/](http://localhost:8080/).

5. **Lakukan Build Produksi (Opsional)**:
   Untuk memverifikasi bahwa kode bebas dari error kompilasi sebelum di-deploy:
   ```bash
   npm run build:dev
   ```

---

## 🧪 Pengujian Unit (Unit Testing)

Proyek ini dilengkapi dengan suite pengujian otomatis menggunakan **Vitest** untuk memverifikasi fungsionalitas logika sinkronisasi keuangan ke Google Sheets.

Jalankan perintah berikut untuk menjalankan seluruh pengujian:
```bash
npm run test
```
*Total saat ini terdapat 22 pengujian di 6 berkas tes yang memvalidasi ketahanan API, retries, pemetaan transaksi, dan pemulihan kegagalan koneksi.*

---

## ⚠️ Panduan Keamanan untuk AI Agent Pengembang Berikutnya
1. **Isolasi Fitur**: Jangan mengubah struktur data dan fungsi internal di `src/lib/spreadsheet/` dan `src/pages/CetakInvoice.tsx` kecuali diminta khusus oleh pengguna, karena bagian tersebut sudah stabil dan memiliki cakupan tes unit.
2. **PWA & Caching**: Aturan header di `vercel.json` sangat krusial agar aplikasi shortcut staff ter-update otomatis. Jangan menghapus blok `"headers"` di file tersebut.
3. **Format CSS Cetak**: Layout cetak di `pricelistPrint.ts` menggunakan style khusus `@media print` dan ukuran A4. Perubahan layout harus dites menggunakan print preview browser untuk menjamin estetika tetap presisi.
