# Aturan & SOP Pengembangan Multi-Platform (Web PWA, Android, iOS)

Dokumen ini adalah **pedoman wajib** untuk memastikan pembaruan kode pada salah satu platform (Web, Android, atau iOS) **tidak merusak atau memicu regresi (bug) pada platform lainnya**.

---

## 🏛️ 1. Prinsip Arsitektur: Single Source of Truth

* **90% Kode adalah Logika Bersama (*Shared Core*)**:
  - Seluruh kalkulasi stok Jogja & Lombok, alur POS kasir, formula omzet, integrasi Firestore, dan komponen tampilan UI berjalan di satu basis kode React + Vite.
* **10% Kode adalah Titik Rawan Tabrakan (*Platform Specific*)**:
  Hanya ada 3 modul yang memiliki perbedaan perilaku antar-platform:
  1. **Pencetakan (*Printing*)**: Browser print vs Android thermal printer vs iOS AirPrint / WKWebView.
  2. **Notifikasi (*Push Notifications*)**: OneSignal Web Push (Service Worker) vs Native Push SDK.
  3. **Unduh Berkas (*File Storage / PDF Export*)**: Browser Blob / Object URL vs Native FileSystem.

---

## 🛡️ 2. Tiga Aturan Emas Isolasi Platform

### Aturan 1: Isolasi Platform (*Platform Adapter Pattern*)
* **Dilarang Keras** menulis logika percabangan platform yang rumit langsung di dalam berkas UI halaman (seperti `Beranda.tsx`, `CetakInvoice.tsx`, `Riwayat.tsx`).
* Seluruh logika platform harus dibungkus dalam modul terisolasi di `src/lib/` (contoh: `src/lib/printUtils.ts`, `src/lib/onesignal.ts`).
* Gunakan deteksi platform resmi Capacitor:
  ```typescript
  import { Capacitor } from "@capacitor/core";

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
  ```
* **Karantina Perubahan**:
  - Jika memperbaiki bug iOS, modifikasi **hanya** blok `platform === 'ios'`.
  - Jika memperbaiki bug Android, modifikasi **hanya** blok `platform === 'android'`.
  - Blok default `web` harus tetap utuh dan terproteksi.

### Aturan 2: Prinsip *Graceful Fallback* (Anti-Crash)
* Setiap pemanggilan API native harus dibungkus dalam blok `try-catch` dan memiliki rencana cadangan (*fallback*) ke standar web.
* **Contoh Kasus Pencetakan (Printing)**:
  - Jika `window.print()` atau popup browser diblokir di iOS Safari / WKWebView, sistem wajib otomatis beralih ke *hidden iframe printing* atau unduhan PDF langsung.
  - Pengguna tidak boleh melihat layar putih (*blank screen*) atau tombol macet tanpa respon.

### Aturan 3: Alur Kerja Rilis Bertahap (*Web PWA First, Then Native*)
Jangan melakukan sinkronisasi atau perubahan native sebelum Web stabil. Ikuti urutan ini:
1. **Langkah 1 (Web & Web PWA)**:
   - Selesaikan perbaikan dan uji langsung di browser desktop dan mobile.
   - Pastikan `npm test -- --run` lolos (0 error).
   - Pastikan `npm run build` sukses (exit code 0).
2. **Langkah 2 (Sinkronisasi Capacitor)**:
   - Setelah Web terbukti stabil, jalankan sinkronisasi ke proyek native:
     ```bash
     npx cap sync
     ```
3. **Langkah 3 (Pengujian Perangkat Fisik)**:
   - Uji coba di Android / iOS hanya jika perubahan menyentuh modul native (AirPrint, Bluetooth printer, push notification native).

---

## 🧹 3. Pedoman Kebersihan Kode & Pemeliharaan File
1. **Hindari Pembengkakan File (*God Component Anti-Pattern*)**:
   - Komponen baru yang bersifat modal atau formulir mandiri wajib dibuat dalam berkas terpisah di `src/components/`, bukan ditumpuk inline di file halaman utama.
2. **Ukuran Ideal Komponen**:
   - Komponen baru idealnya berada di rentang **100 – 300 baris**.
   - Jika sebuah komponen mendekati 500 baris, pecah sub-bagiannya menjadi sub-komponen.
3. **Prinsip Stabilitas Operasional**:
   - *"Working software is the primary measure of progress."*
   - Jangan pernah melakukan *refactoring* massal sekaligus pada sistem kasir dan stok yang sedang berjalan stabil. Lakukan pemecahan kode secara bertahap dan terukur.
