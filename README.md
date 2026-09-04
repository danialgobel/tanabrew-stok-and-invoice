# Tanabrew Stock & Invoice

Sistem manajemen inventaris biji kopi specialty, kasir point of sale (POS), dan penagihan faktur resmi terintegrasi untuk Tanabrew Roastery.

Aplikasi ini mengusung arsitektur responsif ganda:
* **Mobile / Tablet**: Antarmuka ringkas bergaya aplikasi kasir portabel dengan navigasi bawah mengambang.
* **Desktop / Laptop**: Antarmuka dashboard POS dengan navigasi bilah sisi kiri, katalog produk sentuh, dan pratinjau faktur instan (*master-detail pane*).

---

## Fitur Utama

* **Point of Sale (POS) Kasir**: Pemilihan produk cepat, kalkulasi kembalian tunai instan (*quick cash*), penomoran faktur otomatis, dan pembuatan nota PDF resmi.
* **Manajemen Stok Multi-Gudang**: Pelacakan stok independen untuk Gudang Jogja dan Gudang Lombok, riwayat mutasi barang, serta opname stok.
* **Riwayat Transaksi & Laporan**: Pencarian transaksi, filter status pelunasan, pengiriman faktur via WhatsApp, dan ekspor laporan ke CSV/Excel.
* **Price List & Menu Publik**: Rute publik (`/pricelist`) untuk pelanggan memindai QR tanpa login, terintegrasi tombol etalase Shopee resmi.
* **Sistem Notifikasi Pengunjung**: Pemberitahuan otomatis ke ponsel dan perangkat tim saat ada pelanggan yang membuka price list atau mengunjungi Shopee.
* **Pembaruan Aplikasi Real-Time**: Sinkronisasi pembaruan rilis langsung di latar belakang tanpa mengharuskan pengguna login ulang.
* **Hak Akses Pengguna (RBAC)**: Pembagian wewenang berbasis peran (*Owner*, *Admin*, *Staff*, dan *Developer*).

---

## Teknologi

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
* **Basis Data & Autentikasi**: Google Firebase (Cloud Firestore & Authentication).
* **Fungsi Serverless**: Vercel Edge Serverless Functions.
* **Notifikasi**: OneSignal Web Push SDK & REST API.
* **Pemrosesan Dokumen**: jsPDF dan html2canvas (diproses langsung di sisi klien).

---

## Panduan Instalasi & Pengembangan Lokal

### Prasyarat
* Node.js versi 18 atau lebih baru
* npm atau bun

### Langkah Menjalankan
1. Pasang dependensi proyek:
   ```bash
   npm install
   ```

2. Konfigurasi file lingkungan:
   Buat file `.env` di direktori utama dan lengkapi konfigurasi Firebase dan OneSignal:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
   ONESIGNAL_REST_API_KEY=your_onesignal_rest_key
   ```

3. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:8080` (atau port yang ditentukan Vite).

4. Menjalankan pengujian:
   ```bash
   npm test -- --run
   ```

5. Menjalankan build produksi:
   ```bash
   npm run build
   ```

---

## Dokumentasi Teknis

Rincian mendalam mengenai arsitektur, skema basis data, dan operasional tersedia pada folder `docs/`:

* [Arsitektur & Desain Sistem](docs/ARCHITECTURE.md)
* [Kamus Basis Data & Skema Firestore](docs/DATABASE_SCHEMA.md)
* [Sistem Notifikasi & Pelacakan Pengunjung](docs/NOTIFICATION_SYSTEM.md)
* [Panduan Deployment & Operasional](docs/DEPLOYMENT_AND_OPERATIONS.md)
* [Pedoman Pengembangan & SOP Rilis](AGENTS.md)

---

## Lisensi
Hak Cipta © Tanabrew Roastery. Seluruh hak cipta dilindungi.
