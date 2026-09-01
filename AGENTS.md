# Pedoman Pengembangan AI Agent & Arsitektur Tanabrew (Agent Guidelines)

Dokumen ini adalah **panduan wajib (*mandatory SOP*)** bagi seluruh AI Assistant / AI Coding Agent dan Developer yang bekerja pada repositori **Tanabrew Stok & Invoice**.

---

## 🏛️ 1. Arsitektur & Teknologi Proyek

* **Core Framework**: React 18, Vite, TypeScript, React Router v6.
* **Database & Cloud**: Google Firebase (Firestore Database, Firebase Authentication, Server Timestamp).
* **State & Query**: TanStack React Query + React Custom Hooks & Context (`AuthContext.tsx`, `useProducts.ts`).
* **Styling & Design System**: Tailwind CSS + Vanilla CSS Tokens (`src/index.css`), Shadcn UI Primitives, Lucide Icons, Fisika Pegas Spring Bezier (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **Responsive Paradigm**:
  - **Smartphone & Tablet (< 1024px)**: *Floating Glassmorphic Bottom Navigation Bar* melayang (`BottomNav.tsx`), gesture tarik-layar muat ulang (`PullToRefresh.tsx`), dan dialog drawer layar sentuh.
  - **Desktop (≥ 1024px — Opsi 01 Enhanced)**: *Permanent Collapsible Left Sidebar* (`DesktopSidebar.tsx`), Multi-Kolom 12-Grid di Beranda, Split-Screen POS Touch Tiles di Cetak Invoice, dan Master-Detail Split Pane di Riwayat Transaksi.
* **Perlindungan Crash Global**: Aplikasi dibungkus oleh `<ErrorBoundary>` di `src/App.tsx` untuk mencegah *blank white screen* jika terjadi kendala data sementara.

---

## 🚨 2. ATURAN UTAMA: Manajemen Rilis & Pop-up Update (Wajib!)

Setiap kali Anda melakukan pembaruan, menambahkan fitur baru, mengubah tampilan UI, atau memperbaiki bug:

### A. Wajib Memperbarui Konfigurasi Rilis (`src/config/appRelease.ts`)
1. **Naikkan Nomor Versi (`version` & `versionLabel`)**:
   - Gunakan Semantic Versioning (contoh: `3.0.0` ➔ `3.0.1` untuk perbaikan bug / tweak, atau `3.1.0` untuk fitur baru).
2. **Perbarui Tanggal Rilis (`releaseDate`)**:
   - Tulis tanggal lokal Indonesia saat update dilakukan (contoh: `"2 September 2026"`).
3. **Perbarui Daftar Catatan Pembaruan (`highlights`)**:
   - Tuliskan **seluruh poin pembaruan** secara jelas, singkat, dan padat per item.
   - Pop-up modal sudah memiliki wadah scroll vertikal yang halus (*smooth scrolling*), sehingga seluruh poin pembaruan dapat dimuat tanpa terpotong.
   - Gunakan badge yang sesuai:
     - `"Baru"` (untuk fitur / tampilan baru)
     - `"Peningkatan"` (untuk optimalisasi UI & performa)
     - `"Perbaikan"` (untuk bugfix & pembenahan error)
     - `"Fitur"` (untuk kapabilitas fungsional baru)

### B. Perilaku Sistem Pop-up Update (`AppUpdateAnnouncementModal.tsx`)
1. **Satu Modal Tunggal (Anti-Numpuk)**: Walaupun terjadi beberapa update berturut-turut, sistem hanya akan menampilkan 1 modal pop-up versi terbaru (`CURRENT_RELEASE`).
2. **Berlaku untuk Semua Role & Device**: Muncul bagi `Owner`, `Admin`, `Staff`, dan `Developer` di semua jenis perangkat.
3. **Mencegah Pop-up Berulang**: Menggunakan `localStorage.getItem("tanabrew_seen_app_version")`. Setelah ditekan *"Mengerti & Mulai Gunakan"*, pop-up tidak akan muncul lagi sampai versi berikutnya dinaikkan.
4. **Tersinkronisasi dengan Halaman Akun**: Teks versi di Halaman Akun ([src/pages/Akun.tsx](file:///d:/Downloads/tanabrew-stok-and-invoice-github/src/pages/Akun.tsx)) otomatis membaca dari `CURRENT_RELEASE.versionLabel` dan dapat diklik untuk membuka changelog kapan saja.

---

## 🧭 3. Panduan Modul & Alur Kerja Halaman

### 1. `Beranda.tsx` (Dashboard & Analitik)
- **Tata Letak Desktop 12 Kolom**: Sisi kiri (8 kolom) menampung 4 Kartu Stok Gudang, Grafik Omzet Area 7 Hari, dan Tabel Inventaris Live. Sisi kanan (4 kolom) menampung Kartu Pengguna, Kapsul Ticker Aktivitas, Ringkasan Transaksi Hari Ini, dan Perintah Owner.
- **Kapsul Ticker Aktivitas**: Kapsul 1 baris ramping dengan rotasi otomatis 2 detik. Tombol silang (✕) menyimpan status tutup secara persisten di `localStorage` & Firestore sehingga tidak muncul kembali saat refresh.
- **Pop-up Interaktif**: Setiap kartu metrik dapat diklik untuk membuka modal pop-up detail, grafik omzet, dan rincian transaksi.

### 2. `CetakInvoice.tsx` (POS Kasir & Pembuat Faktur)
- **Katalog Produk Touch Tiles POS (Square Style)**: Menampilkan biji kopi dalam kartu visual dengan badge stok live Jogja/Lombok, pencarian real-time, filter kategori instan, dan 1-tap tambah ke keranjang kasir.
- **Dukungan Dua Mode Tampilan**: Kasir dapat beralih antara *Grid Katalog POS* atau *Form Baris Manual*.
- **Tombol Pecahan Uang Cepat (*Quick Cash*)**: Tombol instan `Uang Pas`, `50k`, `100k`, `200k`, `500k` di panel kanan untuk menghitung kembalian otomatis tanpa ketik manual di keyboard.
- **Penomoran Otomatis**: Format standar `INV/TNB/YYYY/MM/XXXX` terintegrasi dengan `src/lib/dateUtils.ts` dan `src/lib/invoiceNumber.ts`.

### 3. `Riwayat.tsx` (Master-Detail Split Pane & Laporan)
- **Master-Detail Split Pane di Layar Desktop**: Sisi kiri (5 kolom) memuat pencarian, filter tanggal/status, dan daftar kartu invoice. Sisi kanan (7 kolom sticky) menampilkan pratinjau dokumen faktur resmi secara seketika.
- **Aksi Dokumen Lengkap**: Tombol *Cetak Ulang PDF*, *Kirim WhatsApp*, *Tandai Lunas*, *Edit*, dan *Hapus Invoice* dapat diakses langsung tanpa pop-up modal bertumpuk.

### 4. `UpdateStok.tsx` (Inventaris Multi-Gudang & Price List PDF)
- Melacak stok independen untuk **Gudang Jogja** dan **Gudang Lombok**.
- Modul pencetakan Price List PDF A4 Full-Bleed kualitas cetak tinggi (`src/lib/pricelistPrint.ts`) dengan pemecahan nama produk otomatis (*auto-splitting*) dan mode pengisian manual.

### 5. `GodMode.tsx` (Dev Center & Super Admin)
- Dikhususkan bagi role `owner` dan `webdev`.
- Menampilkan terminal log audit, database explorer, tools backup/restore, dan integrasi WhatsApp client.

### 6. `PriceListPublic.tsx` (`/pricelist` & `/menu`)
- Halaman menu publik untuk scan QR / ID Card pelanggan tanpa perlu autentikasi/login.

---

## 🛡️ 4. Aturan Stabilitas Kode & Mencegah Error Layar Putih (Blank Screen)

1. **Gunakan Safe Optional Chaining**: Selalu gunakan `userProfile?.role`, `invoice.items?.map(...)`, dan nilai fallback default (`|| []`, `|| 0`, `|| ""`).
2. **Hindari `return null` pada Halaman Utama**: Jika otorisasi tidak terpenuhi, render komponen notifikasi ramah *"Akses Terbatas"* dengan tombol *"Kembali ke Beranda"*.
3. **Penyelarasan Date Parsing**: Gunakan selalu fungsi pembantu dari `src/lib/dateUtils.ts` (`formatInvoiceDate`, `toValidDateInputValue`, dll.) untuk memproses tanggal Firestore maupun string.
4. **Verifikasi Import React Hooks**: Pastikan `useState`, `useEffect`, `useMemo`, `useCallback`, dan `useRef` selalu diimpor dengan benar di baris teratas file komponen.

---

## 🏗️ 5. Standar Pengujian Sebelum Commit & Push

Sebelum melakukan commit dan push ke GitHub:
1. **Jalankan Pengujian Unit**:
   ```bash
   npm test -- --run
   ```
2. **Jalankan Pengujian Build Produksi**:
   ```bash
   npm run build
   ```
3. **Pastikan 0 Error**: Pastikan kedua perintah di atas selesai dengan status `exit code 0`.
4. **Patuhi Instruksi User**: Jika user meminta untuk mencoba di server lokal terlebih dahulu (*trial local*), jangan lakukan `git push` sampai user memberikan instruksi tegas untuk push.
