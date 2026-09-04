# Kamus Basis Data & Skema Firestore (Database Schema)

Dokumen ini mendefinisikan struktur seluruh koleksi (*collections*), dokumen, field wajib, relasi, serta aturan optimasi kueri Google Firebase Cloud Firestore pada **Tanabrew Stock & Invoice**.

---

## 🗄️ 1. Struktur Koleksi Utama

```
firestore/
├── products/              # Katalog produk & inventaris stok multi-gudang
├── invoices/              # Dokumen faktur penjualan & kasir POS
├── activity_logs/         # Catatan audit aktivitas sistem & event pengunjung
├── team_chats/            # Pesan obrolan grup internal tim Tanabrew
├── direct_chats/          # Pesan obrolan pribadi antar staf/admin
├── users/                 # Profil pengguna, hak akses (RBAC), dan status tim
└── system/
    └── app_version        # Metadata versi rilis untuk sinkronisasi realtime
```

---

## 📋 2. Rincian Skema per Koleksi

### A. Koleksi `products`
Menyimpan katalog biji kopi specialty dan produk turunan dengan pelacakan stok independen per gudang.

| Field | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ya | Auto-generated ID dokumen Firestore |
| `name` | `string` | Ya | Nama produk (contoh: *"Arabica Gayo Natural 200g"*) |
| `category` | `string` | Ya | Kategori (*"Beans"*, *"Filter"*, *"Espresso"*, *"Capsule"*, dll.) |
| `price` | `number` | Ya | Harga jual standar (dalam Rupiah) |
| `stockJogja` | `number` | Ya | Jumlah stok fisik di Gudang Jogja |
| `stockLombok` | `number` | Ya | Jumlah stok fisik di Gudang Lombok |
| `minStock` | `number` | Tidak | Batas peringatan stok menipis (default: 5) |
| `description` | `string` | Tidak | Catatan profil rasa / deskripsi produk |
| `imageUrl` | `string` | Tidak | URL gambar produk (opsional) |
| `isActive` | `boolean` | Ya | Status aktif produk di katalog kasir POS |
| `updatedAt` | `timestamp` | Ya | Waktu terakhir data stok diubah |

---

### B. Koleksi `invoices`
Menyimpan transaksi kasir dan faktur penagihan pelanggan resmi.

| Field | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ya | ID dokumen Firestore |
| `invoiceNumber` | `string` | Ya | Format: `INV/TNB/YYYY/MM/XXXX` |
| `customerName` | `string` | Ya | Nama pelanggan / kedai kopi rekanan |
| `customerPhone` | `string` | Tidak | Nomor WhatsApp pelanggan |
| `warehouse` | `string` | Ya | Asal gudang (*"jogja"* atau *"lombok"*) |
| `cashierName` | `string` | Ya | Nama kasir/staf yang membuat faktur |
| `cashierId` | `string` | Ya | UID pengguna pembuat transaksi |
| `items` | `array<object>` | Ya | Daftar item yang dibeli (lihat sub-skema item) |
| `subtotal` | `number` | Ya | Total harga sebelum diskon/pajak |
| `discount` | `number` | Tidak | Nilai diskon (dalam Rupiah) |
| `totalAmount` | `number` | Ya | Total akhir yang wajib dibayar |
| `paymentMethod` | `string` | Ya | Metode bayar (*"cash"*, *"transfer"*, *"tempo"*) |
| `paymentStatus` | `string` | Ya | Status (*"lunas"*, *"pending"*, *"batal"*) |
| `createdAt` | `timestamp/string` | Ya | Tanggal pembuatan faktur |
| `notes` | `string` | Tidak | Catatan tambahan pada dokumen faktur |

**Sub-skema `items`:**
```json
{
  "productId": "string",
  "productName": "string",
  "price": 0,
  "quantity": 1,
  "subtotal": 0
}
```

---

### C. Koleksi `activity_logs`
Mencatat histori aktivitas operasional serta event interaksi pelanggan (kunjungan menu dan Shopee).

| Field | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `id` | `string` | Ya | ID dokumen |
| `title` | `string` | Ya | Judul log aktivitas |
| `description` | `string` | Ya | Detail deskripsi kejadian |
| `type` | `string` | Ya | Kategori: `"transaction"`, `"stock"`, `"visitor"`, `"system"` |
| `user` | `string` | Ya | Nama pelaku / `"Sistem"` / `"Pengunjung"` |
| `role` | `string` | Tidak | Role pengguna (jika user internal) |
| `timestamp` | `timestamp` | Ya | Waktu pencatatan (Server Timestamp) |

---

### D. Koleksi `system` (Dokumen `app_version`)
Digunakan oleh `AutoUpdateBanner.tsx` untuk sinkronisasi pembaruan tanpa logout (*zero-relog*).

| Field | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `version` | `string` | Ya | Nomor versi semantik (contoh: `"3.2.6"`) |
| `versionLabel` | `string` | Ya | Label versi (contoh: `"v3.2.6"`) |
| `releaseDate` | `string` | Ya | Tanggal rilis (contoh: `"5 September 2026"`) |
| `title` | `string` | Ya | Judul pembaruan |
| `updatedAt` | `timestamp` | Ya | Waktu rilis diperbarui |

---

## ⚡ 3. Aturan Optimasi Kueri & Anti-Overquota

Untuk menjaga agar aplikasi tetap beroperasi secara **100% gratis** di bawah kuota Firebase Spark (50.000 baca/hari):

1. **Selalu Gunakan Batasan Kueri (`limit`)**:
   - Kueri log aktivitas wajib membatasi hasil maksimal: `limit(10)` atau `limit(20)`.
   - Dilarang keras melakukan kueri `getDocs(collection(db, "activity_logs"))` tanpa `limit` dan tanpa filter tanggal.
2. **Kueri Riwayat Berdasarkan Tanggal**:
   - Halaman Riwayat menerapkan filter tanggal (`where("createdAt", ">=", startOfDay)`).
3. **Penyimpanan Gambar**:
   - Gambar statis dan aset price list diletakkan di `/public/` (CDN Vercel), **bukan** di Firebase Storage untuk menghemat biaya transmisi cloud.
