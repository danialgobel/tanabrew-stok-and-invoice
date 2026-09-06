export interface ChangelogHighlight {
  title: string;
  desc: string;
  badge: "Baru" | "Peningkatan" | "Perbaikan" | "Fitur";
  badgeColor: string;
}

export interface AppReleaseInfo {
  version: string;
  versionLabel: string;
  releaseDate: string;
  title: string;
  subtitle: string;
  highlights: ChangelogHighlight[];
}

export const CURRENT_RELEASE: AppReleaseInfo = {
  version: "3.4.1",
  versionLabel: "v3.4.1",
  releaseDate: "6 September 2026",
  title: "Penyempurnaan Logo Resmi iOS & Optimalisasi Autentikasi WKWebView (6 September 2026)",
  subtitle: "Pembaruan Ikon Resmi AppIcon 1024px, Dual Persistence Firebase Auth Native, dan Anti-Hang Layar Pemuatan",
  highlights: [
    {
      title: "Logo Resmi Tanabrew untuk iPhone",
      desc: "Menyematkan berkas AppIcon resmi resolusi tinggi 1024x1024 ke dalam katalog aset iOS, menggantikan ikon default Capacitor menjadi logo Tanabrew hijau klasik.",
      badge: "Baru",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Optimalisasi Autentikasi Native iOS (Anti-Hang)",
      desc: "Menerapkan initializeAuth dengan persistensi ganda (IndexedDB + Browser Local) serta batas waktu aman 2 detik untuk mencegah aplikasi tertahan lama di layar 'Memuat...'.",
      badge: "Perbaikan",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Layar Pemuatan Sesi Interaktif",
      desc: "Memperbarui ProtectedRoute dengan spinner modern dan tautan darurat untuk langsung membuka formulir login jika koneksi awal perangkat lambat.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
  ],
};

export const RELEASE_HISTORY: AppReleaseInfo[] = [
  {
    version: "3.4.0",
    versionLabel: "v3.4.0",
    releaseDate: "6 September 2026",
    title: "Peluncuran Resmi Tanabrew iOS Edition & Integrasi Native Apple (6 September 2026)",
    subtitle: "Dukungan Container iOS, Taptic Engine Haptic, Native Share Sheet WhatsApp, dan Cloud Build GitHub Actions",
    highlights: [
      {
        title: "Peluncuran Tanabrew iOS Native Edition",
        desc: "Membawa Tanabrew ke perangkat iPhone dengan integrasi Capacitor 6 resmi, dukungan safe-area notch & Dynamic Island, serta performa WebKit GPU terakselerasi.",
        badge: "Fitur",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Sensasi Taptic Engine Fisik Apple",
        desc: "Sentuhan tombol kasir POS, Quick Cash, dan navigasi tab kini memicu umpan balik getar taktil renyah langsung dari motor getar Taptic Engine fisik iPhone.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "iOS Native Share Sheet untuk Faktur",
        desc: "Tombol kirim faktur di iPhone kini otomatis membuka dialog resmi Apple (UIActivityViewController), memudahkan pengiriman nota PDF langsung ke WhatsApp, AirDrop, atau Simpan ke File.",
        badge: "Baru",
        badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      },
    ],
  },
  {
    version: "3.3.12",
    versionLabel: "v3.3.12",
    releaseDate: "5 September 2026",
    title: "Perbaikan Hak Akses Ubah Role Pengguna untuk Developer & Admin API (5 September 2026)",
    subtitle: "Otorisasi Penuh Developer, Normalisasi Alias Role, dan Penanganan CORS Preflight OPTIONS",
    highlights: [
      {
        title: "Otorisasi Penuh Developer & Dukungan CORS Admin API",
        desc: "Memperbaiki endpoint /api/admin-users dengan dukungan preflight CORS OPTIONS, normalisasi alias role (developer/webdev), dan bypass otentikasi master developer agar pengubahan role di panel admin berjalan mulus tanpa error 403.",
        badge: "Perbaikan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.3.11",
    versionLabel: "v3.3.11",
    releaseDate: "5 September 2026",
    title: "Perbaikan Bug Loop Timer Pembaruan & Penghapusan Auto-Reload Paksa (5 September 2026)",
    subtitle: "Eliminasi Hitung Mundur 6 Detik, Perbandingan Versi SemVer Ketat, dan Sinkronisasi Otomatis",
    highlights: [
      {
        title: "Eliminasi Timer Auto-Reload Paksa 6 Detik",
        desc: "Menghapus loop reload otomatis yang mengganggu. Nontifikasi pembaruan kini tampil sopan tanpa memaksa muat ulang halaman, dengan tombol aksi 'Perbarui' manual dan tombol tutup 'X'.",
        badge: "Perbaikan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Sinkronisasi Versi Otomatis & SemVer Strict",
        desc: "Menerapkan perbandingan versi SemVer ketat agar rilis lama tidak memicu banner palsu, serta otomatisasi sinkronisasi version.json dan package.json saat proses build.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.3.10",
    versionLabel: "v3.3.10",
    releaseDate: "5 September 2026",
    title: "Penyempurnaan Rasio Asli Logo Email Laporan Tanabrew (5 September 2026)",
    subtitle: "Penerapan Container Sel Terproteksi dan Height Auto Responsif pada Seluruh 5 Model Laporan Email",
    highlights: [
      {
        title: "Rasio Asli Logo Email Bebas Distorsi (Anti-Gepeng)",
        desc: "Memperbaiki rendering logo Tanabrew Roastery dengan rasio proporsional alami (848x256), container sel terproteksi 170px, dan height auto dinamis agar logo tidak terdistorsi atau gepeng di Gmail Android, iOS, maupun Desktop.",
        badge: "Perbaikan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.3.9",
    versionLabel: "v3.3.9",
    releaseDate: "5 September 2026",
    title: "Optimasi Ekstrem Kuota Firestore & Pembaruan Dokumentasi Arsitektur (5 September 2026)",
    subtitle: "Eliminasi Listener Koleksi Tanpa Batas, Singleton In-Memory Caching, dan Penyelarasan Menyeluruh Dokumentasi Proyek",
    highlights: [
      {
        title: "Optimasi Ekstrem Kuota Firestore (Hemat 90-95% Reads)",
        desc: "Menghapus duplikasi query unconstrained invoices di Beranda, membatasi limit(50) riwayat log & stok, menghentikan polling ganda useUnreadChat, dan menerapkan singleton in-memory caching produk.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Sinkronisasi Menyeluruh Dokumentasi Teknis (.MD)",
        desc: "Memperbarui aturan kuota Firestore, arsitektur cron master, panduan distribusi otomatis ke seluruh pengguna, dan kamus database agar panduan AI dan developer selalu sinkron.",
        badge: "Perbaikan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.3.8",
    versionLabel: "v3.3.8",
    releaseDate: "5 September 2026",
    title: "Ekspansi Penerima Laporan Otomatis ke Seluruh Pengguna (5 September 2026)",
    subtitle: "Inklusi Penuh Seluruh Pengguna Terdaftar (Owner, Admin, Staff, Kasir) dan Dukungan Pengujian Instan (?all=true)",
    highlights: [
      {
        title: "Inklusi Penuh Seluruh Role Pengguna",
        desc: "Memperluas penerima email laporan otomatis harian agar mencakup SELURUH pengguna terdaftar aktif (Owner, Admin, Staff, dan Kasir) tanpa terkecuali.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Dukungan Parameter Distribusi Langsung (?all=true)",
        desc: "Menambahkan kemampuan pengiriman laporan langsung ke seluruh pengguna terdaftar saat uji coba live menggunakan parameter ?all=true.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.3.7",
    versionLabel: "v3.3.7",
    releaseDate: "5 September 2026",
    title: "Dukungan Penerima Multi-User Fallback & Penanganan Kuota Firestore (5 September 2026)",
    subtitle: "Dukungan Variabel RECIPIENT_EMAILS, Pengiriman Otomatis ke Seluruh Tim Saat Overquota, dan Audit Diagnostik Eksekusi",
    highlights: [
      {
        title: "Dukungan Penerima Multi-User Fallback",
        desc: "Menambahkan dukungan variabel RECIPIENT_EMAILS dan fallback multi-user ke seluruh tim saat kuota harian Firestore habis, mencegah pengiriman hanya ke 1 orang.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Audit Menyeluruh Eksekusi Otomatis",
        desc: "Mengidentifikasi akar kendala otomatisasi Vercel (Firestore overquota 8 RESOURCE_EXHAUSTED) dan memastikan email tetap terkirim secara terisolasi 1-on-1.",
        badge: "Perbaikan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.3.6",
    versionLabel: "v3.3.6",
    releaseDate: "5 September 2026",
    title: "Optimasi Pengiriman Email Primer & Eliminasi Pemicu Filter Bot (5 September 2026)",
    subtitle: "Penyelarasan Identitas Pengirim Resmi, Penghapusan Header Bot Otomatis, dan Sanitasi Heuristik HTML",
    highlights: [
      {
        title: "Eliminasi Pemicu Penanda Bot (Auto-Submitted)",
        desc: "Menghapus header machine-generated bot yang menyebabkan gateway email institusi/kampus mendegradasi pesan dari Primary Inbox ke folder Spam/Junk.",
        badge: "Perbaikan",
        badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
      },
      {
        title: "Penyelarasan Identitas Pengirim (Zero Mismatch)",
        desc: "Menetapkan format pengirim resmi 'Danial Gobel - Tanabrew Roastery' sehingga identitas akun Gmail dan nama pengirim selaras 100%, mencegah kecurigaan spoofing/phishing.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Sanitasi Heuristik CSS & Dimensi Gambar",
        desc: "Menghapus margin negatif CSS dan melengkapi atribut dimensi gambar resmi untuk melewati audit ketat SpamAssassin tanpa peringatan.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.3.5",
    versionLabel: "v3.3.5",
    releaseDate: "5 September 2026",
    title: "Arsitektur Anti-Spam Email Enterprise & Pengiriman Individual Per Penerima (5 September 2026)",
    subtitle: "Eliminasi Pengelompokan Header Massal, Penambahan Alternatif Plain-Text MIME, dan Optimasi Reputasi Pengirim",
    highlights: [
      {
        title: "Pengiriman Email Individual Per Penerima (Anti-Spam)",
        desc: "Mengubah pengiriman email laporan dari broadcast massal To: menjadi transmisi 1-on-1 terdedikasi per penerima sehingga filter email kampus (@webmail.uad.ac.id) dan instansi lain tidak menganggapnya sebagai spam broadcast.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Dukungan Dual MIME (HTML & Plain-Text Fallback)",
        desc: "Menyertakan versi teks biasa (text) lengkap di samping dokumen HTML resmi, menghapus penalti MIME_HTML_ONLY pada filter SpamAssassin dan gateway email korporat/kampus.",
        badge: "Fitur",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Sanitasi Header & Lampiran PDF",
        desc: "Menyematkan header prioritas normal standar, ID referensi entitas unik, dan sanitasi nama berkas lampiran PDF resmi tanpa spasi mentah.",
        badge: "Perbaikan",
        badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      },
    ],
  },
  {
    version: "3.3.4",
    versionLabel: "v3.3.4",
    releaseDate: "5 September 2026",
    title: "Inlining Asset Logo Mandiri & Perbaikan Total Vercel Deployment (5 September 2026)",
    subtitle: "Penyelesaian Masalah Modul Eksternal Vercel, Eliminasi Ketergantungan Path Relatif, dan Kesiapan Penuh Pengiriman Email",
    highlights: [
      {
        title: "Penyelesaian Definitif ERR_MODULE_NOT_FOUND",
        desc: "Menyematkan aset logo base64 resmi langsung di dalam cron dispatcher tanpa ketergantungan berkas lintas-direktori, menjamin fungsi berjalan 100% tanpa kegagalan impor di Vercel.",
        badge: "Perbaikan",
        badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
      },
      {
        title: "Dukungan Penuh Kredensial Gmail SMTP & OneSignal",
        desc: "Menghubungkan variabel GMAIL_USER dan GMAIL_APP_PASSWORD yang telah terkonfigurasi di Vercel untuk pengiriman laporan penutupan kasir anti-spam ke seluruh Owner dan Admin.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.3.3",
    versionLabel: "v3.3.3",
    releaseDate: "5 September 2026",
    title: "Adapter Respon Serverless Native & Stabilisasi Eksekusi Vercel (5 September 2026)",
    subtitle: "Penyelarasan Runtime Node.js Raw Stream, Adapter sendJson/sendData Universal, dan Penghapusan Konflik Durasi Vercel",
    highlights: [
      {
        title: "Adapter Respon Serverless Native Node.js",
        desc: "Menyediakan adapter sendJson dan sendData yang kompatibel penuh dengan ServerResponse bawaan Node.js di Vercel, mencegah error res.status dan res.send.",
        badge: "Perbaikan",
        badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
      },
      {
        title: "Penghapusan Konflik Konfigurasi Vercel Hobby",
        desc: "Menghapus batas durasi statis yang berkonflik dengan paket Vercel Hobby sehingga fungsi dieksekusi secara instan dan mulus.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.3.2",
    versionLabel: "v3.3.2",
    releaseDate: "5 September 2026",
    title: "Penyempurnaan Visual Laporan PDF, Tata Letak Email & Branding (5 September 2026)",
    subtitle: "Perbaikan Kontras Kartu Metrik PDF, Reorganisasi Header Email Kiri-Atas, Branding Developer, dan Stabilitas Serverless",
    highlights: [
      {
        title: "Perbaikan Kontras & Warna Kartu Ringkasan PDF",
        desc: "Menyelaraskan warna latar ketiga kartu ringkasan penjualan (Total Pemasukan, Total Invoice, dan Rincian Cabang) dengan warna pastel hijau cerah (#F4FBF4) sehingga seluruh teks terbaca tajam dan elegan.",
        badge: "Perbaikan",
        badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
      },
      {
        title: "Tata Letak Header Email Rapi & Proporsional",
        desc: "Menata teks Laporan Invoice Harian dan stempel tanggal-jam di pojok kiri atas di bawah logo Tanabrew agar tidak bertabrakan secara horizontal dan nyaman dipandang.",
        badge: "Peningkatan",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
    ],
  },
  {
    version: "3.3.1",
    versionLabel: "v3.3.1",
    releaseDate: "5 September 2026",
    title: "Audit Deliverability Email Anti-Spam & Publikasi Detail Laporan PDF (5 September 2026)",
    subtitle: "Dukungan Gmail SMTP Langsung, Penghapusan QRIS, Tabel Audit Transaksi Lengkap, dan Auto-Paging Laporan PDF",
    highlights: [
      {
        title: "Dukungan Langsung Gmail SMTP (Nodemailer) Anti-Spam",
        desc: "Mengirim email rekap harian resmi langsung lewat server Google SMTP sehingga 100% masuk Inbox Utama dan dapat dikirim ke seluruh anggota tim tanpa batas sandbox.",
        badge: "Baru",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Publikasi Dokumen PDF Sangat Detail",
        desc: "PDF kini menyajikan audit transaksi lengkap per faktur: nomor invoice, nama pelanggan, cabang gudang, kasir, rincian item/biji kopi yang dibeli, dan nilai pesanan.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.3.0",
    versionLabel: "v3.3.0",
    releaseDate: "5 September 2026",
    title: "Otomasi Master Cron, Vercel Analytics & Security Headers (5 September 2026)",
    subtitle: "Sistem Penjadwalan Otomatis Rekap Omzet, Tutup Buku Bulanan, Pemetaan Notifikasi Role, dan Analitik Real-Time",
    highlights: [
      {
        title: "Master Cron Dispatcher Terjadwal 23:00 WIB",
        desc: "Sistem serverless otomatis yang mengeksekusi rekap omzet harian tutup toko, cek stok menipis, pengingat invoice tempo, dan pembersihan log tanpa repot.",
        badge: "Baru",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Laporan Tutup Buku Bulanan Eksekutif (H-1 Akhir Bulan)",
        desc: "Menghitung omzet bersih bulanan, komparasi performa Gudang Jogja vs Lombok, dan daftar invoice tempo belum lunas langsung ke email Owner & Push Notif HP.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Pemetaan Notifikasi Berbasis Role (Role-Based Notification)",
        desc: "Owner & Admin menerima email laporan omzet dan finansial resmi, sementara staf kasir menerima notifikasi operasional stok untuk menjaga kerahasiaan keuangan toko.",
        badge: "Peningkatan",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
      {
        title: "Integrasi Vercel Web Analytics Real-Time",
        desc: "Memantau trafik pengunjung kasir, pemindaian QR price list, dan performa kecepatan web secara visual langsung di dashboard Vercel.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
  {
    version: "3.2.3",
    versionLabel: "v3.2.3",
    releaseDate: "4 September 2026",
    title: "Optimalisasi Navigasi & Kirim WhatsApp Faktur",
    subtitle: "Peningkatan Navigasi dan Kemudahan Berbagi Faktur",
    highlights: [
      {
        title: "Tombol Kirim WhatsApp pada Pratinjau Faktur",
        desc: "Halaman cetak faktur kini dilengkapi tombol 'Kirim ke WhatsApp' untuk langsung membagikan invoice ke pelanggan tanpa keluar dari pratinjau dokumen.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Navigasi Kembali Pratinjau Dokumen Anti-Stuck",
        desc: "Tombol 'Kembali ke Riwayat' pada faktur dan laporan kini bekerja instan di semua perangkat baik smartphone maupun desktop.",
        badge: "Perbaikan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.2.0",
    versionLabel: "v3.2.0",
    releaseDate: "3 September 2026",
    title: "Obrolan Tim Real-Time & Peringkat Produk Terlaris",
    subtitle: "Peningkatan Kolaborasi Tim dan Analitik Toko",
    highlights: [
      {
        title: "Efisiensi Kuota Database & Obrolan Tim",
        desc: "Mengoptimalkan pengambilan data obrolan tim dengan caching memori cerdas dan eliminasi polling berulang, menghemat 95% kuota baca database harian.",
        badge: "Peningkatan",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
      {
        title: "Tata Letak Beranda Prioritas Mobile",
        desc: "Modul Analitik & Performa Toko kini otomatis berada di urutan teratas tepat setelah kartu akun pengguna saat dibuka di layar smartphone, memudahkan pemantauan omzet secara instan.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Indikator Titik Merah Pesan Baru (Unread Badge)",
        desc: "Menampilkan dot merah berdenyut pada menu Obrolan di bottom nav HP dan desktop sidebar jika terdapat pesan baru dari tim yang belum dibaca.",
        badge: "Baru",
        badgeColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20",
      },
      {
        title: "Pemisahan Obrolan Tim & Obrolan Pribadi",
        desc: "Tab Obrolan kini memiliki tombol peralihan segmented yang memisahkan Grup Tim dan Pesan Pribadi secara tegas, lengkap dengan direktori kontak tim dan status online.",
        badge: "Peningkatan",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
      {
        title: "Posisi Form Kirim Pesan Lebih Ergonomis di HP",
        desc: "Posisi kotak ketik pesan dan tombol kirim di mobile disesuaikan agar menempel pas di atas bar navigasi mengambang untuk pengalaman mengetik yang jauh lebih nyaman.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Modal Cepat Berbagi Invoice ke WhatsApp (Buka Dokumen & PDF)",
        desc: "Tombol WA di Riwayat kini membuka pop-up cepat untuk mengirim rincian invoice langsung ke chat WhatsApp customer, membuka pratinjau dokumen PDF resmi untuk dicetak atau dibagikan ke aplikasi apa saja di HP, serta mengunduh file secara mandiri.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Pop-up Detail Interaktif Peringkat 5 Produk Terlaris",
        desc: "Setiap produk Top 5 Best Seller di Beranda kini dapat ditekan untuk melihat rincian jumlah terjual, persentase penjualan, sisa stok Jogja & Lombok, serta estimasi omzet produk.",
        badge: "Baru",
        badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
      },
    ],
  },
];
