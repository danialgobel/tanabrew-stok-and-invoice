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
  version: "2.5.0",
  versionLabel: "v2.5.0",
  releaseDate: "2 September 2026",
  title: "Pembaruan Aplikasi Tanabrew",
  subtitle: "Peningkatan Performa & Fitur Interaktif Baru",
  highlights: [
    {
      title: "UI Halaman Beranda Interaktif",
      desc: "Seluruh kartu di Beranda (Profil Pengguna, Omzet Hari Ini, Transaksi, Terjual, Total Produk, dan Stok Cabang) kini dapat ditekan untuk melihat rincian pop-up detail lengkap.",
      badge: "Baru",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Kapsul Ticker Aktivitas Baru (1 Baris Ringkas)",
      desc: "Tampilan riwayat aktivitas kini lebih hemat tempat di layar Beranda, dengan rotasi halus per 2 detik dan tombol silang (✕) yang langsung responsif.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Navigasi Riwayat Tab Aktivitas Langsung",
      desc: "Mengetuk tombol 'Riwayat' pada Kapsul Ticker akan langsung membuka tab 'Aktivitas' di halaman Riwayat secara presisi tanpa salah tab.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Pemberantasan Bug & Peningkatan Kestabilan",
      desc: "Memperbaiki bug layar putih pada riwayat invoice serta mengoptimalkan sinkronisasi data real-time agar aplikasi lebih cepat dan ringan.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
  ],
};
