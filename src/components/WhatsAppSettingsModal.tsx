import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWhatsAppStatus,
  saveWhatsAppTargetGroup,
  disconnectWhatsAppSession,
  requestWhatsAppPairingCode,
  type WhatsAppStatusResponse,
} from "@/lib/whatsappClient";
import { isAdminRole } from "@/lib/roleUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Smartphone,
  Save,
  Server,
  QrCode,
  ShieldAlert,
  KeyRound,
  Phone,
} from "lucide-react";

interface WhatsAppSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WhatsAppSettingsModal({
  open,
  onOpenChange,
}: WhatsAppSettingsModalProps) {
  const { currentUser, userProfile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusData, setStatusData] = useState<WhatsAppStatusResponse | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [pairingMode, setPairingMode] = useState<"qr" | "code">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [requestingCode, setRequestingCode] = useState(false);

  const handleRequestPairingCode = async () => {
    if (!currentUser) return;
    let clean = phoneInput.replace(/\D/g, "");
    if (clean.startsWith("0")) {
      clean = "62" + clean.slice(1);
    } else if (clean.startsWith("8")) {
      clean = "62" + clean;
    }

    if (clean.length < 10) {
      toast({
        title: "Nomor Tidak Valid",
        description: "Masukkan nomor WhatsApp yang benar (contoh: 0857... atau 62857...).",
        variant: "destructive",
      });
      return;
    }

    setRequestingCode(true);
    try {
      const res = await requestWhatsAppPairingCode(currentUser, clean);
      setPairingCodeResult(res.pairingCode);
      toast({
        title: "Kode Berhasil Dibuat",
        description: "Buka WhatsApp di HP Anda dan masukkan kode 8 digit ini.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal Meminta Kode",
        description: err.message || "Pastikan nomor WA benar dan server aktif.",
        variant: "destructive",
      });
    } finally {
      setRequestingCode(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser) return;
    if (!window.confirm("Apakah Anda yakin ingin memutuskan akun WhatsApp ini dan menggantinya dengan akun baru?")) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectWhatsAppSession(currentUser);
      toast({
        title: "Koneksi Diputuskan",
        description: "Sesi WhatsApp berhasil dilepas. Silakan scan QR Code baru di bawah dengan akun WhatsApp Anda yang baru.",
      });
      void loadStatus(true);
    } catch (err: any) {
      toast({
        title: "Gagal Memutuskan",
        description: err.message || "Pastikan server WhatsApp aktif.",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(null);

  const loadStatus = useCallback(async (quiet = false) => {
    if (!currentUser) return;
    if (!quiet) setLoading(true);

    try {
      const data = await fetchWhatsAppStatus(currentUser);
      setStatusData(data);

      if (data.savedConfig?.target_group_id) {
        setSelectedGroupId((prev) => prev || data.savedConfig?.target_group_id || "");
      }
    } catch (err: any) {
      if (!quiet) {
        toast({
          title: "Gagal Memuat Status WhatsApp",
          description: err.message || "Pastikan koneksi internet stabil.",
          variant: "destructive",
        });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (open) {
      void loadStatus();
      // Poll every 6 seconds while modal is open (useful when waiting for QR scan)
      const timer = window.setInterval(() => {
        void loadStatus(true);
      }, 6000);
      setAutoRefreshInterval(timer);
    } else {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }

    return () => {
      if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    };
  }, [open, loadStatus]);

  const handleSaveGroup = async () => {
    if (!currentUser) return;
    if (!selectedGroupId) {
      toast({
        title: "Perhatian",
        description: "Pilih salah satu grup WhatsApp terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    const matchedGroup = statusData?.groups?.find((g) => g.id === selectedGroupId);
    const targetGroupName = matchedGroup?.name || "Grup WhatsApp";

    setSaving(true);
    try {
      await saveWhatsAppTargetGroup(currentUser, {
        target_group_id: selectedGroupId,
        target_group_name: targetGroupName,
      });

      toast({
        title: "Berhasil Disimpan",
        description: `Grup tujuan WhatsApp diatur ke "${targetGroupName}". Seluruh invoice PDF akan otomatis dikirim ke grup ini.`,
      });

      void loadStatus(true);
    } catch (err: any) {
      toast({
        title: "Gagal Menyimpan",
        description: err.message || "Terjadi kesalahan saat menyimpan grup.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isOwnerOrAdmin = isAdminRole(userProfile?.role, currentUser?.email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Smartphone size={20} />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Otomasi WhatsApp Invoice
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Konfigurasi akun pengirim dan grup tujuan penerima invoice PDF otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-3">
          {/* 1. Connection Status Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Status Koneksi</span>
              <button
                type="button"
                onClick={() => void loadStatus()}
                disabled={loading}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                Muat Ulang
              </button>
            </div>

            {statusData?.connected ? (
              <div className="flex items-start justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 gap-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">
                      WhatsApp Terhubung 🟢
                    </p>
                    <p className="text-muted-foreground">
                      Nomor: <span className="font-semibold text-foreground">{statusData.user?.id ? `+${statusData.user.id}` : "-"}</span>
                    </p>
                    {statusData.user?.name && (
                      <p className="text-muted-foreground">
                        Akun: <span className="font-semibold text-foreground">{statusData.user.name}</span>
                      </p>
                    )}
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {disconnecting ? "Memutuskan..." : "Ganti Akun"}
                  </button>
                )}
              </div>
            ) : statusData?.connecting ? (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-700 dark:text-amber-400">
                <RefreshCw className="animate-spin shrink-0" size={16} />
                <span>Sedang menghubungkan ke server WhatsApp...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-700 dark:text-rose-400">
                  <XCircle className="shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="font-bold">WhatsApp Belum Terhubung</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Scan QR Code di bawah menggunakan aplikasi WhatsApp di HP Anda (menu *Perangkat Tertaut*).
                    </p>
                  </div>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/60 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPairingMode("qr")}
                    className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pairingMode === "qr"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <QrCode size={13} />
                    <span>Scan QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPairingMode("code")}
                    className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pairingMode === "code"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <KeyRound size={13} />
                    <span>Kode 8 Digit (No HP)</span>
                  </button>
                </div>

                {pairingMode === "qr" ? (
                  /* QR Code display */
                  statusData?.qrCode ? (
                    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border">
                      <img
                        src={statusData.qrCode}
                        alt="WhatsApp QR Code"
                        className="w-48 h-48 object-contain rounded-lg"
                      />
                      <p className="text-[11px] text-slate-600 mt-2 font-medium flex items-center gap-1">
                        <QrCode size={13} />
                        Arahkan kamera WhatsApp Perangkat Tertaut ke QR ini
                      </p>
                      <p className="text-[10px] text-muted-foreground text-center mt-1">
                        Jika WhatsApp di HP menolak scan, beralihlah ke tab <b>Kode 8 Digit</b> di atas!
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-muted/40 rounded-xl border border-dashed text-xs text-muted-foreground">
                      <p>Memuat QR Code pairing...</p>
                      <p className="text-[10px] mt-1 text-muted-foreground/80">
                        Jika QR belum muncul, klik tombol &quot;Muat Ulang&quot; di atas.
                      </p>
                    </div>
                  )
                ) : (
                  /* Pairing Code display */
                  <div className="bg-muted/30 border border-border/70 rounded-xl p-3.5 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <Phone size={12} />
                        <span>Nomor WhatsApp Anda (Gunakan 62):</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          placeholder="contoh: 628123456789"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="flex-1 text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleRequestPairingCode}
                          disabled={requestingCode}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {requestingCode ? "Membuat..." : "Minta Kode"}
                        </button>
                      </div>
                    </div>

                    {pairingCodeResult ? (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-center space-y-1.5">
                        <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                          Kode Pairing WhatsApp Anda:
                        </p>
                        <div className="text-2xl font-black font-mono tracking-widest text-emerald-600 dark:text-emerald-400 select-all py-1">
                          {pairingCodeResult}
                        </div>
                        <div className="text-[11px] text-muted-foreground text-left space-y-1 pt-1 border-t border-emerald-500/15">
                          <p className="font-semibold text-foreground">Cara memasukkan di HP:</p>
                          <p>1. Buka WhatsApp di HP ➔ <b>Perangkat Tertaut</b>.</p>
                          <p>2. Ketuk <b>Tautkan Perangkat</b>.</p>
                          <p>3. Di layar kamera scan QR, ketuk <b>&quot;Tautkan dengan nomor telepon saja&quot;</b> di bagian bawah.</p>
                          <p>4. Masukkan kode 8 karakter di atas.</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Metode ini sangat disarankan jika scan kamera di HP sering gagal atau muncul peringatan limit. WhatsApp akan mengirimkan notifikasi resmi untuk memasukkan 8 karakter.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Target Group Selector */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Users size={16} className="text-primary" />
              <span>Grup WhatsApp Penerima Invoice</span>
            </div>

            {statusData?.savedConfig?.target_group_name && (
              <div className="text-xs bg-muted/60 rounded-lg p-2.5 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">Grup Aktif Saat Ini:</p>
                <p className="font-bold text-primary">
                  {statusData.savedConfig.target_group_name}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  ID: {statusData.savedConfig.target_group_id}
                </p>
              </div>
            )}

            {statusData?.connected ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="target-group-select" className="text-xs font-medium text-muted-foreground">
                    Pilih Grup WhatsApp:
                  </label>
                  <select
                    id="target-group-select"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    disabled={!isOwnerOrAdmin || saving}
                    className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Pilih Salah Satu Grup --</option>
                    {statusData.groups && statusData.groups.length > 0 ? (
                      statusData.groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} {group.participantCount ? `(${group.participantCount} anggota)` : ""}
                        </option>
                      ))
                    ) : (
                      <option disabled value="">
                        Tidak ada grup yang ditemukan di akun WhatsApp ini
                      </option>
                    )}
                  </select>
                </div>

                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    disabled={saving || !selectedGroupId}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    <Save size={14} />
                    {saving ? "Menyimpan Grup..." : "Simpan Grup Tujuan"}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Hubungkan akun WhatsApp di atas untuk memuat daftar grup WhatsApp yang tersedia.
              </p>
            )}
          </div>

          {/* 3. Operational Info Notice */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Server size={14} />
              <span>Cara Kerja Otomasi Invoice:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1 leading-relaxed">
              <li>Setiap kali tombol <strong>Cetak Invoice</strong> ditekan di kasir/riwayat, sistem otomatis membuat file PDF dan mengirimkannya ke grup WhatsApp di atas.</li>
              <li>Sistem dilengkapi pencegah duplikasi sehingga tidak akan mengirim invoice yang sama dua kali.</li>
              <li>Layanan ini berjalan di server cloud 24/7 tanpa membutuhkan laptop/HP Anda menyala terus.</li>
            </ul>
          </div>

          {!isOwnerOrAdmin && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <ShieldAlert size={16} className="shrink-0" />
              <span>Hanya Owner dan Admin yang memiliki hak untuk mengubah grup tujuan WhatsApp.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
