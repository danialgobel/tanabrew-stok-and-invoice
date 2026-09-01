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
  version: "2.6.0",
  versionLabel: "v2.6.0",
  releaseDate: "2 September 2026",
  title: "Pembaruan Visual & Animasi Mewah",
  subtitle: "Floating Glass Navigation, Waterfall Staggered Cards & Ultra-Smooth Liquid Shimmer",
  highlights: [
    {
      title: "Floating Glassmorphic Bottom Navigation Bar",
      desc: "Bilah navigasi bawah kini berbentuk kapsul melayang (Floating Glass Island) dengan efek frosted glass mewah, penanda tab aktif yang mulus bersinar, dan respon getaran haptic yang memikat.",
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
      desc: "Animasi loading kerangka data diperbarui dengan sapuan gelombang kilau cahaya berkilau (wave shimmer light) yang membuat proses muat data terasa sangat cepat dan modern.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Pop-up Detail Interaktif Seluruh UI Beranda",
      desc: "Seluruh kartu di Beranda (Profil Akun, Omzet Hari Ini, Total Transaksi, Produk Terjual, Total Produk, dan Stok Cabang Jogja & Lombok) kini dapat ditekan untuk melihat rincian pop-up lengkap beserta grafik dan status pembayarannya.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Kapsul Ticker Aktivitas Baru (Ultra-Compact 1 Baris)",
      desc: "Menggantikan Activity Stack lama menjadi kapsul 1 baris ramping yang hemat ruang, rotasi otomatis per 2 detik, lampu indikator berdenyut, dan tombol silang (✕) yang langsung responsif.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Navigasi Langsung ke Tab Aktivitas",
      desc: "Mengetuk tulisan 'Riwayat' pada Kapsul Ticker di halaman Beranda akan langsung membuka tab 'Aktivitas' di halaman Riwayat secara presisi tanpa salah tab.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Perbaikan Bug Kritis Layar Putih (Blank Screen)",
      desc: "Memperbaiki bug error format tanggal saat membuka halaman Riwayat maupun saat menekan ikon riwayat di navigasi bawah, sehingga riwayat transaksi dan mutasi stok dapat dimuat dengan stabil.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "QR / ID Card Panel & Price List Publik",
      desc: "Panel Price List publik untuk scan QR / ID Card pelanggan (/pricelist & /menu) tanpa perlu login, serta shortcut pengaturan Price List melalui 5-tap logo Tanabrew di Beranda.",
      badge: "Fitur",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
  ],
};
