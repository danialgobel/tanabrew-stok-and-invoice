---
description: Aturan Wajib Manajemen Rilis & Pop-up Update Aplikasi Tanabrew
globs: ["src/**/*", "package.json", "src/config/appRelease.ts"]
---

# Aturan Wajib: Pembaruan Versi & Pop-up Update Aplikasi

Setiap kali melakukan perubahan kode (fitur baru, perbaikan bug, atau perubahan UI):
1. **Wajib memperbarui `src/config/appRelease.ts`**:
   - Naikkan versi aplikasi (`version` dan `versionLabel`, contoh: `v2.5.0` -> `v2.5.1`).
   - Perbarui tanggal rilis `releaseDate`.
   - Cantumkan **hanya poin pembaruan yang dikerjakan pada hari/versi tersebut (per hari)** secara jelas, singkat, dan padat pada `highlights` dengan badge yang sesuai ("Baru", "Peningkatan", "Perbaikan", "Fitur").
   - Pindahkan poin-poin rilis versi sebelumnya ke array `RELEASE_HISTORY` di `src/config/appRelease.ts` agar modal pop-up tetap fokus, ringkas, dan tidak menumpuk riwayat hari-hari yang lalu.
2. **Pop-up otomatis tunggal (anti-numpuk) di semua role & semua perangkat**:
   - Komponen `src/components/AppUpdateAnnouncementModal.tsx` akan mendeteksi perbedaan versi di `localStorage` dan menampilkan **1 pop-up tunggal versi terbaru** secara otomatis pada semua perangkat pengguna yang telah login di rute mana pun. Pop-up tidak akan menumpuk meskipun terjadi beberapa kali deploy berurutan.
