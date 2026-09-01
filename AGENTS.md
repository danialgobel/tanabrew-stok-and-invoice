# Pedoman Pengembangan AI Agent Tanabrew (Agent Development Guidelines)

Dokumen ini adalah instruksi wajib bagi semua AI Assistant / AI Coding Agent yang bekerja pada repositori **Tanabrew Stok & Invoice**.

---

## 🚨 ATURAN UTAMA: Manajemen Rilis & Pop-up Pemberitahuan Update (Wajib!)

Setiap kali Anda (AI Agent) melakukan pembaruan, menambahkan fitur baru, mengubah tampilan UI, atau memperbaiki bug pada proyek ini:

### 1. Wajib Memperbarui Konfigurasi Rilis (`src/config/appRelease.ts`)
Setiap rilis pembaruan **WAJIB** menaikkan versi dan memperbarui changelog di [src/config/appRelease.ts](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/config/appRelease.ts):
1. **Naikkan Nomor Versi (`version` & `versionLabel`)**:
   - Gunakan Semantic Versioning (contoh: `2.5.0` ➔ `2.5.1` untuk perbaikan bug / tweak, atau `2.6.0` untuk fitur baru).
2. **Perbarui Tanggal Rilis (`releaseDate`)**:
   - Tulis tanggal lokal Indonesia saat update dilakukan (contoh: `"2 September 2026"`).
3. **Perbarui Daftar Catatan Pembaruan (`highlights`)**:
   - Tampilkan **semua poin pembaruan** yang telah dikerjakan secara **jelas, singkat, dan padat** per item.
   - Kotak dialog pop-up sudah dilengkapi wadah scroll vertikal yang halus (*smooth scrolling*), sehingga semua fitur & perbaikan dapat dimasukkan tanpa terpotong.
   - Berikan badge yang sesuai untuk setiap poin:
     - `"Baru"` (untuk fitur baru)
     - `"Peningkatan"` (untuk optimalisasi / pembaruan UI)
     - `"Perbaikan"` (untuk bugfix / pembenahan)
     - `"Fitur"` (untuk kapabilitas fungsional baru)

---

## 🎯 Perilaku Sistem Pop-up Update (`AppUpdateAnnouncementModal.tsx`)

Sistem pop-up pembaruan dirancang untuk:
1. **Satu Modal Tunggal (Anti-Numpuk)**: Walaupun terjadi beberapa kali push/update berturut-turut, sistem hanya akan menampilkan **1 pop-up tunggal versi terbaru (`CURRENT_RELEASE`)**, tidak akan pernah menumpuk (*stacked*) beberapa jendela dialog sekaligus.
2. **Berlaku untuk Semua Role**: Muncul bagi `Owner`, `Admin`, `Staff`, maupun `Developer`.
3. **Berlaku di Semua Perangkat**: Tampil responsif di Smartphone (Android/iOS), Tablet, Laptop, dan Desktop.
4. **Berlaku di Semua Rute**: Akan otomatis muncul di halaman mana pun yang pertama kali dibuka oleh pengguna yang sudah login (baik halaman Beranda maupun direct link).
5. **Mencegah Pop-up Berulang**: Menggunakan `localStorage.getItem("tanabrew_seen_app_version")` sehingga setelah pengguna mengetuk *"Mengerti & Mulai Gunakan"*, pop-up tidak akan muncul lagi sampai Anda merilis versi baru berikutnya.
6. **Tersinkronisasi dengan Halaman Akun**: Teks versi di Halaman Akun ([src/pages/Akun.tsx](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/pages/Akun.tsx)) otomatis membaca dari `CURRENT_RELEASE.versionLabel` dan bisa diklik untuk membuka riwayat changelog kapan saja.

---

## 🏗️ Standar Pengujian Sebelum Commit
Sebelum melakukan commit dan push:
1. Jalankan pengujian unit:
   ```bash
   npm test -- --run
   ```
2. Jalankan pengujian build production:
   ```bash
   npm run build
   ```
3. Pastikan `0 error` dan seluruh pengujian lolos (`exited with code 0`).
