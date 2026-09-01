# Tanabrew Stock & Invoice - Dokumentasi Lengkap & AI Checkpoint

Aplikasi **Tanabrew Stock & Invoice** adalah platform manajemen inventaris, kasir (POS), dan penagihan (invoice) yang terintegrasi langsung dengan database cloud (Google Firebase Firestore).

Aplikasi ini didesain sebagai Progressive Web App (PWA) agar dapat di-install sebagai aplikasi shortcut pada ponsel maupun desktop staff dengan navigasi ala aplikasi mobile native.

---

## 🚀 AI Agent Context (Status Checkpoint Terakhir)

> [!IMPORTANT]
> - **Penanganan Tanggal & Pendapatan Bulanan**: Modul `src/lib/dateUtils.ts` menjadi *single source of truth* untuk seluruh parsing, formatting, dan filtering tanggal invoice. Tanggal transaksi invoice (`invoice.tanggal`) selalu diprioritaskan di atas server timestamp (`invoice.created_at`), memastikan akurasi nomor invoice, hasil cetak faktur, serta perhitungan pendapatan harian dan bulanan.
> - **Status Fitur Price List & PWA Cache**: Fitur Price List PDF berkualitas tinggi telah **selesai 100%** dan terintegrasi dengan data stok produk. Sistem caching Vercel juga telah dioptimalkan agar shortcut aplikasi perangkat staff otomatis memperbarui konten saat dideploy.

### Fitur Terkini yang Diselesaikan & Sempurna:
1. **Modul Tanggal Terpusat & Akurasi Pendapatan (`src/lib/dateUtils.ts`)**:
   - Pemilihan tanggal otomatis (default hari ini dalam waktu lokal).
   - Penomoran invoice (`INV/TNB/YYYY/MM/XXXX`) sinkron dengan tanggal dan bulan invoice.
   - Format tanggal Indonesia yang elegan untuk cetak dan preview.
   - Perhitungan pendapatan bulanan & harian akurat berdasarkan tanggal transaksi invoice.

2. **Modul Cetak Price List PDF (`src/lib/pricelistPrint.ts`)**:
   - Layout berukuran A4 beresolusi tinggi, berbasis vektor tajam (teks dapat diblok) menggunakan pencetakan `window.print()`.
   - Menggunakan logo resmi lengkap `/logo-pricelist.png` (waves `SSS`, `TM`, divider `|`, dan teks `tanabrew roastery` orisinal) dengan koreksi margin putih bawaan gambar via CSS negative-margin.
   - Pola latar belakang menggunakan siluet daun palem/monstera SVG dengan lekukan jari yang dalam (palmate leaf) pudar (`#f6faf7`) di atas warna mint (`#edf4f0`).
   - Fitur full-bleed (tanpa batas margin putih pinggiran kertas) dengan setelan `@page { margin: 0; }`.
   - Huruf *Tanabrew Roastery Trademark* bergaya cursive menggunakan Google Font `Dancing Script`.
   - Hierarki ukuran font yang tegas: Kriteria Kategori (`19px` bold) jauh lebih besar daripada Nama Produk (`13.5px` bold) dan Harga (`13.5px` semi-bold).

3. **Panel Konfigurasi di Halaman Update Stok (`src/pages/UpdateStok.tsx`)**:
   - Tombol **Cetak Price List** hijau emerald di samping tombol cetak laporan stok.
   - Modal 2 langkah:
     - **Langkah 1**: Filter lokasi stok (Jogja / Lombok / Semua). Produk dengan stok = 0 di lokasi terpilih disembunyikan otomatis.
     - **Langkah 2**: Manajemen kriteria (tambah/hapus kategori) dan penyusunan produk.
   - Menghubungkan produk dari database secara instan via select dropdown, lengkap dengan **Auto-Splitting** (memecah nama produk database berformat `Nama - Deskripsi` menjadi kolom nama dan kolom deskripsi terpisah).
   - Tombol **`+ Manual`**: Memungkinkan pengisian manual (Nama, Harga, dan Deskripsi secara langsung) untuk barang kustom yang tidak ada di database.
   - Autosave ke `localStorage` (key: `tanabrew_pricelist_config`) agar data susunan tidak hilang ketika browser dimuat ulang.

4. **Penyelesaian Caching Aplikasi Shortcut/PWA (`vercel.json`)**:
   - Menyetel header `Cache-Control: public, max-age=0, must-revalidate` untuk file `index.html` dan `manifest.webmanifest`.
   - **Tujuan**: Memaksa shortcut di HP/device staff untuk selalu mengecek server Vercel ketika dibuka, sehingga setiap pembaruan aplikasi langsung ter-update otomatis pada perangkat mereka tanpa tersangkut cache lama.
   - File statis `/assets/*` tetap di-cache setahun (`max-age=31536000, immutable`) demi kecepatan muat yang optimal.

---

## 🛠️ Modul & Fitur Aplikasi Secara Keseluruhan

Aplikasi ini mencakup modul-modul bisnis utama berikut:

### 1. Sistem Autentikasi & Hak Akses (`src/context/AuthContext.tsx`)
- Menggunakan Firebase Authentication untuk login, registrasi, dan kelola sesi.
- Menyediakan Role-Based Access Control (RBAC) dengan hak akses:
  - **Owner/Admin (GodMode)**: Hak akses penuh ke grafik pendapatan, hapus data transaksi, dan konfigurasi sistem.
  - **Staff/Kasir**: Hak akses terbatas untuk melakukan transaksi kasir, update mutasi stok, dan cetak invoice.

