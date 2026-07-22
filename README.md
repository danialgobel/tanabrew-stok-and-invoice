# Tanabrew Stock & Invoice - AI Checkpoint & Handoff

Selamat datang! Berkas ini dibuat khusus sebagai panduan pengembang (termasuk agen AI pengembang berikutnya) untuk memahami struktur proyek, arsitektur, dan fitur terbaru yang baru saja diselesaikan.

---

## 🚀 AI Agent Context (Status Checkpoint Terakhir)

> [!IMPORTANT]
> **Status Fitur Price List & PWA Cache**: Fitur Price List PDF berkualitas tinggi telah **selesai 100%** dan terintegrasi dengan data stok produk. Sistem caching Vercel juga telah dioptimalkan agar shortcut aplikasi perangkat staff otomatis memperbarui konten saat dideploy.

### Fitur yang Baru Saja Diselesaikan & Sempurna:
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

## 🛠️ Tech Stack Proyek
* **Core**: React 18, Vite, TypeScript
* **Styling**: Tailwind CSS & Shadcn UI
* **Database**: Firebase Firestore
* **Integrasi Eksternal**: Google Sheets (Spreadsheet Service) untuk pelaporan keuangan
* **Notifikasi**: OneSignal Web Push SDK
* **Testing**: Vitest untuk unit & integration testing

---

## 📂 Struktur Berkas Utama
* [`src/lib/pricelistPrint.ts`](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/lib/pricelistPrint.ts): Berisi cetakan layout HTML/CSS A4 Price List, ikon sosial media SVG, dan penanganan print.
* [`src/pages/UpdateStok.tsx`](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/pages/UpdateStok.tsx): Halaman utama manajemen stok di mana modal Price List disematkan.
* [`vercel.json`](file:///d:/Downloads/tanabrew-stok-and-invoice-github/vercel.json): File konfigurasi hosting Vercel yang mengatur routing rewrites dan header anti-caching untuk bypass update PWA.
* [`public/logo-pricelist.png`](file:///d:/Downloads/tanabrew-stok-and-invoice-github/public/logo-pricelist.png): Aset logo resmi resolusi tinggi yang digunakan dalam cetak price list.
* [`index.html`](file:///d:/Downloads/tanabrew-stok-and-invoice-github/index.html): Menampung link preload Google Fonts (`Dancing Script`, `Outfit`, `Poppins`).

---

## ⚠️ Panduan untuk Agen AI Berikutnya
1. **Keamanan Kode**: Jangan mengubah file-file service spreadsheet (`incomeService.ts`, `expenseService.ts`) atau modul invoice (`CetakInvoice.tsx`) kecuali secara eksplisit diminta oleh pengguna, karena bagian tersebut sudah stabil dan memiliki cakupan tes unit.
2. **Menjalankan Dev Server**: Gunakan perintah `npm run dev` untuk menjalankan server Vite lokal di port `8080`.
3. **Memastikan Kesuksesan Build**: Sebelum menganggap tugas selesai, selalu jalankan `npm run build:dev` untuk memvalidasi tidak ada kesalahan kompilasi TypeScript atau linting.
4. **Menjalankan Unit Test**: Jalankan `npm run test` untuk memastikan 22 tes unit di 6 berkas tetap lolos.
