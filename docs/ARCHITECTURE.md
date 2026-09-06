# Arsitektur Sistem & Desain Perangkat Lunak Tanabrew

Dokumen ini mendokumentasikan cetak biru (*system blueprint*), prinsip desain antarmuka, alur data (*data flow*), serta teknologi yang digunakan pada aplikasi **Tanabrew Stock & Invoice**.

---

## 🏛️ 1. Gambaran Umum & Filosofi Desain

Aplikasi Tanabrew dirancang dengan paradigma **Dual-Responsive Hybrid Architecture**:
1. **Smartphone & Tablet (< 1024px)**:
   - Beroperasi seperti Progressive Web App (PWA) modern.
   - *Floating Glassmorphic Bottom Navigation Bar* melayang dengan indikator titik aktif dan efek blur kaca.
   - Gestur tarik-layar muat ulang (*Pull-to-Refresh*).
   - Drawer modal sentuh dari bawah (*Bottom Sheet Dialog*).
2. **Desktop & Laptop (≥ 1024px — Opsi 01 Enhanced)**:
   - Beroperasi sebagai SaaS Web POS & Enterprise ERP Dashboard.
   - *Permanent Collapsible Left Sidebar* yang dapat diciutkan (`w-20`) atau dilebarkan (`w-64`) lengkap dengan jam digital live.
   - Multi-Kolom 12-Grid di Beranda (8 kolom analitik/stok + 4 kolom profil & kontrol).
   - Katalog Kartu Visual POS (*Square Style Touch Tiles*) di kasir untuk transaksi 1-tap.
   - Master-Detail Split Pane di Riwayat Transaksi (5 kolom daftar + 7 kolom sticky preview faktur resmi).

---

## 💻 2. Tumpukan Teknologi (Technology Stack)

