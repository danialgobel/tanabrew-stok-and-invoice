---
description: Aturan Kueri Firestore, Pencegahan Overquota & Optimasi Kuota Gratis
globs: ["src/lib/**/*.ts", "src/pages/**/*.tsx", "api/**/*.ts", "src/context/**/*.tsx"]
---

# Aturan Kueri Firestore & Perlindungan Kuota

Untuk menjaga basis data Cloud Firestore tetap beroperasi di bawah batas gratis Firebase Spark:

1. **Wajib Membatasi Kueri Riwayat & Log (`limit`)**:
   - Kueri dokumen log audit `activity_logs` wajib menggunakan `limit(10)` atau `limit(20)`.
   - Dilarang keras melakukan `getDocs(collection(db, "activity_logs"))` tanpa limitasi dan tanpa filter rentang tanggal.

2. **Penyaringan Data Berdasarkan Tanggal**:
   - Untuk data transaksi faktur (`invoices`), selalu sertakan filter tanggal atau batas waktu agar tidak membaca seluruh transaksi dari awal tahun.

3. **Pemanfaatan Memory Cache**:
   - Data katalog produk memanfaatkan cache dari TanStack React Query agar tidak memicu fetch berulang saat pengguna berpindah tab/halaman.
