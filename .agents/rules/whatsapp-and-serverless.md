# Aturan Serverless Functions Vercel & Sub-Sistem Otomasi WhatsApp

Setiap developer dan AI Coding Agent wajib mematuhi panduan ini untuk mencegah kegagalan build pada platform Vercel dan menjaga privasi serta keandalan WhatsApp kasir:

### 1. Batas Keras 12 Serverless Function Vercel (Hobby Tier)
* **DILARANG KERAS** menambah file serverless function baru di direktori `api/` secara sembarangan.
* Paket Vercel Hobby membatasi maksimal hanya **12 Serverless Functions** dalam satu deployment.
* Jika membutuhkan fungsionalitas baru untuk WhatsApp, gunakan mekanisme routing berbasis parameter `action` pada `api/whatsapp.ts` (seperti `status`, `config`, `pair-code`, `disconnect`, `sync_url`).
* Saat ini proyek menggunakan **10 fungsi**. Jangan menambah fungsi baru kecuali benar-benar mendesak dan telah menghitung kuota yang tersisa.

### 2. Penjagaan Keamanan Whitelist Grup WhatsApp
* Akun WhatsApp yang digunakan adalah akun operasional kasir pribadi/toko.
* **Dilarang** menghapus atau melewati pemeriksaan whitelist grup di `api/whatsapp-send.ts` dan `whatsapp-service/src/index.ts`.
* Pengiriman hanya diizinkan ke ID resmi:
  - `120363406655043675@g.us` (Sandbox / Uji Coba)
  - `120363422161770936@g.us` (Produksi Tanabrew Transaksi)

### 3. Integritas Format Dokumen PDF Kasir (100% Identik)
* Seluruh pencetakan dan pengiriman PDF wajib menggunakan `generateInvoicePdfBlob(invoice)` di `src/lib/invoicePdfGenerator.ts`.
* Saat menandai invoice LUNAS, jangan mengubah tata letak, margin (14 mm), warna header tabel (*Sage Green* `#A5D6A7`), atau rekening bank. Satu-satunya yang berubah adalah status LUNAS berwarna hijau (`#2E7D32`), jumlah dibayar = total, dan sisa = 0.

### 4. Standardisasi Hak Akses Pengguna
* Selalu gunakan `isAdminRole(userProfile?.role, currentUser?.email)` dari `src/lib/roleUtils.ts` untuk memeriksa hak akses pelunasan dan administrasi invoice.
* Hindari pengecekan string manual kaku seperti `role !== "admin" && role !== "owner"` yang dapat memblokir peran `developer`/`webdev`.

