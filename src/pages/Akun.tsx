import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import WhatsAppSettingsModal from "@/components/WhatsAppSettingsModal";
import { triggerHaptic, isHapticEnabled, setHapticEnabled } from "@/lib/haptics";
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
  Camera,
  Trash2,
  Loader2,
  KeyRound,
  Mail,
  Smartphone,
  Store,
  Vibrate,
  HelpCircle,
  Pencil,
  ChevronDown,
  MessageSquare,
  Check,
  X,
  Sparkles,
} from "lucide-react";

const Akun = () => {
  const {
    userProfile,
    currentUser,
    logout,
    updateUserProfile,
    updateDisplayName,
    changeUserPassword,
    sendPasswordReset,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State dialog & loading
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifState, setNotifState] = useState(() => getNotificationPermissionState());
  const [updatingNotif, setUpdatingNotif] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Edit Name Modal
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Change Password Modal
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  // Operational preferences
  const [defaultWarehouse, setDefaultWarehouse] = useState<"Jogja" | "Lombok">(() => {
    return (localStorage.getItem("tanabrew_default_warehouse") as "Jogja" | "Lombok") || "Jogja";
  });
  const [hapticOn, setHapticOn] = useState(() => isHapticEnabled());
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Help FAQ expanded state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    if (userProfile?.name) {
      setNameInput(userProfile.name);
    }
  }, [userProfile?.name]);

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
        return { label: "Developer", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      default:
        return { label: "Staff", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
  };

  const handleWarehouseChange = (loc: "Jogja" | "Lombok") => {
    triggerHaptic(15);
    setDefaultWarehouse(loc);
    localStorage.setItem("tanabrew_default_warehouse", loc);
    toast({ title: "Gudang Default Disimpan", description: `Kasir/Invoice akan mengutamakan stok ${loc}.` });
  };

  const handleHapticToggle = () => {
    const next = !hapticOn;
    setHapticOn(next);
    setHapticEnabled(next);
    if (next) triggerHaptic(25);
    toast({
      title: next ? "Getaran Diaktifkan" : "Getaran Dinonaktifkan",
      description: next ? "Respon sentuhan tombol kini aktif." : "Respon getaran sentuhan dinonaktifkan.",
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Format Tidak Valid", description: "Pilih file gambar (JPG, PNG, WebP).", variant: "destructive" });
      return;
    }

    setUploadingPhoto(true);
    triggerHaptic(15);

    try {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            const minDim = Math.min(img.width, img.height);
            const startX = (img.width - minDim) / 2;
            const startY = (img.height - minDim) / 2;
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
            const base64 = canvas.toDataURL("image/jpeg", 0.85);

            await updateUserProfile({ photo_url: base64 });
            triggerHaptic(25);
            toast({ title: "Foto Profil Diperbarui", description: "Foto profil telah tersimpan dan tampil di seluruh aplikasi." });
          }
          setUploadingPhoto(false);
        };
        img.onerror = () => {
          toast({ title: "Error", description: "Gagal memproses gambar", variant: "destructive" });
          setUploadingPhoto(false);
        };
        img.src = readerEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Gagal Upload", description: err.message, variant: "destructive" });
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    triggerHaptic(15);
    try {
      await updateUserProfile({ photo_url: "" });
      toast({ title: "Foto Profil Dihapus", description: "Kembali menggunakan inisial nama akun." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    setSavingName(true);
    triggerHaptic(15);
    try {
      await updateDisplayName(nameInput.trim());
      triggerHaptic(25);
      toast({ title: "Nama Berhasil Diperbarui", description: `Nama profil diubah menjadi ${nameInput.trim()}` });
      setShowEditNameModal(false);
    } catch (err: any) {
      toast({ title: "Gagal Mengubah Nama", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password Terlalu Pendek", description: "Password baru minimal 6 karakter.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Password Tidak Cocok", description: "Konfirmasi password baru tidak sama.", variant: "destructive" });
      return;
    }

    setSavingPassword(true);
    triggerHaptic(15);
    try {
      await changeUserPassword(currentPassword, newPassword);
      triggerHaptic(25);
      toast({ title: "Kata Sandi Diperbarui", description: "Kata sandi akun Anda telah berhasil diganti." });
      setShowChangePasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
        ? "Kata sandi lama yang Anda masukkan salah."
        : err.message;
      toast({ title: "Gagal Mengganti Kata Sandi", description: msg, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    setSendingResetEmail(true);
    triggerHaptic(15);
    try {
      await sendPasswordReset();
      toast({
        title: "Link Reset Terkirim",
        description: `Link reset kata sandi telah dikirim ke ${currentUser?.email}. Periksa kotak masuk atau spam email Anda.`,
      });
    } catch (err: any) {
      toast({ title: "Gagal Mengirim Email", description: err.message, variant: "destructive" });
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleRequestNotification = async () => {
    triggerHaptic(15);
    setUpdatingNotif(true);
    try {
      const res = await requestNotificationPermission();
      setNotifState(res);
      if (res === "granted") {
        toast({ title: "Notifikasi Aktif", description: "Perangkat siap menerima pemberitahuan pesanan & stok." });
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

  const getDevicePlatform = () => {
    if (typeof navigator === "undefined") return "Perangkat Web";
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "Android Mobile";
    if (/iPhone|iPad|iPod/i.test(ua)) return "Apple iOS";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Mac/i.test(ua)) return "MacOS";
    return "Browser Web";
  };

  const roleInfo = getRoleBadge(userProfile?.role);

  const faqItems = [
    {
      q: "Bagaimana cara membuat dan mencetak invoice?",
      a: "Buka tab Invoice, pilih lokasi gudang (Jogja / Lombok), pilih produk kopi atau bahan, masukkan jumlah, isi nama pelanggan, lalu klik Simpan Invoice. Setelah tersimpan, Anda dapat mencetak struk atau invoice formal.",
    },
    {
      q: "Bagaimana cara melakukan transfer stok antar gudang?",
      a: "Buka tab Stok (Update Stok), klik tombol 'Transfer Stok (Jogja ⇄ Lombok)' di bawah tabel. Pilih produk, arah perpindahan, masukkan jumlah unit, lalu konfirmasi.",
    },
    {
      q: "Bagaimana cara menandai invoice yang sudah dibayar?",
      a: "Buka tab Riwayat, cari nomor invoice pelanggan, lalu klik tombol 'Tandai Lunas' pada invoice yang bersangkutan.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-36 pt-6 space-y-4">
      {/* 1. HERO PROFILE CARD ELEGAN */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {/* Avatar besar dengan cincin aksen */}
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl ring-4 ring-primary/20 overflow-hidden shadow-sm">
              {uploadingPhoto ? (
                <Loader2 size={28} className="animate-spin text-primary" />
              ) : userProfile?.photo_url ? (
                <img
                  src={userProfile.photo_url}
                  alt={userProfile.name || "Profil"}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(userProfile?.name, userProfile?.email)
              )}
            </div>
            <label
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              title="Ganti Foto Profil"
            >
              <Camera size={13} />
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
            </label>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-lg font-bold text-foreground truncate">
                {userProfile?.name || currentUser?.displayName || "Pengguna Tanabrew"}
              </h1>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setNameInput(userProfile?.name || currentUser?.displayName || "");
                  setShowEditNameModal(true);
                }}
                className="p-1 text-muted-foreground hover:text-primary rounded-full hover:bg-muted transition-colors"
                title="Edit Nama"
              >
                <Pencil size={13} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center justify-center sm:justify-start gap-1">
              <Mail size={12} className="shrink-0" />
              {userProfile?.email || currentUser?.email}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase ${roleInfo.class}`}>
                <Shield size={10} /> {roleInfo.label}
              </span>
              {userProfile?.photo_url && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[10px] text-destructive hover:underline font-semibold"
                >
                  Hapus Foto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick status bar */}
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3 text-xs border border-border/50">
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-primary" />
            <span className="font-semibold text-foreground">Tanabrew Coffee & Roastery</span>
          </div>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Online Realtime
          </span>
        </div>
      </div>

      {/* 2. GRUP AKUN & KEAMANAN (GROUPED INSET) */}
      <div className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
          <Lock size={13} /> Akun & Keamanan
        </h2>

        <div className="divide-y divide-border/60 text-xs">
          {/* Email Terdaftar */}
          <div className="flex items-center justify-between py-3 px-1">
            <div>
              <p className="font-semibold text-foreground">Email Terdaftar</p>
              <p className="text-muted-foreground text-[11px]">{currentUser?.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Check size={10} /> Terverifikasi
            </span>
          </div>

          {/* Ganti Kata Sandi */}
          <div className="flex items-center justify-between py-3 px-1">
            <div>
              <p className="font-semibold text-foreground">Kata Sandi Akun</p>
              <p className="text-muted-foreground text-[11px]">Ubah kata sandi login Anda</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(10);
                setShowChangePasswordModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/80 px-3 py-1.5 font-bold text-foreground hover:bg-muted transition-colors"
            >
              <KeyRound size={12} /> Ubah Sandi
            </button>
          </div>

          {/* Kirim Link Reset Password */}
          <div className="flex items-center justify-between py-3 px-1">
            <div>
              <p className="font-semibold text-foreground">Pemulihan Sandi</p>
              <p className="text-muted-foreground text-[11px]">Kirim tautan reset ke email</p>
            </div>
            <button
              onClick={handleSendResetEmail}
              disabled={sendingResetEmail}
              className="rounded-xl border border-border bg-muted/80 px-3 py-1.5 font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {sendingResetEmail ? "Mengirim..." : "Kirim Link Reset"}
            </button>
          </div>

          {/* Perangkat Sesi */}
          <div className="flex items-center justify-between py-3 px-1">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">Perangkat Sesi Saat Ini</p>
                <p className="text-muted-foreground font-mono text-[11px]">{getDevicePlatform()}</p>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">Sesi Aktif</span>
          </div>
        </div>
      </div>

      {/* 3. GRUP PREFERENSI TOKO & INVOICE */}
      <div className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
          <Store size={13} /> Preferensi Operasional
        </h2>

        <div className="space-y-3 text-xs">
          {/* Default Lokasi Gudang */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Gudang Utama Invoice</p>
              <span className="text-[11px] text-muted-foreground">Default saat buka faktur</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["Jogja", "Lombok"] as const).map((loc) => {
                const active = defaultWarehouse === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleWarehouseChange(loc)}
                    className={`rounded-2xl border p-3 font-bold transition-all text-center ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Gudang {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Respon Getaran (Haptic) */}
          <div className="flex items-center justify-between pt-2.5 border-t border-border/60 px-1">
            <div className="flex items-center gap-2">
              <Vibrate size={16} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">Respon Getaran Sentuhan (Haptic)</p>
                <p className="text-[11px] text-muted-foreground">Getaran ringan tombol pada HP</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleHapticToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                hapticOn ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  hapticOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Otomasi WhatsApp Invoice */}
          <div
            onClick={() => {
              triggerHaptic(15);
              setShowWhatsAppModal(true);
            }}
            className="flex items-center justify-between pt-2.5 border-t border-border/60 px-1 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Smartphone size={15} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Otomasi WhatsApp Invoice</p>
                <p className="text-[11px] text-muted-foreground">Koneksi akun & pemilihan grup penerima PDF</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 4. GRUP KOMUNIKASI & BANTUAN */}
      <div className="rounded-3xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
          <MessageSquare size={13} /> Komunikasi & Bantuan
        </h2>

        <div className="divide-y divide-border/60 text-xs">
          {/* Shortcut Ruang Obrolan */}
          <div
            onClick={() => {
              triggerHaptic(15);
              navigate("/obrolan");
            }}
            className="flex items-center justify-between py-3 px-1 cursor-pointer hover:bg-muted/30 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare size={15} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Ruang Obrolan Tim</p>
                <p className="text-muted-foreground text-[11px]">Buka grup percakapan staf Tanabrew</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-muted-foreground" />
          </div>

          {/* Izin Notifikasi Web Push */}
          <div className="flex items-center justify-between py-3 px-1">
            <div>
              <p className="font-semibold text-foreground">Status Izin Push Notifikasi</p>
              <p className="text-[11px] text-muted-foreground capitalize font-mono">{notifState}</p>
            </div>
            <button
              onClick={handleRequestNotification}
              disabled={updatingNotif}
              className="rounded-xl border border-border bg-muted/80 px-3 py-1.5 font-bold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {updatingNotif ? "Memeriksa..." : "Uji / Perbarui"}
            </button>
          </div>

          {/* FAQ Accordion */}
          <div className="py-2 space-y-2">
            <p className="font-semibold text-foreground text-xs px-1 pt-1">Panduan Pengoperasian Cepat:</p>
            {faqItems.map((item, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div key={idx} className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setExpandedFaq(isOpen ? null : idx);
                    }}
                    className="w-full flex items-center justify-between p-3 text-left font-semibold text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={14}
                      className={`text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 text-muted-foreground leading-relaxed border-t border-border/40 pt-2 text-[11px]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. SHORTCUT KHUSUS DEVELOPER CENTER */}
      {userProfile?.role === "webdev" && (
        <div className="rounded-3xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-purple-600 dark:text-purple-400" />
              <p className="text-xs font-bold text-foreground">Developer Center (Dev Tools)</p>
            </div>
            <button
              onClick={() => {
                triggerHaptic(15);
                navigate("/god-mode");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
            >
              Buka Panel <ChevronRight size={13} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Kendali database tingkat lanjut, auto-fix stok, dan audit riwayat.</p>
        </div>
      )}

      {/* 6. INFO SISTEM & LOGOUT */}
      <div className="rounded-3xl border border-border bg-card p-4 space-y-2 text-xs shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
          <Info size={13} /> Informasi Sistem
        </h2>
        <div className="flex justify-between text-muted-foreground pt-1 px-1">
          <span>Versi Aplikasi</span>
          <span className="font-mono font-bold text-foreground">Tanabrew v2.4.0 (Stable)</span>
        </div>
        <div className="flex justify-between text-muted-foreground px-1">
          <span>Database Realtime</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Firebase Firestore</span>
        </div>
        <div className="pt-2 text-center text-[10px] text-muted-foreground border-t border-border/40">
          Hak Cipta &copy; 2026 Tanabrew Trademark. Hak Cipta Dilindungi.
        </div>
      </div>

      {/* TOMBOL LOGOUT RESMI */}
      <button
        onClick={() => {
          triggerHaptic(15);
          setConfirmLogoutOpen(true);
        }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 py-3.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white transition-colors shadow-sm active:scale-98"
      >
        <LogOut size={15} />
        Keluar dari Akun (Logout)
      </button>

      {/* MODAL EDIT NAMA (MODERN BOTTOM SHEET / GLASS) */}
      {showEditNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowEditNameModal(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 border border-border shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center sm:hidden pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Ubah Nama Profil</h3>
              <button
                onClick={() => setShowEditNameModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nama Lengkap:</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowEditNameModal(false)}
                  className="rounded-xl bg-muted py-3 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingName || !nameInput.trim()}
                  className="rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {savingName ? "Menyimpan..." : "Simpan Nama"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GANTI PASSWORD (MODERN BOTTOM SHEET / GLASS) */}
      {showChangePasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowChangePasswordModal(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 border border-border shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center sm:hidden pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">Ubah Kata Sandi</h3>
              </div>
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Kata Sandi Saat Ini:</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Kata Sandi Baru (min 6 karakter):</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Konfirmasi Kata Sandi Baru:</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="rounded-xl bg-muted py-3 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword}
                  className="rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {savingPassword ? "Memproses..." : "Ganti Kata Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG KONFIRMASI LOGOUT */}
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

      {/* MODAL PENGATURAN OTOMASI WHATSAPP */}
      <WhatsAppSettingsModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
      />
    </div>
  );
};

export default Akun;
