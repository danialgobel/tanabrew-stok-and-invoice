# Tanabrew Stock & Invoice

Sistem Enterprise Point of Sale (POS), Manajemen Inventaris Multi-Gudang, dan Penagihan Faktur Resmi untuk Tanabrew Roastery.

Aplikasi ini dibangun menggunakan arsitektur hybrid responsif yang mendukung efisiensi operasional harian kasir, pelacakan stok real-time, dan otomasi pelaporan keuangan.

---

## Ringkasan Eksekutif

Tanabrew Stock & Invoice dirancang untuk menjawab kebutuhan operasional toko specialty coffee dengan alur kerja cepat, akurat, dan terstandarisasi. Sistem terhubung langsung ke basis data cloud Google Firebase Firestore dan arsitektur fungsi serverless Vercel, memungkinkan sinkronisasi data antar perangkat secara instan.

### Paradigma Antarmuka Pengguna
* **Antarmuka Kasir Mobile & Tablet**: Optimal untuk perangkat layar sentuh dan terminal kasir portabel, dilengkapi navigasi bawah mengambang (*floating navigation*) dan kalkulasi pecahan uang tunai instan (*quick cash*).
* **Antarmuka Dashboard Desktop**: Optimal untuk workstation manajer dan owner, menghadirkan tata letak 12 kolom, panel pratinjau dokumen terintegrasi (*master-detail split pane*), dan visualisasi metrik performa.

---

## Modul Fungsional Utama

### 1. Point of Sale (POS) Kasir & Pembuat Faktur
* Katalog produk interaktif berbasis touch tiles dengan indikator stok live.
* Tombol pecahan uang tunai cepat untuk efisiensi transaksi tanpa input manual keyboard.
* Penomoran faktur otomatis dengan format standar akuntansi `INV/TNB/YYYY/MM/XXXX`.
* Pembuatan faktur resmi berformat PDF beresolusi tinggi langsung di sisi klien.

### 2. Manajemen Inventaris Multi-Gudang
* Pelacakan inventaris independen antara Gudang Jogja dan Gudang Lombok.
* Otomasi pemotongan stok saat transaksi disimpan (*atomic transaction* untuk mencegah inkonsistensi data).
* Fitur opname stok, mutasi masuk, dan penyesuaian barang hilang/rusak.
* Generator dokumen Price List PDF berukuran A4 full-bleed untuk kebutuhan pemasaran wholesale dan retail.

### 3. Riwayat Transaksi, Laporan, & Rekapitulasi Keuangan
* Pencarian faktur real-time multi-parameter (nomor invoice, nama pelanggan, rentang tanggal, status pembayaran).
* Master-detail split pane di desktop untuk peninjauan faktur tanpa navigasi berulang.
* Integrasi pengiriman dokumen dan pesan faktur via WhatsApp.
* Cetak laporan berkala dan ekspor data ke format CSV/Excel dengan pengurutan deterministik standar akuntansi.

### 4. Etalase Menu Publik & Notifikasi Kunjungan
* Portal publik mandiri (`/pricelist` dan `/menu`) yang dapat diakses pelanggan melalui pemindaian kode QR tanpa memerlukan proses otentikasi.
* Pelacakan kunjungan terintegrasi dengan web push notification ke perangkat operasional tim saat etalase diakses.

### 5. Keamanan & Kontrol Akses Berbasis Peran (RBAC)
* Manajemen hierarki hak akses berjenjang: Owner, Admin, Staff, dan Developer.
* Validasi otentikasi dan sesi terproteksi menggunakan Firebase Authentication.

---

## Tumpukan Teknologi

* **Antarmuka Pengguna**: React 18, TypeScript, Tailwind CSS, Radix UI Primitives, Lucide Icons.
* **Build Tool & Bundler**: Vite, PostCSS.
* **Basis Data & Cloud**: Google Cloud Firestore (NoSQL Document Store), Firebase Authentication, Cloud Storage.
* **Layanan Serverless**: Vercel Serverless Functions (Node.js & TypeScript runtime).
* **Layanan Notifikasi**: OneSignal Web Push SDK dan REST API.
* **Pemrosesan Dokumen Klien**: jsPDF dan html2canvas.
* **Runtime Lintas Platform**: Capacitor (Android dan iOS mobile wrappers).

---

## Panduan Instalasi & Pengembangan Lokal

### Prasyarat Lingkungan
* Node.js versi 18 LTS atau yang lebih baru
* npm (Node Package Manager)

### Langkah Instalasi
1. Kloning repositori:
   ```bash
   git clone https://github.com/danialgobel/tanabrew-stok-and-invoice.git
   cd tanabrew-stok-and-invoice
   ```

2. Pasang dependensi:
   ```bash
   npm install
   ```

3. Konfigurasi variabel lingkungan:
   Salin berkas template lingkungan ke berkas `.env` lokal:
   ```bash
   cp .env.example .env
   ```
   Lengkapi nilai konfigurasi Firebase dan OneSignal sesuai kredensial proyek Anda.

4. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:8080` (atau port yang dialokasikan oleh Vite).

5. Menjalankan pengujian unit:
   ```bash
   npm test -- --run
   ```

6. Menjalankan kompilasi produksi:
   ```bash
   npm run build
   ```

---

## Struktur Direktori Repositori

```text
tanabrew-stok-and-invoice/
├── api/                   Fungsi serverless Vercel (webhook, notifikasi, dispatcher)
├── docs/                  Dokumentasi teknis, PRD, dan skema arsitektur
├── public/                Aset statis dan manifes PWA
├── src/
│   ├── components/        Komponen antarmuka pengguna modular dan dialog
│   ├── config/            Konfigurasi rilis dan parameter sistem
│   ├── context/           Global state providers (Auth, Theme)
│   ├── hooks/             React Custom Hooks
│   ├── lib/               Utilitas bisnis, kalkulasi tanggal, dan integrasi API
│   ├── pages/             Halaman tampilan utama sistem
│   ├── test/              Pengujian unit berbasis Vitest
│   └── types/             Definisi antarmuka TypeScript
├── android/               Proyek native Android (Capacitor)
├── ios/                   Proyek native iOS (Capacitor)
├── capacitor.config.ts    Konfigurasi runtime platform mobile
└── vite.config.ts         Konfigurasi build Vite
```

---

## Dokumentasi Teknis Lanjutan

Dokumentasi arsitektur terperinci tersedia di direktori `docs/`:

* [Product Requirement Document (PRD)](docs/PRD.md)
* [Arsitektur & Desain Sistem](docs/ARCHITECTURE.md)
* [Kamus Basis Data & Skema Firestore](docs/DATABASE_SCHEMA.md)
* [Sistem Notifikasi & Pelacakan Pengunjung](docs/NOTIFICATION_SYSTEM.md)
* [Panduan Deployment & Operasional Jangka Panjang](docs/DEPLOYMENT_AND_OPERATIONS.md)
* [Panduan & Handoff Android APK](docs/TANABREW_ANDROID_HANDOFF.md)
* [Pedoman Pengembangan & SOP Rilis](AGENTS.md)

---

## Pengembang & Pemelihara Sistem

* **Danial Gobel** ([@danialgobel](https://github.com/danialgobel))  
  *Lead Software Engineer & System Architect*  
  Perancang dan pengembang utama arsitektur Tanabrew Stock & Invoice.

* **Tanabrew Engineering**  
  Pengembangan berkelanjutan, optimasi performa kasir, dan otomasi deployment.

---

## Hak Cipta & Lisensi

Hak Cipta (c) Tanabrew Roastery & Danial Gobel. Seluruh hak cipta dilindungi undang-undang.