* **Frontend Framework**: React 18, TypeScript, Vite.
* **Routing**: React Router v6 (dengan proteksi rute berbasis role).
* **Styling & Design System**: Tailwind CSS v3, Shadcn UI primitives, Lucide Icons, Fisika Pegas Spring Bezier (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **State Management & Caching**:
  - TanStack React Query (untuk caching data produk dan inventaris).
  - React Context API (`AuthContext.tsx`) untuk manajemen sesi pengguna global.
* **Database & Cloud**: Google Firebase (Cloud Firestore Database, Firebase Authentication).
* **Serverless Backend (Edge Functions)**:
  - Vercel Serverless Functions (`/api/visitor-event.ts`, `/api/send-notification.ts`, `/api/pricelist.ts`).
* **Push Notifications**: OneSignal Web Push SDK + REST API.
* **Pembuatan Dokumen**: `jspdf` + `html2canvas` (100% diproses di browser klien tanpa API server).

---

## 🔄 3. Alur Data & Siklus Hidup Sesi (Session Lifecycle)

```mermaid
graph TD
    A[Pengguna Buka Web] --> B{Pemeriksaan Sesi Firebase Auth}
    B -->|IndexedDB Ada| C[Login Otomatis Instan]
    B -->|Tidak Ada| D[Halaman Login / Rute Publik]
    C --> E[Listener Firestore: system/app_version]
    E -->|Versi Baru Terdeteksi| F[AutoUpdateBanner Aktif]
    E -->|Versi Cocok| G[Akses Halaman Penuh Sesuai Role]
    G --> H[Kueri Realtime & Cache React Query]
```

### Karakteristik Penting:
1. **Ketahanan Sesi (IndexedDB Persistence)**:
   - Token login Firebase disimpan di storage `IndexedDB` browser pengguna.
   - Pembaruan aplikasi (*auto-update* / reload halaman) **tidak akan pernah me-logout pengguna**.
2. **Sistem Deteksi Pembaruan Real-Time (Zero-Relog)**:
   - `AutoUpdateBanner.tsx` memantau dokumen `system/app_version` di Firestore.
   - Begitu versi di-deploy ke Vercel/GitHub, seluruh perangkat pengguna yang sedang aktif akan memunculkan banner rilis baru secara otomatis.
   - Jika kasir sedang mengisi keranjang POS kasir, sistem auto-reload cerdas akan menunda reload sampai transaksi selesai dicetak demi menjaga data kasir.

---

## 🛡️ 4. Perlindungan Stabilitas Global (Anti-Blank Screen)

1. **Global Error Boundary (`src/components/ErrorBoundary.tsx`)**:
   - Seluruh hierarki komponen di `src/App.tsx` dibungkus oleh `<ErrorBoundary>`.
   - Jika terjadi kendala parsing data atau koneksi jaringan sesaat, aplikasi menampilkan antarmuka ramah *"Terjadi Kendala Sementara"* dengan tombol muat ulang cepat tanpa membuat layar menjadi putih kosong (*white screen*).
2. **Safe Optional Chaining**:
   - Semua akses objek wajib menggunakan chaining aman: `userProfile?.role`, `invoice.items?.map(...)`, dengan fallback default (`|| []`, `|| 0`, `|| ""`).
3. **Penyelarasan Waktu Terpusat (`src/lib/dateUtils.ts`)**:
   - Seluruh parsing tanggal transaksi, pembuatan nomor invoice (`INV/TNB/YYYY/MM/XXXX`), dan grafik omzet wajib mengacu pada fungsi pembantu di `dateUtils.ts`.

---

## ⚡ 5. Arsitektur Efisiensi Kuota Firestore & Master Cron Vercel

1. **Perlindungan Kuota Firebase Spark (Anti-Overquota)**:
   - **Bounded Listeners**: Seluruh kueri realtime ke `invoices` di Beranda dibatasi maksimal `limit(80)`, sedangkan `activity_logs` dan `stock_movements` di Riwayat dibatasi `limit(50)`.
   - **Eliminasi Listener Duplikat**: Menggabungkan listener duplikat pada halaman yang sama menjadi satu aliran data terpusat.
   - **Shared Memory Cache (`useProducts.ts`)**: Katalog produk kopi menggunakan *singleton module-level listener* sehingga navigasi antar-halaman membaca langsung dari memori (0 read tambahan).
   - **Visibility-Aware Polling (`useUnreadChat.ts`)**: Pengecekan pesan obrolan belum dibaca dibatasi setiap 60 detik dan otomatis berhenti saat tab diminimalkan / tidak aktif.

2. **Master Cron Dispatcher Vercel (`api/cron-dispatcher.ts`)**:
   - **Jadwal Eksekusi**: Berjalan otomatis sekali setiap hari pukul **23:00 WIB** via Vercel Cron (`0 16 * * *` UTC).
   - **Distribusi Otomatis ke Seluruh Pengguna**: Menarik seluruh akun aktif di koleksi `users` (Owner, Admin, Staff, Kasir) secara otomatis dari database tanpa perlu registrasi manual.
   - **Resilient Multi-User Fallback**: Jika kuota harian Firestore habis (`8 RESOURCE_EXHAUSTED`), fungsi otomatis mengalihkan penerima ke tim inti dan variabel environment `RECIPIENT_EMAILS` di Vercel agar email laporan harian tidak pernah gagal terkirim.

---

## 📱 6. Arsitektur Multi-Platform (Web PWA, Android, & iOS via Capacitor)

1. **Prinsip Single Source of Truth**:
   - Basis kode inti (90%) berada di `src/` (React + TypeScript).
   - Android (`android/`) dan iOS (`ios/`) adalah cangkang WebView yang disinkronkan melalui Capacitor:
     ```bash
     npm run build
     npx cap sync
     ```
2. **Isolasi Modul Sensitif Platform (10% Rawan Tabrakan)**:
   - **Pencetakan (*Printing*)**: `src/lib/printUtils.ts` mengisolasi Web print, Android printer, dan iOS AirPrint (iframe fallback). Komponen UI tidak boleh memiliki percabangan native inline.
   - **Notifikasi (*Push Notifications*)**: `src/lib/onesignal.ts` memisahkan Web Push Service Worker dengan antarmuka native.
   - **Penyimpanan/Unduh File**: Penanganan blob file web versus direct filesystem native.
3. **Pemberlakuan Fallback Otomatis**:
   - Kegagalan fitur native (misal: popup terblokir di iOS WKWebView) wajib otomatis mengalihkan pengguna ke standar web tanpa melempar error tak tertangani (*unhandled crash*).


