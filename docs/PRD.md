# Product Requirement Document (PRD)
## Tanabrew Stock, POS Kasir & Multi-Warehouse Management System

* **Dokumen Versi**: 1.0.0 (Living Architecture PRD)
* **Versi Aplikasi Saat Ini**: Web Application `v3.3.12` | Android Native Container `v1.2.0 (Build 3)`
* **Status Produk**: Aktif di Lingkungan Produksi (*Production Ready*)
* **Tanggal Penyusunan**: 6 September 2026
* **Stakeholders Utama**:
  * **Product Owner & Finance**: Ahmad Farid Musaddad
  * **Lead System Architect & Developer**: Danial Gobel
  * **Operasional**: Tim Kasir & Gudang Tanabrew Roastery (Jogja & Lombok)

---

## 📑 Daftar Isi
1. [Ringkasan Eksekutif & Visi Produk](#1-ringkasan-eksekutif--visi-produk)
2. [Latar Belakang Masalah (Problem Statement)](#2-latar-belakang-masalah-problem-statement)
3. [Tujuan Produk & Indikator Keberhasilan (OKRs & KPIs)](#3-tujuan-produk--indikator-keberhasilan-okrs--kpis)
4. [Target Pengguna & Hak Akses Berbasis Peran (RBAC)](#4-target-pengguna--hak-akses-berbasis-peran-rbac)
5. [Prinsip Desain & Paradigma Responsif Ganda (Dual-Responsive)](#5-prinsip-desain--paradigma-responsif-ganda-dual-responsive)
6. [Alur Perjalanan Pengguna Utama (User Journeys)](#6-alur-perjalanan-pengguna-utama-user-journeys)
7. [Kebutuhan Fungsional Produk (Functional Requirements)](#7-kebutuhan-fungsional-produk-functional-requirements)
   * 7.1 Modul Autentikasi, Akun & Keamanan
   * 7.2 Modul Beranda & Dasbor Analitik Eksekutif
   * 7.3 Modul POS Kasir & Pembuat Faktur Penjualan (CetakInvoice)
   * 7.4 Modul Manajemen Inventaris Multi-Gudang (UpdateStok)
   * 7.5 Modul Riwayat Transaksi & Audit Split-Pane (Riwayat)
   * 7.6 Modul Katalog Publik & Pelacakan Pengunjung (PriceListPublic)
   * 7.7 Modul Obrolan Internal Tim (Obrolan)
   * 7.8 Modul Pengembang & Pemulihan Sistem (GodMode)
   * 7.9 Modul Otomasi Laporan Malam Hari (Cron Dispatcher)
   * 7.10 Modul Pembungkus Aplikasi Native Android
8. [Kebutuhan Non-Fungsional (Non-Functional Requirements)](#8-kebutuhan-non-fungsional-non-functional-requirements)
   * 8.1 Strategi Anti-Overquota Kuota Gratis Firebase Spark
   * 8.2 Kestabilan Sistem & Pencegahan Layar Putih (Blank Screen)
   * 8.3 Kecepatan & Pemrosesan Sisi Klien (Zero-Server-Lag)
   * 8.4 Sistem Sinkronisasi Rilis Real-Time (Zero-Relog)
9. [Skema Data & Integrasi Ekosistem](#9-skema-data--integrasi-ekosistem)
10. [Rencana Pengembangan Masa Depan (Product Roadmap)](#10-rencana-pengembangan-masa-depan-product-roadmap)

---

## ☕ 1. Ringkasan Eksekutif & Visi Produk

**Tanabrew Stock & Invoice** adalah ekosistem aplikasi kasir *Point of Sale* (POS), penagihan faktur resmi B2B, dan manajemen inventaris biji kopi specialty multi-gudang yang dirancang khusus untuk memenuhi kebutuhan operasional **Tanabrew Roastery**.

### Visi Produk
> *"Menghubungkan seluruh siklus rantai pasok Tanabrew Roastery—dari stok sangrai biji kopi di gudang, transaksi ritel kasir, penagihan tempo mitra kedai kopi, hingga menu publik—dalam satu sistem real-time yang cepat, bebas biaya langganan bulanan, dan tangguh di perangkat mobile maupun desktop."*

### Nilai Tambah Utama (Value Propositions):
1. **Kecepatan Transaksi Kilat**: Transaksi POS walk-in dan cetak nota dapat diselesaikan dalam waktu kurang dari 15 detik dengan fitur *Square-style Touch Tiles* dan kalkulator *Quick Cash*.
2. **Sinkronisasi Multi-Gudang Terpisah**: Melacak ketersediaan fisik biji kopi secara independen untuk **Gudang Jogja** dan **Gudang Lombok** dengan mekanisme transfer stok atomik.
3. **Efisiensi Finansial 100% (Zero-Subscription)**: Dibangun di atas arsitektur *Serverless Jamstack* yang memanfaatkan Google Firebase Spark Tier dan Vercel Edge secara optimal tanpa beban biaya server bulanan.
4. **Dokumentasi PDF Instan Tanpa Server**: Pembuatan faktur penagihan resmi (ukuran standar A4) dan katalog harga (Price List) diproses langsung di memori browser klien (*client-side rendering*), menghilangkan risiko kegagalan server pihak ketiga.
5. **Konektivitas WhatsApp Terintegrasi**: Pengiriman bukti faktur dan rincian transaksi langsung ke WhatsApp pelanggan hanya dengan satu klik.

---

## 🎯 2. Latar Belakang Masalah (Problem Statement)

Sebelum sistem ini diimplementasikan, operasional Tanabrew menghadapi sejumlah kendala:

1. **Selisih Stok Multi-Lokasi**: Operasional sangrai dan distribusi berlangsung di Yogyakarta dan Lombok. Pencatatan manual menggunakan spreadsheet rentan mengalami konflik data, stok ganda, atau pesanan masuk ketika stok fisik di cabang tersebut sebenarnya telah habis.
2. **Antrean Kasir & Kesalahan Kembalian**: Penghitungan transaksi tunai secara manual di kasir memicu kelambatan layanan saat jam sibuk dan memperbesar risiko salah hitung uang kembalian.
3. **Penagihan B2B yang Memakan Waktu**: Mitra coffee shop rekanan membutuhkan faktur penagihan formal berpenomoran standar dengan rincian rekening bank resmi (SeaBank & BSI a.n. Ahmad Farid Musaddad). Pembuatan manual menggunakan pengolah kata memakan waktu 5-10 menit per transaksi.
4. **Keterbatasan Layanan POS Komersial**: Layanan POS pihak ketiga di pasaran membebankan biaya lisensi bulanan per cabang, fitur multi-gudang berbayar mahal, dan tidak memiliki integrasi spesifik terhadap profil roastery (seperti klasifikasi origin beans, mode harga normal vs B2B, dan pembagian stok regional).

---

## 📊 3. Tujuan Produk & Indikator Keberhasilan (OKRs & KPIs)

### Objectives & Key Results (OKRs)
* **Objective 1**: Mengotomatisasi dan mempercepat proses transaksi ritel & grosir Tanabrew Roastery.
  * *KR 1.1*: Waktu pembuatan faktur dan cetak nota kasir tercapai di bawah 20 detik per transaksi.
  * *KR 1.2*: 100% transaksi tercatat memiliki nomor seri faktur unik dengan format `INV/TNB/YYYY/MM/XXXX`.
* **Objective 2**: Menjamin akurasi data inventaris biji kopi di kedua gudang operasional.
  * *KR 2.1*: Tingkat selisih antara stok fisik dengan data sistem berkurang hingga di bawah 1%.
  * *KR 2.2*: Seluruh mutasi dan transfer antar gudang tercatat di audit log secara real-time.
* **Objective 3**: Mempertahankan keandalan sistem dengan biaya operasional Rp 0.
  * *KR 3.1*: Konsumsi kuota Firestore harian tetap di bawah batas gratis 50.000 read dan 20.000 write per hari.
  * *KR 3.2*: Uptime sistem mencapai 99.9% tanpa insiden layar putih (*blank white screen*).

---

## 👥 4. Target Pengguna & Hak Akses Berbasis Peran (RBAC)

Aplikasi menerapkan sistem kendali akses berbasis peran (*Role-Based Access Control*) yang ketat:

| Peran (*Role*) | Kode Akses | Deskripsi & Tanggung Jawab Utama | Batasan Akses |
| :--- | :---: | :--- | :--- |
| **Owner** | `OWNER` | Pemilik usaha & kepala keuangan. Memantau omzet, grafik 7 hari, persetujuan opname stok, publikasi arahan owner, serta menerima laporan rekap harian email. | Akses penuh ke seluruh modul bisnis dan analitik keuangan. |
| **Admin** | `ADMIN` | Supervisor kasir & kepala gudang. Mengelola katalog produk, harga, eksekusi transfer stok antar-gudang, pembuatan faktur, tandai lunas, dan ekspor CSV. | Tidak dapat mengakses panel pengembang GodMode tingkat lanjut. |
| **Staff** | `STAFF` | Kasir outlet & staf operasional harian. Melakukan pencatatan pesanan (POS Kasir), kalkulasi pembayaran, cetak nota, dan cek stok live. | Pembatasan edit/hapus transaksi masa lalu dan perubahan harga master produk. |
| **Developer** | `WEBDEV` / `GODMODE` | Tim pengembang sistem & super administrator. Bertanggung jawab atas pemeliharaan kode, audit integritas database, backup JSON, dan pengujian push notifikasi. | Memiliki kapabilitas GodMode dan simulasi akun (*account impersonation*). |
| **Publik** | *(Tanpa Login)* | Pelanggan ritel dan calon mitra kedai kopi yang mengakses `/pricelist` atau `/menu` via pemindaian QR code fisik. | Hanya dapat melihat katalog digital dan tautan etalase resmi Shopee. |

---

## 🎨 5. Prinsip Desain & Paradigma Responsif Ganda (Dual-Responsive)

Aplikasi menerapkan pendekatan **Dual-Responsive Hybrid**:

```
                              [ Responsivitas Perangkat ]
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
[ Layar Ponsel & Tablet (< 1024px) ]                       [ Layar Komputer / Desktop (≥ 1024px) ]
• Floating Glassmorphic Bottom Bar                         • Permanent Collapsible Left Sidebar (w-20 / w-64)
• Gestur Tarik Muat Ulang (Pull-to-Refresh)                 • Dasbor Multi-Kolom 12-Grid (8 Kolom + 4 Kolom)
• Bottom Sheet Drawer untuk Form Input                     • Split-Screen POS Touch Tiles (Square Style)
• Haptic Feedback Getar Ringan                             • Master-Detail Split Pane di Riwayat Transaksi
```

---

## 🚀 6. Alur Perjalanan Pengguna Utama (User Journeys)

### A. Alur Kasir POS Walk-In (Skenario Transaksi Cepat)
1. Kasir membuka menu **Cetak Invoice**.
2. Kasir memilih gudang asal transaksi (Gudang Jogja secara default).
3. Kasir mengetuk kartu produk di katalog POS (kuantitas otomatis bertambah).
4. Kasir memasukkan nama pelanggan atau memilih dari daftar *Frequent Customers*.
5. Kasir mengetuk tombol **Quick Cash** (misal: *Uang Pas* atau pecahan *100k*).
6. Sistem menghitung nominal kembalian secara otomatis.
7. Kasir menekan **Simpan & Cetak Faktur**.
8. Stok gudang otomatis terpotong secara atomik di database, file PDF nota langsung terbuka di peramban, dan kasir dapat langsung membagikannya ke WhatsApp pembeli.

### B. Alur Mutasi Stok Antar-Gudang (Jogja ⇄ Lombok)
1. Admin membuka menu **Update Stok**.
2. Admin menekan tombol **Transfer Stok**.
3. Admin memilih produk yang akan dipindahkan, menentukan arah transfer (`Jogja -> Lombok` atau sebaliknya), dan mengisi jumlah unit.
4. Sistem mengeksekusi operasi `writeBatch` Firestore: mengurangi stok asal, menambah stok tujuan, dan mencatat riwayat ke koleksi `stock_movements`.
5. Kapsul audit mencatat kejadian tersebut secara seketika.

### C. Alur Pelanggan Publik & Notifikasi Kunjungan
1. Pelanggan memindai QR code di meja atau membuka tautan `tanabrew.com/pricelist`.
2. Halaman publik memuat gambar katalog resmi resolusi tinggi dengan antarmuka lightbox.
3. Di latar belakang, fungsi klien memicu `/api/visitor-event` dengan perlindungan anti-spam (maksimal 1 notifikasi per sesi perangkat).
4. Push notification terkirim ke ponsel Owner dan Admin melalui OneSignal: *"Ada pelanggan yang sedang melihat katalog Price List Tanabrew"*.

---

## ⚙️ 7. Kebutuhan Fungsional Produk (Functional Requirements)

### 7.1 Modul Autentikasi, Akun & Keamanan
* **FR-AUTH-01 (Registrasi Berbasis Kode Akses)**: Pendaftaran akun baru mewajibkan kode otorisasi (`OWNER`, `ADMIN`, `STAFF`, `WEBDEV`) untuk mencegah pendaftaran publik yang tidak berhak.
* **FR-AUTH-02 (Ketahanan Sesi IndexedDB)**: Sesi login pengguna disimpan di `IndexedDB` browser lokal sehingga pembaruan aplikasi dan reload halaman tidak memutus sesi (*zero-relog*).
* **FR-AUTH-03 (Manajemen Profil)**: Pengguna dapat mengubah nama tampilan, kata sandi, dan foto profil.
* **FR-AUTH-04 (Pengaturan Getar Haptic)**: Pengguna smartphone dapat mengaktifkan atau menonaktifkan umpan balik getar (*haptic feedback*) saat menekan tombol aksi.

### 7.2 Modul Beranda & Dasbor Analitik Eksekutif
* **FR-DASH-01 (Ringkasan Metrik Finansial)**: Menampilkan total omzet penjualan, jumlah transaksi, total item terjual, dan leaderboard produk kopi terlaris.
* **FR-DASH-02 (Kartu Stok Gudang Terpadu)**: Menampilkan 4 metrik status inventaris: Total Jenis Produk, Total Unit Fisik, Stok Gudang Jogja, dan Stok Gudang Lombok.
* **FR-DASH-03 (Grafik Tren Omzet 7 Hari)**: Visualisasi area grafis interaktif (*Recharts AreaChart*) yang memperlihatkan kurva penjualan harian selama sepekan terakhir.
* **FR-DASH-04 (Tabel Inventaris Live)**: Menampilkan daftar ketersediaan produk dengan indikator warna:
  * *Merah*: Stok Habis (0 unit).
  * *Kuning*: Stok Menipis (1 - 3 unit).
  * *Hijau*: Stok Aman (> 3 unit).
* **FR-DASH-05 (Kapsul Ticker Aktivitas Real-Time)**: Bilah informasi melayang satu baris di bagian atas yang berotasi otomatis setiap 2 detik, menampilkan aktivitas transaksi dan kunjungan terbaru, serta dapat ditutup permanen (*dismissible*).
* **FR-DASH-06 (Arahan Owner / Announcement)**: Fitur khusus peran Owner untuk menyiarkan instruksi operasional penting yang tampil menonjol di dasbor seluruh anggota tim.

### 7.3 Modul POS Kasir & Pembuat Faktur (CetakInvoice)
* **FR-POS-01 (Katalog POS Touch Tiles)**: Grid kartu visual produk bergaya Square POS untuk penambahan item ke keranjang belanja hanya dengan satu ketukan.
* **FR-POS-02 (Mode Baris Manual)**: Kasir dapat beralih ke formulir baris tabel konvensional untuk entri data transaksi yang panjang atau fleksibel.
* **FR-POS-03 (Pecahan Cepat / Quick Cash)**: Tombol instan nominal uang tunai (`Uang Pas`, `50.000`, `100.000`, `200.000`, `500.000`) untuk menghitung nominal kembalian tanpa mengetik.
* **FR-POS-04 (Penomoran Otomatis Standar)**: Sistem otomatis membuat nomor faktur terurut menggunakan format resmi: `INV/TNB/YYYY/MM/XXXX`.
* **FR-POS-05 (Pengurangan Stok Otomatis)**: Setiap faktur yang disimpan akan langsung memotong stok produk pada gudang yang dipilih (Jogja atau Lombok).
* **FR-POS-06 (Rekomendasi Pelanggan)**: Menyimpan dan menampilkan 8 pelanggan yang paling sering bertransaksi (*frequent customers*) untuk percepatan pengetikan.
* **FR-POS-07 (Generasi PDF Faktur Klien)**: Menghasilkan dokumen cetak faktur standar A4 berkualitas tinggi lengkap dengan logo resmi, rincian barang, diskon, dan informasi rekening pembayaran.
* **FR-POS-08 (Dispatch WhatsApp Instan)**: Tombol langsung untuk membuka WhatsApp Web atau WhatsApp Mobile dengan format pesan penagihan yang sudah terisi otomatis.

### 7.4 Modul Manajemen Inventaris Multi-Gudang (UpdateStok)
* **FR-STK-01 (Katalog & CRUD Produk)**: Formulir penambahan, pengubahan, dan penonaktifan produk kopi dengan kolom: Nama Barang, Kategori, Stok Jogja, Stok Lombok, Harga Ritel, dan Harga Khusus B2B.
* **FR-STK-02 (Kategori Standar)**: Klasifikasi produk ke dalam 5 grup baku: `Kopi Biji (Beans)`, `Kopi Bubuk / Drip`, `Sirup & Bahan`, `Alat & Kemasan`, dan `Lainnya`.
* **FR-STK-03 (Transfer Stok Antar-Gudang)**: Dialog mutasi barang yang memindahkan kuantitas tertentu dari Gudang Jogja ke Gudang Lombok (atau sebaliknya) secara aman dan transaksional.
* **FR-STK-04 (Pencetakan Price List A4 Full-Bleed)**: Modul pembuat katalog harga PDF A4 siap cetak dengan tata letak otomatis (*auto-splitting* nama produk) yang mendukung mode harga normal maupun harga B2B.
* **FR-STK-05 (Cetak Laporan Stok Fisik)**: Ekspor cetak lembar kerja opname stok untuk pencocokan fisik di gudang.

### 7.5 Modul Riwayat Transaksi & Audit Split-Pane (Riwayat)
* **FR-HIST-01 (Master-Detail Split Pane Desktop)**: Layar desktop menampilkan daftar faktur di sisi kiri (5 kolom) dan pratinjau langsung nota resmi di sisi kanan (7 kolom sticky) tanpa perlu membuka modal bertumpuk.
* **FR-HIST-02 (Penyaringan Komprehensif)**: Filter transaksi berdasarkan rentang tanggal (Hari Ini, Minggu Ini, Bulan Ini, Kustom), status pelunasan (`LUNAS` / `BELUM LUNAS`), dan status pencetakan.
* **FR-HIST-03 (Paginasi Kursor Firestore)**: Membatasi pemuatan data maksimal 60 dokumen per halaman menggunakan teknik kursor `startAfter` untuk menghemat konsumsi kuota database.
* **FR-HIST-04 (Manajemen Siklus Faktur)**:
  * *Tandai Lunas*: Mengubah status pembayaran tanpa mengubah alokasi stok.
  * *Edit Faktur*: Membuka kembali data transaksi ke kasir, mengembalikan stok lama, dan memotong stok baru sesuai revisi.
  * *Hapus Faktur*: Menghapus dokumen faktur dengan pengembalian kuantitas stok barang ke gudang asal secara otomatis.
* **FR-HIST-05 (Tab Mutasi & Log Audit)**: Tab terpisah untuk meninjau histori pergerakan stok barang dan catatan audit aktivitas seluruh sistem.
* **FR-HIST-06 (Ekspor Data CSV)**: Mengunduh data penjualan ke berkas CSV yang kompatibel dengan Microsoft Excel dan Google Sheets.

### 7.6 Modul Katalog Publik & Pelacakan Pengunjung (PriceListPublic)
* **FR-PUB-01 (Akses Terbuka Tanpa Autentikasi)**: Rute `/pricelist` dan `/menu` dapat diakses oleh siapa saja tanpa memerlukan akun login.
* **FR-PUB-02 (Tampilan Menu Kopi Specialty)**: Menampilkan lembar menu beresolusi tinggi dengan penampil gambar *lightbox* interaktif (zoom & download).
* **FR-PUB-03 (Tombol Belanja Shopee Resmi)**: Tautan langsung ke toko resmi Shopee Tanabrew Roastery.
* **FR-PUB-04 (Pelacakan Pengunjung Cerdas)**: Mengirimkan sinyal analitik ke `/api/visitor-event` saat menu dibuka atau tombol Shopee diklik.

### 7.7 Modul Obrolan Internal Tim (Obrolan)
* **FR-CHAT-01 (Grup Tim & Pesan Langsung)**: Mendukung obrolan bersama (*Team Channel*) serta obrolan privat antar-staf (*Direct Messages*).
* **FR-CHAT-02 (Indikator Kehadiran Online)**: Memperlihatkan status keaktifan rekan kerja secara real-time dengan pembaruan bersyarat (*throttled presence*).
* **FR-CHAT-03 (Push Notification Pesan Masuk)**: Memicu notifikasi OneSignal ke perangkat penerima saat aplikasi sedang ditutup atau berada di latar belakang.

### 7.8 Modul Pengembang & Pemulihan Sistem (GodMode)
* **FR-GOD-01 (Akses Khusus Role Super Admin)**: Hanya dapat dibuka oleh pengguna dengan peran `owner` atau `webdev`.
* **FR-GOD-02 (Database Explorer)**: Menjelajahi, menyaring, dan mengedit data mentah Firestore untuk koleksi `invoices`, `products`, `activity_logs`, `stock_movements`, dan `users`.
* **FR-GOD-03 (Pemeriksaan Integritas Data / Health Check)**: Memindai inkonsistensi data sistem, mendeteksi potensi stok negatif, dan menyediakan tombol perbaikan otomatis (*auto-repair*).
* **FR-GOD-04 (Pencadangan & Pemulihan Database JSON)**: Fitur ekspor seluruh basis data ke file JSON lokal dan impor data untuk mitigasi bencana (*disaster recovery*).
* **FR-GOD-05 (Simulasi Akun / Impersonation)**: Kemampuan beralih identitas ke akun staf lain untuk keperluan debugging dan verifikasi izin tampilan.

### 7.9 Modul Otomasi Laporan Malam Hari (Cron Dispatcher)
* **FR-CRON-01 (Jadwal Eksekusi Harian)**: Berjalan otomatis setiap pukul **23:00 WIB** (16:00 UTC) melalui Vercel Cron.
* **FR-CRON-02 (Pengiriman Rekapitulasi ke Email Tim)**: Mengumpulkan data penjualan harian, status stok menipis, dan menyusun laporan terformat rapi untuk dikirimkan ke seluruh email anggota tim aktif via Nodemailer/Resend.
* **FR-CRON-03 (Fallback Darurat Kuota)**: Jika kuota Firestore Spark habis saat cron berjalan, sistem otomatis beralih ke daftar email cadangan di variabel lingkungan (`RECIPIENT_EMAILS`) agar email tidak pernah gagal terkirim.

### 7.10 Modul Pembungkus Aplikasi Native Android
* **FR-AND-01 (Container APK Ringkas)**: File APK native berukuran ultra-ringan (~3.6 MB) yang membungkus antarmuka web ke dalam WebView berperforma tinggi.
* **FR-AND-02 (Penanganan Cetak Dokumen Anti-Stuck)**: Integrasi tombol jembatan native `AndroidBridge.closePrintPreview()` dan intersepsi tombol *Back* fisik perangkat untuk menutup pratinjau PDF tanpa keluar dari aplikasi.

---

## 🛡️ 8. Kebutuhan Non-Fungsional (Non-Functional Requirements)

### 8.1 Strategi Anti-Overquota Kuota Gratis Firebase Spark
Untuk menjamin operasional aplikasi tetap **100% gratis** di bawah batas Google Firebase Spark:
1. **Penerapan Limit Kueri Wajib**: Seluruh kueri realtime dibatasi kuota pengambilan:
   * Kueri transaksi dasbor Beranda: `limit(80)`.
   * Kueri log aktivitas dan mutasi stok: `limit(50)`.
   * Kueri daftar riwayat: kursor paginasi `startAfter` dengan `limit(60)`.
2. **Singleton In-Memory Cache**: Katalog produk (`useProducts.ts`) menggunakan satu listener modul tunggal di memori sehingga perpindahan halaman antar-tab tidak memicu penarikan data berulang (0 tambahan operasi baca).
3. **Penyimpanan Aset di CDN**: Seluruh aset gambar logo, ikon, dan dokumen grafis disimpan di direktori `/public/` (dilayani oleh CDN Vercel Edge gratis), bukan di Firebase Storage.
4. **Pencegahan Polling Agresif**: Pengecekan pesan baru dihentikan secara otomatis saat tab peramban berada di latar belakang (*visibility-aware*).

### 8.2 Kestabilan Sistem & Pencegahan Layar Putih (Blank Screen)
1. **Global Error Boundary**: Seluruh struktur halaman di `src/App.tsx` dibungkus komponen `<ErrorBoundary>`. Jika terjadi kegagalan parsing data lokal, layar menampilkan pemberitahuan ramah dengan opsi muat ulang cepat, bukan layar putih kosong.
2. **Safe Optional Chaining & Default Fallback**: Dilarang mengakses properti objek langsung tanpa pengaman; seluruh baris kode wajib menerapkan operator rantai opsional (`userProfile?.role`, `items?.map(...)`) dengan nilai bawaan (`|| []`, `|| 0`, `|| ""`).
3. **Penyelarasan Zona Waktu Terpusat**: Seluruh parsing tanggal wajib menggunakan fungsi pembantu di `src/lib/dateUtils.ts` untuk mengantisipasi perbedaan format antara timestamp server Firestore dan waktu lokal perangkat kasir.

### 8.3 Kecepatan & Pemrosesan Sisi Klien (Zero-Server-Lag)
1. **Pembuatan Dokumen PDF Tanpa Beban Server**: Kompilasi faktur penjualan dan dokumen katalog harga dilakukan 100% di browser pengguna memanfaatkan pustaka `jspdf` dan `html2canvas`.
2. **Optimasi Bundle Vite**: Kode aplikasi di-bundle secara modular dengan pemisahan dependensi (*code-splitting*) agar waktu muat awal aplikasi berada di bawah 1.5 detik pada koneksi 4G.

### 8.4 Sistem Sinkronisasi Rilis Real-Time (Zero-Relog)
1. **Deteksi Rilis Otomatis**: Komponen `AutoUpdateBanner.tsx` memantau dokumen `system/app_version` di Firestore. Saat versi aplikasi dinaikkan di GitHub dan Vercel, seluruh perangkat kasir yang aktif akan menerima sinyal pembaruan seketika.
2. **Perlindungan Sesi Aktif Kasir**: Jika kasir sedang memasukkan item belanjaan di keranjang kasir, sistem auto-reload cerdas akan menahan pemuatan ulang halaman hingga transaksi tersebut selesai disimpan demi mencegah hilangnya data keranjang kasir.

---

## 💾 9. Skema Data & Integrasi Ekosistem

### Diagram Relasi Koleksi Firestore
```
[ users ] (Profil Staf & RBAC Role)
    │
    ├───────────► [ invoices ] (Faktur Transaksi Penjualan)
    │                 │
    │                 ▼
    │           [ stock_movements ] (Audit Pemotongan & Mutasi Stok)
    │                 ▲
    │                 │
    ├───────────► [ products ] (Katalog Biji Kopi, Stok Jogja & Lombok)
    │
    ├───────────► [ activity_logs ] (Histori Aktivitas & Visitor)
    │
    ├───────────► [ team_chats & direct_chats ] (Komunikasi Internal)
    │
    └───────────► [ system / app_version ] (Sinkronisasi Versi Real-Time)
```

### Integrasi Ekosistem Pihak Ketiga:
* **Google Firebase**: Autentikasi Pengguna & Basis Data Dokumen Cloud Firestore NoSQL.
* **Vercel Serverless Edge**: Hosting SPA & Eksekusi Fungsi API Backend (`/api/*`).
* **OneSignal Web Push**: Pengiriman push notification ke browser komputer dan smartphone Android/iOS.
* **Resend & Nodemailer**: Pengiriman email ringkasan laporan harian otomatis pukul 23:00 WIB.
* **WhatsApp Gateway**: Pengiriman langsung dokumen faktur ke nomor telepon pelanggan.

---

## 🗺️ 10. Rencana Pengembangan Masa Depan (Product Roadmap)

| Fase | Inisiatif Fitur | Deskripsi | Estimasi Dampak |
| :---: | :--- | :--- | :--- |
| **Fase 1** | **Direct Bluetooth ESC/POS Printing** | Integrasi cetak struk thermal 58mm/80mm langsung melalui Bluetooth Web API tanpa dialog print browser. | Mengurangi waktu cetak struk fisik di kasir menjadi < 3 detik. |
| **Fase 2** | **Dynamic QRIS Payment Integration** | Pembuatan QRIS dinamis otomatis pada layar kasir yang langsung terverifikasi lunas saat pelanggan membayar. | Menghilangkan kebutuhan konfirmasi transfer manual pada jam sibuk. |
| **Fase 3** | **Roasting Batch & Green Beans Tracker** | Pencatatan penerimaan *green beans*, susut bobot sangrai (*roasting yield loss*), dan pelacakan batch produksi. | Integrasi hulu ke hilir dari bahan mentah hingga biji kopi siap seduh. |
| **Fase 4** | **Customer Loyalty & Poin Mitra** | Sistem akumulasi poin belanja bagi kedai kopi rekanan B2B untuk program potongan harga berkala. | Meningkatkan retensi pemesanan ulang (*repeat order*) mitra coffee shop. |

---

*Dokumen PRD ini disusun dan diaudit secara komprehensif berdasarkan basis kode resmi repositori Tanabrew Stock & Invoice (`v3.3.12`). Seluruh pembaruan spesifikasi wajib diselaraskan dengan dokumen ini dan [AGENTS.md](file:///d:/Downloads/tanabrew-stok-and-invoice-github/AGENTS.md).*
