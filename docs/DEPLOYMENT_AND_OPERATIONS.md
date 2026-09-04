# Panduan Deployment & Operasional Jangka Panjang (Deployment & Operations)

Dokumen ini berisi panduan konfigurasi lingkungan (*environment variables*), prosedur rilis (*deployment workflow*), serta langkah-langkah pemulihan data (*disaster recovery*) untuk **Tanabrew Stock & Invoice**.

---

## 🚀 1. Alur Rilis & Integrasi Berkelanjutan (CI/CD)

Repositori ini terhubung langsung dengan **Vercel** melalui GitHub:
1. Setiap commit yang di-push ke cabang `main` akan secara otomatis memicu proses build di Vercel:
   ```bash
   npm run build
   ```
2. Vercel menyebarkan aset produksi ke CDN Global dengan konfigurasi header pada `vercel.json`:
   - File `/version.json` dikonfigurasi dengan `Cache-Control: no-cache, no-store, must-revalidate` agar deteksi versi baru selalu instan.
   - File statis di `/assets/` dikonfigurasi dengan cache `immutable` 1 tahun demi performa muat secepat kilat.

---

## 🔑 2. Variabel Lingkungan (Environment Variables)

Pastikan variabel-variabel berikut terisi dengan benar di **Vercel Project Settings > Environment Variables**:

| Nama Variabel | Lokasi Digunakan | Deskripsi |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Frontend | Kunci API publik Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Domain auth Firebase |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | ID Proyek Firebase Tanabrew |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend | Bucket penyimpanan Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | Sender ID Firebase Cloud Messaging |
| `VITE_FIREBASE_APP_ID` | Frontend | ID Aplikasi Web Firebase |
| `VITE_ONESIGNAL_APP_ID` | Frontend & API | ID Aplikasi OneSignal |
| `ONESIGNAL_REST_API_KEY` | Serverless API | Kunci otorisasi pengiriman notifikasi OneSignal |

---

## 📦 3. SOP Rilis Versi Baru (Wajib Dipatuhi)

Sebelum melakukan `git push` rilis baru:

1. **Ubah Nomor Versi di `src/config/appRelease.ts`**:
   - Naikkan versi (misal: `3.2.6` ➔ `3.2.7`).
   - Perbarui `releaseDate` sesuai tanggal lokal Indonesia.
   - **Tulis highlights KHUSUS pembaruan hari tersebut**. Pindahkan highlights sebelumnya ke `RELEASE_HISTORY`.
2. **Sinkronkan `public/version.json`**:
   - Pastikan field `"version"` di `public/version.json` sama dengan `appRelease.ts`.
3. **Uji Kode Lokal (Wajib 0 Error)**:
   ```bash
   npm test -- --run
   npm run build
   ```
   *Kedua perintah di atas harus menghasilkan status sukses (exit code 0).*
4. **Push ke GitHub**:
   ```bash
   git add .
   git commit -m "feat/fix: deskripsi pembaruan [vX.X.X]"
   git push origin main
   ```

---

## 💾 4. Prosedur Cadangan & Pemulihan Data (Disaster Recovery)

Untuk menjamin kedaulatan data Tanabrew dalam jangka panjang:

### A. Pencadangan Rutin Mandiri (Bulanan)
1. Masuk ke halaman **God Mode** (`/godmode`) menggunakan akun dengan role `owner` atau `webdev`.
2. Pada panel utilitas basis data, klik tombol **"Download Full Backup JSON"**.
3. Simpan file cadangan tersebut ke Google Drive perusahaan Tanabrew.

### B. Pencadangan Riwayat Transaksi (Format Excel/CSV)
1. Masuk ke halaman **Riwayat** (`/riwayat`).
2. Gunakan tombol **Export CSV** untuk mencadangkan ringkasan faktur, nama pembeli, dan rincian omzet ke format spreadsheet.

### C. Pemulihan Data (*Restore*)
- Jika terjadi kesalahan input masal oleh kasir atau kendala teknis, file backup JSON dari GodMode dapat dipulihkan kembali melalui fitur *Restore Data* di halaman GodMode.
