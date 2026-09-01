import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { triggerHaptic } from "@/lib/haptics";
import {
  getPriceListSettings,
  savePriceListSettings,
  uploadPriceListImage,
  DEFAULT_PRICELIST_SETTINGS,
  type PriceListSettings,
} from "@/lib/pricelistService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload,
  Image as ImageIcon,
  Save,
  QrCode,
  Eye,
  Settings,
  MessageCircle,
  Instagram,
  ExternalLink,
  Download,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface PriceListManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "edit" | "preview" | "qrcode";

export default function PriceListManagerModal({
  open,
  onOpenChange,
}: PriceListManagerModalProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("edit");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [form, setForm] = useState<PriceListSettings>(DEFAULT_PRICELIST_SETTINGS);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/pricelist` : "";

  // Load existing settings when modal opens
  useEffect(() => {
    if (open) {
      void (async () => {
        setLoading(true);
        try {
          const data = await getPriceListSettings();
          setForm(data);
          setImagePreview(data.image_url);
        } catch (err: any) {
          toast({
            title: "Gagal Memuat Pengaturan",
            description: err.message || "Gagal mengambil data dari server.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "File Tidak Valid",
        description: "Harap pilih file gambar (JPG, PNG, WEBP).",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    triggerHaptic(15);
    try {
      const uploadedUrl = await uploadPriceListImage(file);
      setImagePreview(uploadedUrl);
      setForm((prev) => ({ ...prev, image_url: uploadedUrl }));
      triggerHaptic(25);
      toast({
        title: "Gambar Berhasil Dipilih",
        description: "Klik 'Simpan Perubahan' di bawah untuk menerapkan ke publik.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal Memproses Gambar",
        description: err.message || "Terjadi kesalahan saat mengompres gambar.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    triggerHaptic(20);

    try {
      await savePriceListSettings(
        {
          image_url: form.image_url,
          title: form.title,
          subtitle: form.subtitle,
          whatsapp_number: form.whatsapp_number,
          whatsapp_message: form.whatsapp_message,
          instagram_username: form.instagram_username,
          instagram_url: `https://instagram.com/${(form.instagram_username || "tanabrew.id").replace("@", "")}`,
        },
        userProfile?.name || "Owner",
      );

      triggerHaptic(30);
      toast({
        title: "Price List Diperbarui! 🎉",
        description: "Seluruh pelanggan yang memindai QR code akan langsung melihat perubahan ini.",
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Gagal Menyimpan",
        description: err.message || "Pastikan koneksi internet stabil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      triggerHaptic(15);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({ title: "Link Disalin", description: "Tautan pricelist siap dibagikan." });
    } catch {
      // ignore
    }
  };

  // Generate QR Code URL via free reliable SVG api
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    publicUrl,
  )}&color=1B5E20`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-5 sm:p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                Pengaturan Price List Publik
              </DialogTitle>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Rahasia 5-Tap
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Ubah gambar flyer daftar harga dan kontak yang tampil saat pelanggan memindai QR Code ID Card.
          </DialogDescription>
        </DialogHeader>

        {/* TAB NAVIGATION */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/60 rounded-xl text-xs font-semibold mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "edit"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings size={13} />
            <span>Edit Data</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "preview"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye size={13} />
            <span>Pratinjau</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qrcode")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "qrcode"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode size={13} />
            <span>QR Code</span>
          </button>
        </div>

        {/* TAB 1: EDIT FORM */}
        {activeTab === "edit" && (
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Image Upload Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ImageIcon size={14} className="text-primary" />
                <span>Gambar Menu / Flyer Price List:</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="relative rounded-2xl border-2 border-dashed border-border p-3 bg-muted/20 flex flex-col items-center justify-center gap-3">
                {imagePreview ? (
                  <div className="relative group w-full max-h-56 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Preview Price List"
                      className="max-h-56 w-auto object-contain rounded-lg"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-bold text-xs gap-2"
                    >
                      <Upload size={16} />
                      Ganti Gambar Baru
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs space-y-1">
                    <ImageIcon size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold">Belum ada gambar terpilih</p>
                    <p className="text-[11px]">Pilih file flyer menu dari perangkat Anda</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <Upload size={14} className={uploadingImage ? "animate-spin" : ""} />
                  {uploadingImage ? "Memproses Gambar..." : "Unggah Gambar Flyer"}
                </button>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Judul Halaman:
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Tanabrew Coffee & Roastery"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Tagline / Deskripsi Singkat:
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="Kopi pilihan berkualitas tinggi..."
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* WhatsApp & Instagram Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <MessageCircle size={13} className="text-emerald-600" />
                  <span>Nomor WhatsApp:</span>
                </label>
                <input
                  type="text"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  placeholder="628123456789"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Instagram size={13} className="text-rose-500" />
                  <span>Username Instagram:</span>
                </label>
                <input
                  type="text"
                  value={form.instagram_username}
                  onChange={(e) => setForm({ ...form, instagram_username: e.target.value })}
                  placeholder="tanabrew.id"
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Pesan Default Saat Pelanggan Klik Chat WA:
              </label>
              <textarea
                value={form.whatsapp_message}
                onChange={(e) => setForm({ ...form, whatsapp_message: e.target.value })}
                rows={2}
                placeholder="Halo Tanabrew! Saya ingin bertanya dan memesan kopi..."
                className="w-full rounded-xl border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-border flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-1/3 py-2.5 rounded-xl bg-muted text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={saving || !form.image_url}
                className="w-2/3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 shadow-sm transition-all"
              >
                <Save size={14} />
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: LIVE PREVIEW */}
        {activeTab === "preview" && (
          <div className="space-y-3 pt-2">
            <div className="rounded-2xl border border-border bg-neutral-950 p-4 text-neutral-100 space-y-3 shadow-inner max-h-[60vh] overflow-y-auto">
              <div className="text-center space-y-1 pb-2 border-b border-neutral-800">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Simulasi Tampilan Pelanggan</p>
                <h4 className="text-sm font-bold text-white font-serif">{form.title}</h4>
                <p className="text-[11px] text-neutral-400">{form.subtitle}</p>
              </div>

              <div className="rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800">
                <img
                  src={form.image_url || DEFAULT_PRICELIST_SETTINGS.image_url}
                  alt="Live Preview"
                  className="w-full h-auto object-contain"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="p-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} />
                    <span>Pesan via WhatsApp</span>
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">+{form.whatsapp_number}</span>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 font-bold text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram size={16} className="text-rose-400" />
                    <span>Instagram @{form.instagram_username.replace("@", "")}</span>
                  </div>
                  <ExternalLink size={13} className="text-neutral-500" />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs">
              <a
                href="/pricelist"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold flex items-center gap-1"
              >
                <ExternalLink size={12} /> Buka Halaman Asli
              </a>
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className="px-3 py-1.5 rounded-lg bg-muted text-foreground font-semibold hover:bg-muted/80 text-xs"
              >
                Kembali ke Edit
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: QR CODE GENERATOR */}
        {activeTab === "qrcode" && (
          <div className="space-y-4 pt-2 text-center">
            <div className="p-5 rounded-2xl bg-white border border-border shadow-sm inline-block mx-auto">
              <img
                src={qrApiUrl}
                alt="QR Code Tanabrew Price List"
                className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">QR Code Menuju Price List</p>
              <p className="text-[11px] text-muted-foreground font-mono truncate px-4">
                {publicUrl}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2.5 px-3 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedLink ? "Disalin! ✓" : "Salin Tautan"}</span>
              </button>

              <a
                href={qrApiUrl}
                target="_blank"
                download="QR-Tanabrew-Pricelist.png"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download size={14} />
                <span>Unduh Gambar QR</span>
              </a>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl text-[11px] text-muted-foreground text-left space-y-1">
              <p className="font-bold text-primary">💡 Catatan ID Card & Meja:</p>
              <p>QR Code ini mengarah langsung ke halaman pricelist dinamis. Anda cukup mencetak QR ini sekali saja, dan gambarnya bisa Anda ganti kapan saja di tab &quot;Edit Data&quot; tanpa perlu cetak ulang!</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
