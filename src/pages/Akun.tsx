import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { triggerHaptic } from "@/lib/haptics";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
} from "@/lib/onesignal";
import {
  User,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  Terminal,
  Info,
  CheckCircle2,
  Lock,
} from "lucide-react";

const Akun = () => {
  const { userProfile, currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifState, setNotifState] = useState(() => getNotificationPermissionState());
  const [updatingNotif, setUpdatingNotif] = useState(false);

  const getInitials = (name?: string, email?: string) => {
    const text = name || email || "User";
    return text
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "owner":
        return { label: "Owner", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
      case "admin":
        return { label: "Admin", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "webdev":
        return { label: "Developer (God Mode)", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      default:
        return { label: "Staff", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
  };

  const handleRequestNotification = async () => {
    triggerHaptic(15);
    setUpdatingNotif(true);
    try {
      const res = await requestNotificationPermission();
      setNotifState(res);
      if (res === "granted") {
        toast({ title: "Notifikasi Aktif", description: "Perangkat siap menerima pemberitahuan." });
      } else {
        toast({ title: "Status Notifikasi", description: `Izin notifikasi saat ini: ${res}` });
      }
    } catch {
      toast({ title: "Error", description: "Gagal meminta izin notifikasi", variant: "destructive" });
    } finally {
      setUpdatingNotif(false);
    }
  };

  const handleLogout = async () => {
    triggerHaptic(20);
    setLoggingOut(true);
    try {
      await logout();
      toast({ title: "Sampai jumpa", description: "Anda telah berhasil logout." });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Gagal logout", description: err.message, variant: "destructive" });
    } finally {
      setLoggingOut(false);
      setConfirmLogoutOpen(false);
    }
  };

  const roleInfo = getRoleBadge(userProfile?.role);

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-32 pt-6 space-y-4">
      {/* Header Profil */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl border border-primary/20 shrink-0">
            {getInitials(userProfile?.name, userProfile?.email)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-base font-bold text-foreground truncate">
              {userProfile?.name || currentUser?.displayName || "Pengguna Tanabrew"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">{userProfile?.email || currentUser?.email}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase ${roleInfo.class}`}>
              <Shield size={10} /> {roleInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan Hak Akses Peran */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Lock size={13} /> Hak Akses Peran Anda
        </h2>
        <div className="space-y-2 text-xs">
          {userProfile?.role === "owner" || userProfile?.role === "webdev" ? (
            <>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Kelola penuh stok produk, mutasi Jogja ⇄ Lombok, dan harga B2B.</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Edit invoice yang sudah dicetak / lunas dan hapus invoice dengan pengembalian stok.</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Akses laporan keuangan, spreadsheet, dan kirim arahan push notification.</span>
              </div>
            </>
          ) : userProfile?.role === "admin" ? (
            <>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Buat dan cetak invoice kasir, tandai status lunas.</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Akses laporan riwayat transaksi dan ekspor data CSV.</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Buat dan cetak invoice kasir penjualan kopi.</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>Melihat informasi ketersediaan stok Jogja dan Lombok (mode lihat).</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pengaturan Notifikasi Push */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Bell size={13} /> Pemberitahuan & Web Push
        </h2>
        <div className="flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-foreground">Status Izin Notifikasi</p>
            <p className="text-[11px] text-muted-foreground capitalize font-mono">{notifState}</p>
          </div>
          <button
            onClick={handleRequestNotification}
            disabled={updatingNotif}
            className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            {updatingNotif ? "Memeriksa..." : "Uji / Perbarui Izin"}
          </button>
        </div>
      </div>

      {/* Shortcut Khusus Developer */}
      {userProfile?.role === "webdev" && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-purple-600 dark:text-purple-400" />
              <p className="text-xs font-bold text-foreground">God Mode (Dev Center)</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(15);
                navigate("/god-mode");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Buka <ChevronRight size={13} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Pusat kendali database, pemindaian integritas data, dan alat pemeliharaan.</p>
        </div>
      )}

      {/* Info Aplikasi */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Info size={13} /> Tentang Aplikasi
        </h2>
        <div className="flex justify-between text-muted-foreground pt-1">
          <span>Versi Sistem</span>
          <span className="font-mono font-medium text-foreground">Tanabrew v2.4.0</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Database</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">Firebase Firestore Realtime</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Penyedia Web Push</span>
          <span className="font-medium text-foreground">OneSignal SDK v16</span>
        </div>
      </div>

      {/* Tombol Logout Resmi */}
      <button
        onClick={() => {
          triggerHaptic(15);
          setConfirmLogoutOpen(true);
        }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-3 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-colors"
      >
        <LogOut size={15} />
        Keluar dari Akun (Logout)
      </button>

      {/* Dialog Konfirmasi Logout */}
      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Keluar dari Akun?"
        description="Anda akan diarahkan kembali ke halaman login. Sesi kerja Anda pada perangkat ini akan diakhiri."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        danger={true}
        loading={loggingOut}
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
};

export default Akun;
