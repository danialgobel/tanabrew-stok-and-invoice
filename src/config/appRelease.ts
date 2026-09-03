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
  version: "3.1.1",
  versionLabel: "v3.1.1",
  releaseDate: "3 September 2026",
  title: "Hotfix Obrolan Tim & Resiliensi Pemulihan Layar Crash",
  subtitle: "Perbaikan Fungsi handleRefresh di /obrolan dan Tombol Navigasi Pemulihan Darurat Error Boundary",
  highlights: [
    {
      title: "Fix Runtime Error Obrolan Tim (handleRefresh)",
      desc: "Memperbaiki kendala pemanggilan fungsi pembaruan status anggota tim di tab /obrolan sehingga halaman dimuat secara instan tanpa memicu layar kendala rendering.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Resiliensi Pemulihan Layar Crash (Error Boundary)",
      desc: "Menyempurnakan mekanisme pemulihan crash dengan proteksi loop re-render dan menambahkan tombol instan 'Kembali ke Beranda' agar pengguna tidak pernah terjebak saat terjadi kendala data.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Ruang Obrolan Tim & Koordinasi Langsung Antar-Anggota",
      desc: "Kini staf, barista, admin, dan owner dapat memilih anggota tim langsung dari carousel atau modal tim untuk berkoordinasi secara privat, atau kembali ke grup koordinasi umum tim hanya dengan 1 tap.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Bulletproof Member Discovery (Anti Layar Kosong)",
      desc: "Menyempurnakan penemuan anggota tim di tab Obrolan dengan multi-tier discovery (akun aktif, Firestore listeners, dan agregasi log aktivitas) sehingga seluruh anggota tim selalu tampil lengkap dengan indikator status online yang akurat.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Eliminasi Bug Duplikasi Pesan (Double Write Fix)",
      desc: "Memperbaiki sinkronisasi pengiriman pesan antara Firestore client dan Serverless API, memastikan setiap pesan hanya tercatat tepat 1 kali tanpa duplikasi pesan di riwayat obrolan.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Akselerasi & Bounded Listener Tab Riwayat",
      desc: "Pemuatan mutasi stok dan log aktivitas di Riwayat kini dibatasi pada 80 catatan terbaru dengan pengurutan Firestore terindeks, melipatgandakan performa rendering dan menghemat memori perangkat.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Proteksi Dobel Klik Cetak & Pull-to-Refresh Halus",
      desc: "Tombol Cetak Ulang PDF kini dilengkapi pengunci status loading guna mencegah klik berulang yang tidak disengaja, dan gestur tarik-layar (pull-to-refresh) di Riwayat memperbarui data secara instan tanpa reload browser penuh.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Keandalan State Loading Tombol Transaksi",
      desc: "Seluruh handler form di Cetak Invoice dan Update Stok dilindungi blok finally yang menjamin status loading tombol selalu kembali normal sekalipun terjadi kendala jaringan.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Fix Tuntas: Popup Dokumen Invoice di HP (React Portal)",
      desc: "Memperbaiki masalah CSS containing block di HP dengan merender modal langsung ke root dokumen via React Portal. Menekan kartu atau tombol Detail di HP kini memunculkan bottom sheet rincian invoice secara seketika dan halus tanpa layar kosong/blur.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Bulletproof User Discovery di Developer Center",
      desc: "Menyempurnakan pemuatan daftar akun tim di Developer Center dengan 4-tier discovery (Admin SDK, Firestore REST, dan agregasi cerdas dari log aktivitas & invoice) sehingga daftar pengguna selalu tampil lengkap bebas error izin database.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Bebas Masalah Scroll di HP",
      desc: "Membuka modal detail di HP tidak lagi menyebabkan halaman latar belakang melompat ke paling atas, memberikan kenyamanan penelusuran riwayat yang lancar.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },

    {
      title: "Collapsible Mini/Full Sidebar Navigation",
      desc: "Sidebar navigasi desktop kini dapat diciutkan menjadi icon-only ramping (w-20) atau dimekarkan (w-64) dengan 1 tombol toggle dan status tersimpan otomatis di perangkat.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Tombol Pecahan Uang Cepat (Quick Cash Calculator)",
      desc: "Menghitung pembayaran kasir menjadi instan dengan tombol cepat: Uang Pas, 50k, 100k, 200k, dan 500k tanpa perlu mengetik angka manual di keyboard.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Animasi Spring Card & Micro-Interactions Ultra-Smooth",
      desc: "Efek hover kartu dengan fisika pegas (spring physics bezier), transisi elevasi bayangan halus, serta animasi masuk halaman yang semakin dinamis dan responsif.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Floating Glassmorphic Bottom Navigation Bar",
      desc: "Bilah navigasi bawah berbentuk kapsul melayang (Floating Glass Island) dengan efek frosted glass mewah dan indikator tab aktif khusus di layar Smartphone & Tablet.",
      badge: "Baru",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Staggered Waterfall Card Animations",
      desc: "Saat membuka Beranda, kartu profil, ticker aktivitas, ringkasan omzet, analitik toko, dan tabel stok muncul mengalir berurutan dari bawah ke atas secara bertingkat dan elegan.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Ultra-Smooth Liquid Skeleton Shimmer",
      desc: "Animasi loading kerangka data diperbarui dengan sapuan gelombang kilau cahaya cair (wave shimmer light) yang membuat proses muat data terasa instan dan premium.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Perbaikan Persistensi Tutup Kapsul Ticker",
      desc: "Memperbaiki tombol silang (✕) pada Kapsul Ticker agar aktivitas yang telah ditutup tersimpan permanen di memori lokal & cloud, sehingga tidak akan muncul kembali saat halaman direfresh.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Kapsul Ticker Aktivitas Baru (Ultra-Compact 1 Baris)",
      desc: "Menggantikan Activity Stack lama menjadi kapsul 1 baris ramping yang hemat ruang, rotasi otomatis per 2 detik, dan lampu indikator denyut real-time.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Navigasi Presisi Langsung ke Tab Aktivitas",
      desc: "Mengetuk tulisan 'Riwayat' pada Kapsul Ticker di halaman Beranda akan langsung membuka tab 'Aktivitas' di halaman Riwayat secara tepat tanpa salah tab.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Pop-up Detail Interaktif Seluruh UI Beranda",
      desc: "Seluruh kartu di Beranda (Profil Akun, Omzet Hari Ini, Total Transaksi, Produk Terjual, Total Produk, dan Stok Cabang Jogja & Lombok) dapat ditekan untuk melihat rincian pop-up lengkap beserta grafik dan status pembayarannya.",
      badge: "Baru",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Akses Resmi God Mode untuk Owner & Developer",
      desc: "Membuka hak akses menu God Mode untuk role Owner dan Developer, serta mencegah layar putih (blank screen) dengan fallback peringatan akses resmi.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Perlindungan ErrorBoundary Global (Bebas Layar Putih)",
      desc: "Membungkus seluruh aplikasi dengan Error Boundary untuk mencegah crash layar putih dan menyediakan pemulihan muat ulang cepat jika terjadi kendala data.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "QR / ID Card Panel & Price List Publik",
      desc: "Panel Price List publik untuk scan QR / ID Card pelanggan (/pricelist & /menu) tanpa perlu login, serta shortcut pengaturan Price List melalui 5-tap logo Tanabrew di Beranda.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Format Cetak PDF & Cetak Invoice Optimal",
      desc: "Optimalisasi cetak invoice & pricelist dengan tata letak dokumen yang rapi, presisi, dan konsisten di berbagai perangkat.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Sinkronisasi Versi & Pengaturan di Halaman Akun",
      desc: "Menampilkan versi aplikasi resmi di Halaman Akun dengan tombol untuk membaca riwayat catatan changelog kapan saja, serta pengaturan getaran sentuhan (haptic).",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
  ],
};
