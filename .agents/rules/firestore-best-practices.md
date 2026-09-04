---
description: Aturan Kueri Firestore, Pencegahan Overquota & Optimasi Kuota Gratis (Spark Plan 50k Reads/Hari)
globs: ["src/lib/**/*.ts", "src/pages/**/*.tsx", "api/**/*.ts", "src/context/**/*.tsx", "src/hooks/**/*.ts"]
---

# Aturan Kueri Firestore & Perlindungan Kuota (Anti-Overquota)

Untuk menjaga basis data Cloud Firestore tetap stabil di bawah batas gratis Firebase Spark (50.000 Reads/hari & 20.000 Writes/hari):

1. **Wajib Membatasi Kueri Realtime & Riwayat (`limit`)**:
   - Kueri dokumen log audit `activity_logs` wajib menggunakan `limit(50)` atau `limit(10)`. Dilarang keras melakukan `onSnapshot(collection(db, "activity_logs"))` tanpa limitasi.
   - Kueri `stock_movements` wajib menggunakan `orderBy("created_at", "desc")` dan `limit(50)`.
   - Kueri dashboard `invoices` di halaman Beranda dibatasi maksimal `limit(80)`.

2. **Dilarang Keras Membuat Listener Duplikat Pada Halaman yang Sama**:
   - Jangan pernah mendaftarkan dua `onSnapshot` ke koleksi yang sama dalam satu file komponen (contoh: `Beranda.tsx` hanya boleh memiliki 1 listener faktur aktif).

3. **Optimasi Interval Polling & Background Check (Visibility-Aware)**:
   - Polling latar belakang (seperti pemeriksaan pesan obrolan belum dibaca di `useUnreadChat.ts`) wajib:
     - Menggunakan interval minimal 60 detik (bukan 10–12 detik).
     - Berhenti melakukan fetch saat tab browser sedang tidak aktif / diminimalkan (`document.visibilityState !== "visible"`).
     - Menggunakan singleton state agar tidak memicu fetch ganda dari komponen sidebar dan navbar sekaligus.

4. **Pemanfaatan Memory Cache Bersama (Shared Cache)**:
   - Data produk kopi di `useProducts.ts` menggunakan *singleton listener* di tingkat modul. Saat berpindah halaman (Beranda ➔ Stok ➔ POS Kasir ➔ Riwayat), data diambil langsung dari memori tanpa memicu fetch ulang ke Firestore.

5. **Ketahanan Serverless Cron Terhadap Overquota**:
   - Jika kuota harian Firestore habis (`8 RESOURCE_EXHAUSTED`), fungsi otomatis `api/cron-dispatcher.ts` wajib memiliki *resilient fallback* ke daftar email tim inti dan variabel `RECIPIENT_EMAILS` agar pengiriman email tidak gagal total.
