import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchWhatsAppStatus,
  saveWhatsAppTargetGroup,
  type WhatsAppStatusResponse,
} from "@/lib/whatsappClient";
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

  const isOwnerOrAdmin = userProfile?.role === "owner" || userProfile?.role === "admin" || userProfile?.role === "webdev";

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
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
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

                {/* QR Code display */}
                {statusData?.qrCode ? (
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border">
                    <img
                      src={statusData.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 object-contain rounded-lg"
                    />
                    <p className="text-[11px] text-slate-500 mt-2 font-medium flex items-center gap-1">
                      <QrCode size={13} />
                      Arahkan kamera WhatsApp Linked Devices ke QR ini
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-muted/40 rounded-xl border border-dashed text-xs text-muted-foreground">
                    <p>Memuat QR Code pairing...</p>
                    <p className="text-[10px] mt-1 text-muted-foreground/80">
                      Jika QR belum muncul, klik tombol &quot;Muat Ulang&quot; di atas.
                    </p>
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