### 2. Dashboard Analitik & Beranda (`src/pages/Beranda.tsx`)
- Menampilkan total penjualan harian, mingguan, bulanan, dan tahunan.
- Menampilkan grafik interaktif omzet dan transaksi.
- Log aktivitas terbaru (Activity Log) yang melacak tindakan user (misal: "Staff A mengubah stok Jogja Kopi Gayo menjadi 10").
- Widget peringatan stok kritis/hampir habis (Low Stock Warning).

### 3. POS Kasir & Transaksi (`src/pages/Riwayat.tsx`, `CetakInvoice.tsx`)
- Pencatatan transaksi penjualan secara real-time.
- Pembuatan nomor invoice otomatis menggunakan kode unik berdasarkan tahun/bulan/nomor urut sesuai tanggal invoice.
- Cetak Invoice dalam format struk belanja yang ramah printer termal maupun cetak PDF standar.
- Menyimpan status pembayaran (LUNAS / BELUM LUNAS).

### 4. Manajemen Inventaris Multilokasi (`src/pages/UpdateStok.tsx`)
- Melacak jumlah stok barang di dua gudang/outlet fisik terpisah: **Jogja** dan **Lombok**.
- Fitur mutasi stok cepat (tambah stok masuk, kurangi stok rusak, penyesuaian opname).
- Pencetakan Lembar Laporan Stok fisik untuk audit manual.
- Generator Price List PDF yang dinamis.

### 5. PWA Mobile UI & Push Notification (`src/lib/onesignal.ts`)
- Navigasi mobile-friendly dengan bar navigasi bawah (`BottomNav.tsx`) yang lengket di layar handphone.
- Fitur geser ke bawah untuk menyegarkan data (`PullToRefresh.tsx`) yang meniru pengalaman aplikasi mobile native.
- OneSignal SDK terintegrasi untuk mengirimkan notifikasi push ketika stok habis atau terdapat pengumuman penting bagi staff.

---

## 📂 Struktur Direktori Proyek

```bash
├── public/                 # File statis
├── src/
│   ├── components/         # Reusable UI Components
│   │   ├── ui/             # Shadcn UI primitives
│   │   ├── BottomNav.tsx   # Bar navigasi bawah
│   │   ├── ConfirmDialog.tsx# Dialog konfirmasi
│   │   └── PullToRefresh.tsx# Gesture tarik-layar untuk memuat ulang data
│   ├── context/
│   │   └── AuthContext.tsx # Provider autentikasi Firebase
│   ├── hooks/              # Custom React Hooks
│   ├── lib/                # Layanan & Utilitas Helper
│   │   ├── dateUtils.ts    # Utilitas tanggal terpusat, parsing, & kalkulasi pendapatan
│   │   ├── invoiceNumber.ts# Penomoran invoice transaksi & update stok
│   │   ├── firebase.ts     # Inisialisasi SDK Firebase Firestore & Auth
│   │   ├── pricelistPrint.ts# Template desain cetak Price List PDF A4
│   │   ├── reportPrint.ts  # Template desain cetak Laporan Stok & Mutasi
│   │   └── onesignal.ts    # Integrasi notifikasi push OneSignal
│   ├── pages/              # Halaman Tampilan (Screens)
│   │   ├── Beranda.tsx     # Dashboard Grafik & Peringatan Stok
│   │   ├── Riwayat.tsx     # POS Kasir & Transaksi Log
│   │   ├── CetakInvoice.tsx# Pembuatan & Cetak Invoice
│   │   ├── UpdateStok.tsx  # Halaman Stok & Generator Price List
│   │   ├── Obrolan.tsx     # Ruang Komunikasi Tim Internal
│   │   ├── Akun.tsx        # Profil Pengguna & Preferensi Operasional
│   │   └── GodMode.tsx     # Pengaturan Developer & Maintenance Database
│   ├── types/              # Type definition TypeScript
│   ├── App.tsx             # Pengaturan Router Rute & Proteksi Halaman
│   └── main.tsx            # React DOM entrypoint
├── index.html              # Template HTML utama
├── vercel.json             # Konfigurasi rewrite & anti-cache header Vercel
├── tailwind.config.ts      # Konfigurasi desain & token warna Tailwind CSS
└── package.json            # Informasi dependency & script build/test
```

---

## 💻 Cara Menjalankan Proyek Secara Lokal

### Prasyarat:
Pastikan Anda telah menginstal Node.js (versi 18+) di komputer Anda.

1. **Instal dependency**:
   ```bash
   npm install
   ```

2. **Konfigurasi Environment Variables**:
   Buat file `.env.local` atau isi `.env` di root folder dengan kredensial Firebase Anda.

3. **Jalankan server development**:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di [http://localhost:8080/](http://localhost:8080/).

---

## 🧪 Pengujian Unit (Unit Testing)

Jalankan perintah berikut untuk menjalankan seluruh pengujian:
```bash
npm test -- --run
```

---

## ⚠️ Panduan Keamanan untuk AI Agent Pengembang Berikutnya
1. **Integritas Tanggal**: Selalu gunakan fungsi dari `src/lib/dateUtils.ts` saat melakukan kalkulasi, formatting, atau filtering tanggal invoice.
2. **PWA & Caching**: Aturan header di `vercel.json` sangat krusial agar aplikasi shortcut staff ter-update otomatis. Jangan menghapus blok `"headers"` di file tersebut.
3. **Format CSS Cetak**: Layout cetak di `pricelistPrint.ts` menggunakan style khusus `@media print` dan ukuran A4. Perubahan layout harus dites menggunakan print preview browser untuk menjamin estetika tetap presisi.
