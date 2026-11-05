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
  version: "3.6.6",
  versionLabel: "v3.6.6",
  releaseDate: "5 November 2026",
  title: "Tombol Cetak & Kirim Otomatis Real-Time & Desain Faktur PDF Identik 100% (5 November 2026)",
  subtitle: "Penyelarasan visual PDF WhatsApp dengan cetakan kasir, tombol gabungan Cetak & Kirim Otomatis dengan sinkronisasi loading, serta kirim faktur tersimpan",
  highlights: [
    {
      title: "Desain PDF WhatsApp 100% Identik Cetakan Faktur Asli",
      desc: "Dokumen PDF yang dikirim ke grup WhatsApp kini membawa logo resmi Tanabrew, header tabel warna hijau sage (#A5D6A7), font, layout, dan instruksi rekening yang sama persis dengan cetak manual kasir.",
      badge: "Peningkatan",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Tombol 'Cetak & Kirim Otomatis' dengan Sinkronisasi Loading",
      desc: "Tombol cetak di Kasir dan Riwayat kini berlabel 'Cetak & Kirim Otomatis', menampilkan status loading 'Sedang Mencetak & Mengirim ke WhatsApp...' dan otomatis berubah hijau 'Terkirim ke WhatsApp ✅'.",
      badge: "Fitur",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Dukungan Kirim Otomatis untuk Faktur Baru Maupun Tersimpan",
      desc: "Baik pembuatan invoice baru di POS maupun pencetakan ulang invoice yang sudah jadi di Riwayat, file PDF langsung meluncur otomatis ke grup WhatsApp tanpa terhalang proteksi duplikasi.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
  ],
};

export const RELEASE_HISTORY: AppReleaseInfo[] = [
  {
    version: "3.6.5",
    versionLabel: "v3.6.5",
    releaseDate: "5 November 2026",
    title: "Perbaikan Pengiriman Dokumen PDF WhatsApp, Engine Anti-Collision, & Uji Kirim Berhasil (5 November 2026)",
    subtitle: "Penyempurnaan parser base64 PDF, patch model media WhatsApp Web anti-error memoize, dan verifikasi pengiriman PDF ke grup transaksi",
    highlights: [
      {
        title: "Perbaikan Pengiriman Dokumen PDF WhatsApp (Anti-Collision ID)",
        desc: "Menyelesaikan kendala internal WhatsApp Web ('Data passed to getter must include an id property') serta parser header datauri, sehingga file PDF invoice kasir terkirim mulus ke grup WhatsApp.",
        badge: "Perbaikan",
        badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      },
      {
        title: "Uji Pengiriman Teks & PDF Invoice Berhasil 100%",
        desc: "Uji coba pengiriman teks 'test bot automation tanabrew' dan file faktur PDF langsung terkirim dan terkonfirmasi masuk ke grup Tanabrew transaksi melalui akun WA kedua.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Auto-Patch Permanen & Shortcut Auto-Start Desktop",
        desc: "Patch otomatis permanen di microservice lokal serta shortcut berlogo Tanabrew di Desktop Windows siap menjaga bot tetap aktif otomatis di latar belakang saat laptop dinyalakan.",
        badge: "Baru",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
    ],
  },
  {
    version: "3.6.4",
    versionLabel: "v3.6.4",
    releaseDate: "5 November 2026",
    title: "Engine WhatsApp Web Chrome Anti-Blokir, Indikator Pengiriman PDF Real-Time, & Shortcut Desktop Otomatis (5 November 2026)",
    subtitle: "Transisi ke Engine Google Chrome Asli, Indikator Pengiriman PDF Anti-Miskomunikasi di Riwayat & Kasir, serta Shortcut Tanabrew Auto-Start di Desktop",
    highlights: [
      {
        title: "Engine WhatsApp Web Chrome Anti-Blokir (whatsapp-web.js)",
        desc: "Menggunakan Google Chrome resmi laptop yang bebas dari blokir WhatsApp 'tidak bisa menautkan perangkat'. Sesi tersimpan permanen di laptop tanpa perlu scan berulang.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Indikator Status Pengiriman PDF Real-Time (Anti-Miskomunikasi)",
        desc: "Banner konfirmasi dan badge pengiriman WhatsApp (Terkirim, Sedang Kirim, Gagal, Belum) hadir langsung di kartu invoice Riwayat & pratinjau POS lengkap dengan nama grup WhatsApp tujuan.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Shortcut Desktop Berlogo Tanabrew & Windows Auto-Start",
        desc: "Shortcut resmi berlogo Tanabrew di Desktop untuk Nyalakan, Matikan, dan Cek Status, serta otomatis berjalan di latar belakang saat laptop dinyalakan (Windows Startup).",
        badge: "Baru",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
    ],
  },
  {
    version: "3.6.3",
    versionLabel: "v3.6.3",
    releaseDate: "5 November 2026",
    title: "Otomasi Pengiriman WhatsApp Invoice Grup & Sistem Siaran Pembaruan Aplikasi (5 November 2026)",
    subtitle: "Pengiriman PDF Faktur Realtime ke Grup WhatsApp, Deteksi Server Laptop Cerdas, Opsi Kirim Manual Anti-Gagal, serta Notifikasi Siaran Pembaruan",
    highlights: [
      {
        title: "Otomasi Pengiriman PDF Faktur ke Grup WhatsApp & Deteksi Offline",
        desc: "Kirim PDF faktur beserta caption status (LUNAS / BELUM LUNAS) otomatis ke grup WhatsApp saat cetak invoice atau saat pelunasan oleh Owner.",
        badge: "Fitur",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
      {
        title: "Pemantau Status Server WhatsApp & Ganti Akun di Profil Akun",
        desc: "Kartu status server realtime (Online / Offline), nomor WhatsApp pengirim aktif, dan grup tujuan di menu Akun.",
        badge: "Peningkatan",
        badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
      },
      {
        title: "Siaran Notifikasi Pembaruan Aplikasi (App Update Push)",
        desc: "Fitur siaran notifikasi push OneSignal bagi Owner/Admin untuk menyiarkan info rilis versi terbaru Tanabrew langsung ke seluruh smartphone dan desktop karyawan dalam 1 klik.",
        badge: "Baru",
        badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
      },
    ],
  },
  {
    version: "3.6.2",
    versionLabel: "v3.6.2",
    releaseDate: "5 November 2026",
    title: "Pembaruan Rekening Pembayaran Resmi Bank Jago & Migrasi Total Aset Brand Mandiri (5 November 2026)",
    subtitle: "Standardisasi Rekening Pembayaran Utama Seluruh Dokumen Faktur & Kemandirian Aset Visual Tanabrew",
    highlights: [
      {
        title: "Standardisasi Rekening Utama Bank Jago",
        desc: "Memperbarui rekening pembayaran pada faktur menjadi Bank Jago 5021 3576 9162 a.n AHMAD FARID MUSADDAD.",
        badge: "Peningkatan",
        badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      },
    ],
  },
];
