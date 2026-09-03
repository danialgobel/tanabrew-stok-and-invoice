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
  version: "3.1.2",
  versionLabel: "v3.1.2",
  releaseDate: "3 September 2026",
  title: "Pembaruan Stabilitas & Hotfix Realtime (3 September 2026)",
  subtitle: "Resolusi Tuntas Assertion Firestore, Pengiriman Pesan Resilien, dan Stabilisasi Tab Riwayat",
  highlights: [
    {
      title: "Resolusi Tuntas Assertion Error Firestore (ca9 / b815)",
      desc: "Mengeliminasi siklus churn/loop unmount-mount listener pada Firestore Web SDK dengan mengunci lifecycle listener dan memisahkan sync kehadiran (presence), mencegah crash assertion internal pada obrolan dan riwayat.",
      badge: "Perbaikan",
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    {
      title: "Pengiriman Pesan Tim Multi-Tier & Anti-Gagal",
      desc: "Mengintegrasikan fallback otomatis ke Serverless API jika Firestore client mengalami kendala, menjamin pesan obrolan selalu tersimpan dan notifikasi push terkirim tanpa error.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Stabilisasi Tab Riwayat (Zero Listener Churn)",
      desc: "Mengunci listener mutasi stok dan aktivitas dengan siklus hidup permanen (single-mount) dan in-memory sort yang aman tanpa memicu rendering error.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      title: "Ruang Obrolan Tim & Koordinasi Langsung Antar-Anggota",
      desc: "Staf, barista, admin, dan owner kini dapat memilih anggota tim dari carousel atau modal tim untuk berkoordinasi langsung secara privat, atau kembali ke obrolan grup tim dengan 1 tap.",
      badge: "Fitur",
      badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      title: "Resiliensi Pemulihan Layar Crash (Error Boundary)",
      desc: "Menyempurnakan Error Boundary dengan tombol instan 'Kembali ke Beranda' dan proteksi perulangan pemulihan agar pengguna tidak pernah terjebak jika terjadi kendala jaringan.",
      badge: "Peningkatan",
      badgeColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
  ],
};
