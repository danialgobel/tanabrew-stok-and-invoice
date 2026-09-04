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
};

export const RELEASE_HISTORY: AppReleaseInfo[] = [
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
