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
  version: "3.2.0",
  versionLabel: "v3.2.0",
  releaseDate: "3 September 2026",
  title: "Pembaruan Fitur & Antarmuka Tanabrew (3 September 2026)",
  subtitle: "Tata Letak Beranda Prioritas Mobile, Pemisahan Obrolan Tim & Pribadi, Modal Cepat WhatsApp, dan Pop-up Interaktif Top 5 Produk",
  highlights: [
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
      title: "Modal Cepat Berbagi Invoice ke WhatsApp (Share & PDF)",
      desc: "Tombol WA di Riwayat kini membuka pop-up cepat untuk mengirim rincian invoice langsung ke nomor WhatsApp customer, membagikan file PDF asli via Web Share HP, atau mengunduh dokumen PDF secara mandiri.",
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
};
