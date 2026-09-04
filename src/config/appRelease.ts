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
  version: "3.2.4",
  versionLabel: "v3.2.4",
  releaseDate: "5 September 2026",
  title: "Pembaruan Tampilan Price List Pelanggan & Integrasi Shopee (5 September 2026)",
  subtitle: "Penyempurnaan Logo Resmi Tanabrew, Warna Khas Hijau Roastery, Tombol Shopee Official, dan Bebas Pop-up Pelanggan",
  highlights: [
    {
      title: "Header Price List Bersih & Elegan dengan Logo Resmi",
      desc: "Tampilan header menu/price list publik kini tampil bersih dan minimalis terfokus penuh pada kapsul logo resmi Tanabrew Roastery beresolusi tinggi.",
      badge: "Peningkatan",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Warna Hijau Khas Ciri Khas Tanabrew (#00512C)",
      desc: "Seluruh elemen visual, tombol, badge, dan aksen pada halaman price list telah diselaraskan dengan warna hijau tua khas Tanabrew Roastery.",
      badge: "Peningkatan",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Tombol Shopee Official Store",
      desc: "Menambahkan tombol cepat menuju etalase Shopee resmi Tanabrew lengkap dengan logo asli Shopee untuk memudahkan pelanggan bertransaksi secara online.",
      badge: "Fitur",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Bebas Pop-up Update untuk Pelanggan (QR & Link)",
      desc: "Notifikasi pembaruan aplikasi otomatis dinonaktifkan pada tautan QR dan URL Price List agar pengalaman membaca menu bagi pelanggan tetap bersih dan nyaman.",
      badge: "Perbaikan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
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
};
