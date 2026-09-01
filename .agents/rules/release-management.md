---
description: Aturan Wajib Manajemen Rilis & Pop-up Update Aplikasi Tanabrew
globs: ["src/**/*", "package.json", "src/config/appRelease.ts"]
---

# Aturan Wajib: Pembaruan Versi & Pop-up Update Aplikasi

Setiap kali melakukan perubahan kode (fitur baru, perbaikan bug, atau perubahan UI):
1. **Wajib memperbarui `src/config/appRelease.ts`**:
   - Naikkan versi aplikasi (`version` dan `versionLabel`, contoh: `v2.5.0` -> `v2.5.1`).
   - Perbarui tanggal rilis `releaseDate`.
   - Rangkum perubahan menjadi 3-5 poin `highlights` dengan badge yang sesuai ("Baru", "Peningkatan", "Perbaikan", "Fitur").
2. **Pop-up otomatis muncul di semua role & semua perangkat**:
   - Komponen `src/components/AppUpdateAnnouncementModal.tsx` akan mendeteksi perbedaan versi di `localStorage` dan menampilkan pop-up secara otomatis pada semua perangkat pengguna yang telah login di rute mana pun.
