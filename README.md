# Tanabrew Stock & Invoice - Dokumentasi Lengkap & AI Checkpoint

Aplikasi **Tanabrew Stock & Invoice** adalah platform manajemen inventaris biji kopi specialty, kasir (POS), dan penagihan (invoice) terintegrasi yang terhubung langsung dengan Google Firebase Cloud Firestore.

Aplikasi ini mengusung arsitektur **Dual-Responsive**:
1. **Smartphone & Tablet (< 1024px)**: Berperan sebagai Progressive Web App (PWA) dengan *Floating Glassmorphic Bottom Navigation Bar*, gestur tarik muat ulang (*Pull-to-Refresh*), dan dialog drawer sentuh.
2. **Desktop & Laptop (≥ 1024px — v3.0.0)**: Berperan sebagai SaaS POS Dashboard dengan *Permanent Collapsible Left Sidebar Navigation*, Multi-Kolom 12-Grid di Beranda, Katalog Kartu Visual POS (*Square Style Touch Tiles*) di Cetak Invoice, dan Master-Detail Split Pane di Riwayat Transaksi.

---

## 🚀 AI Agent Context (Status Checkpoint v3.0.0)

> [!IMPORTANT]
> - **Arsitektur Rilis Wajib (`src/config/appRelease.ts`)**: Setiap pembaruan kode WAJIB menaikkan nomor versi dan memperbarui `highlights` di file ini. Sistem modal pop-up `AppUpdateAnnouncementModal.tsx` akan otomatis menampilkan 1 jendela pembaruan tunggal untuk seluruh pengguna dan role.
> - **Penanganan Tanggal & Akurasi Pendapatan (`src/lib/dateUtils.ts`)**: Modul ini adalah *single source of truth* untuk seluruh parsing, penomoran invoice, dan kalkulasi pendapatan bulanan & harian.
> - **Perlindungan Crash Global (`src/components/ErrorBoundary.tsx`)**: Seluruh aplikasi dibungkus oleh ErrorBoundary di `src/App.tsx` agar tidak pernah terjadi *blank white screen*.

### Fitur Terkini yang Diselesaikan & Sempurna:

1. **Tata Letak Khusus Desktop Mode & Left Sidebar Navigation**:
   - Sidebar navigasi desktop ramping (`w-20`) atau lebar (`w-64`) dengan tombol toggle ciutkan/lebarkan dan jam digital realtime.
   - Halaman Beranda 12-Grid memisahkan grafik pendapatan, metrik stok cabang, kartu profil, ticker kapsul, dan kontrol owner secara seimbang.

2. **Katalog Kartu Visual POS Kasir (`src/pages/CetakInvoice.tsx`)**:
   - Grid kartu produk visual untuk memasukkan pesanan dengan 1 tap.
   - Filter chip kategori instan (*Semua, Beans, Filter, Espresso, dll.*) + search bar.
   - Tombol Pecahan Uang Cepat (*Quick Cash Buttons*: `Uang Pas`, `50k`, `100k`, `200k`, `500k`) untuk menghitung kembalian kasir seketika.

3. **Master-Detail Split Pane di Halaman Riwayat (`src/pages/Riwayat.tsx`)**:
   - Kolom kiri (5 kolom) untuk filter & daftar transaksi, kolom kanan (7 kolom sticky) untuk pratinjau dokumen faktur resmi secara real-time.
   - Tombol aksi dokumen (*Cetak Ulang PDF, Kirim WhatsApp, Tandai Lunas, Edit, Hapus*) dapat diakses seketika tanpa pop-up modal bertumpuk.

4. **Kapsul Ticker Aktivitas & Animasi Pegas Spring Bezier**:
   - Ticker 1 baris ramping dengan rotasi otomatis 2 detik dan tombol silang (✕) yang tersimpan permanen di memori lokal & cloud.
   - Animasi transisi pegas (*spring physics bezier* `cubic-bezier(0.16, 1, 0.3, 1)`) pada kartu dan efek liquid shimmer lighting.

5. **Modul Cetak Price List PDF Kualitas Tinggi (`src/lib/pricelistPrint.ts`)**:
   - Layout A4 full-bleed tajam berbasis vektor dengan auto-splitting nama produk dan mode input barang manual.

---

## 🛠️ Modul & Fitur Aplikasi Secara Keseluruhan

