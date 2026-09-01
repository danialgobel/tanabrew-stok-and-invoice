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
  version: "3.0.2",
  versionLabel: "v3.0.2",
  releaseDate: "2 September 2026",
  title: "Akses Penuh Role Developer, Auto-Scroll Detail Riwayat & Manajemen User",
  subtitle: "Pemulihan Hak Cetak Developer, Klik Kartu & Detail Otomatis Scroll ke Atas, dan Pengelolaan User God Mode",
  highlights: [
    {
      title: "Hak Cetak Penuh untuk Role Developer",
      desc: "Role Developer (webdev) kini memiliki hak akses penuh untuk mencetak invoice di halaman Cetak Invoice maupun cetak ulang di Riwayat.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Klik Kartu Invoice & Detail Auto-Scroll",
      desc: "Menekan kartu invoice atau tombol Detail pada Riwayat kini secara instan memilih invoice dan menggulir (scroll) layar ke atas untuk menampilkan rincian dokumen lengkap.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Stabilitas Manajemen Pengguna God Mode",
      desc: "Memuat daftar user dan mengubah role pengguna (Staff, Admin, Owner, Dev) terhubung langsung ke database utama dengan cepat dan aman.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Perbaikan Akses & Manajemen User God Mode",
      desc: "Memperbaiki hak akses God Mode untuk Owner & Developer serta menstabilkan fitur pengelolaan role pengguna secara langsung.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Penyelarasan Alur Kerja Desktop & Mobile",
      desc: "Menjamin form dan alur kerja di Desktop 100% konsisten dan identik dengan versi Mobile, dengan optimasi layout layar yang luas, rapi, dan responsif.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Tata Letak Khusus Layar Desktop (Desktop Mode)",
      desc: "Saat dibuka di PC / Laptop, Tanabrew bertransformasi dengan Left Sidebar Navigation permanen, multi-kolom grid 12 kolom di Beranda, dan card list responsif di Riwayat.",
      badge: "Baru",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
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