### 1. Autentikasi & Hak Akses (`src/context/AuthContext.tsx`)
- Firebase Authentication dengan Role-Based Access Control (RBAC):
  - **Owner & Developer (`webdev`)**: Hak akses penuh ke grafik pendapatan, hapus invoice, reset log, dan menu **God Mode** (`/god-mode`).
  - **Admin**: Hak akses manajemen stok, cetak invoice, dan penagihan.
  - **Staff**: Hak akses operasional kasir dan mutasi stok.

### 2. POS Kasir & Pembuat Invoice (`src/pages/CetakInvoice.tsx`, `Riwayat.tsx`)
- Penomoran otomatis `INV/TNB/YYYY/MM/XXXX` sesuai tanggal transaksi.
- Dukungan printer termal maupun cetak PDF standar A4.
- Pengiriman invoice via WhatsApp resmi.

### 3. Manajemen Inventaris Multi-Gudang (`src/pages/UpdateStok.tsx`)
- Melacak stok terpisah untuk **Gudang Jogja** dan **Gudang Lombok**.
- Mutasi stok cepat, opname stok, dan pencetakan lembar laporan fisik.

### 4. Obrolan Tim Internal (`src/pages/Obrolan.tsx`)
- Ruang koordinasi internal tim Tanabrew berbasis Firestore real-time.

### 5. Menu Publik (`src/pages/PriceListPublic.tsx`)
- Rute publik `/pricelist` & `/menu` untuk scan QR / ID Card pelanggan tanpa perlu login.

---

## 📂 Struktur Direktori Proyek

```bash
├── public/                 # File statis & ikon aset
├── src/
│   ├── components/         # Komponen UI
│   │   ├── DesktopSidebar.tsx          # Navigasi bilah samping kiri desktop
│   │   ├── BottomNav.tsx               # Bar navigasi bawah mobile (Floating Island)
│   │   ├── ErrorBoundary.tsx           # Penangkal crash & layar putih global
│   │   ├── AppUpdateAnnouncementModal.tsx # Modal pengumuman pembaruan versi
│   │   ├── PullToRefresh.tsx           # Gestur tarik-layar muat ulang
│   │   └── ConfirmDialog.tsx           # Dialog konfirmasi aksi penting
│   ├── config/
│   │   └── appRelease.ts   # Konfigurasi versi & changelog aplikasi resmi
│   ├── context/
│   │   └── AuthContext.tsx # Provider autentikasi Firebase & RBAC
│   ├── hooks/              # Custom React Hooks (useProducts, useToast, dll.)
│   ├── lib/                # Utilitas & Layanan
│   │   ├── dateUtils.ts    # Utilitas tanggal terpusat & kalkulasi pendapatan
│   │   ├── invoiceNumber.ts# Penomoran transaksi & mutasi stok
│   │   ├── invoicePdfGenerator.ts # Generator PDF faktur invoice
│   │   ├── pricelistPrint.ts # Template cetak Price List PDF
│   │   ├── reportPrint.ts  # Template cetak Laporan Transaksi & Mutasi
│   │   ├── whatsappClient.ts # Integrasi pengiriman WhatsApp
│   │   └── onesignal.ts    # Integrasi Push Notification OneSignal
│   ├── pages/              # Halaman Aplikasi
│   │   ├── Beranda.tsx     # Dashboard analitik & 12-grid desktop
│   │   ├── CetakInvoice.tsx# Kasir POS Touch Tiles & Invoice
│   │   ├── Riwayat.tsx     # Master-Detail Split Pane & Riwayat
│   │   ├── UpdateStok.tsx  # Gudang Jogja/Lombok & Price List
│   │   ├── Obrolan.tsx     # Chat koordinasi tim
│   │   ├── Akun.tsx        # Profil pengguna & changelog viewer
│   │   ├── GodMode.tsx     # Pusat kendali Owner & Developer
│   │   └── PriceListPublic.tsx # Halaman menu publik untuk QR/ID Card
│   ├── App.tsx             # Root Router & ErrorBoundary wrapper
│   └── index.css           # Desain token, animasi spring, & glassmorphism
└── AGENTS.md               # Pedoman wajib pengembangan AI Agent
```

---

## 🏗️ Standar Pengujian & Kontribusi

Sebelum melakukan commit dan push ke repositori:
```bash
# 1. Jalankan pengujian unit
npm test -- --run

# 2. Jalankan kompilasi build produksi
npm run build
```
Pastikan seluruh pengujian selesai dengan `exit code 0` bebas dari error.
