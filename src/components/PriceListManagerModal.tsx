import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { triggerHaptic } from "@/lib/haptics";
import {
  getPriceListSettings,
  savePriceListSettings,
  processAndCompressImage,
  DEFAULT_PRICELIST_IMAGE,
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
  ExternalLink,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

interface PriceListManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PriceListManagerModal({
  open,
  onOpenChange,
}: PriceListManagerModalProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>(DEFAULT_PRICELIST_IMAGE);
  const [newImagePreview, setNewImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing settings when modal opens
  useEffect(() => {
    if (open) {
      void (async () => {
        setLoading(true);
        try {
          const data = await getPriceListSettings();
          if (data.image_url) {
            setCurrentImage(data.image_url);
            setNewImagePreview(data.image_url);
          }
        } catch {
          // fallback to default
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open]);

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

    setProcessing(true);
    triggerHaptic(15);

    try {
      // Fast client-side image compression (instant)
      const dataUrl = await processAndCompressImage(file);
      setNewImagePreview(dataUrl);
      triggerHaptic(25);
      toast({
        title: "Gambar Berhasil Dimuat",
        description: "Klik 'Simpan Gambar Baru' di bawah untuk menerapkan ke publik.",
      });
    } catch (err: any) {
      toast({
        title: "Gagal Memproses Gambar",
        description: err.message || "Terjadi kesalahan saat memproses gambar.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      // reset file input so selecting same file again still fires onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!newImagePreview) return;
    setSaving(true);
    triggerHaptic(20);

    try {
      await savePriceListSettings(newImagePreview, userProfile?.name || "Owner");
      setCurrentImage(newImagePreview);
      triggerHaptic(30);

      toast({
        title: "Gambar Price List Berhasil Diperbarui! 🎉",
        description: "Pelanggan yang memindai QR code akan langsung melihat gambar daftar harga terbaru.",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6 rounded-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                Ganti Gambar Price List
              </DialogTitle>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Rahasia 5-Tap
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Unggah gambar flyer daftar harga baru untuk mengganti gambar di halaman publik dan QR Code ID Card.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw size={20} className="animate-spin text-primary" />
            <span>Memuat data price list...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Image Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-primary" />
                  <span>Gambar Daftar Harga Saat Ini:</span>
                </label>
                <a
                  href="/pricelist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <ExternalLink size={11} /> Lihat Halaman
                </a>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="relative rounded-2xl border-2 border-dashed border-border p-3 bg-muted/20 flex flex-col items-center justify-center gap-3">
                {newImagePreview ? (
                  <div className="relative group w-full max-h-64 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                    <img
                      src={newImagePreview}
                      alt="Preview Price List"
                      className="max-h-64 w-auto object-contain rounded-lg shadow-sm"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-bold text-xs gap-2"
                    >
                      <Upload size={16} />
                      Pilih Gambar Lain
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs space-y-1">
                    <ImageIcon size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold">Belum ada gambar</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing || saving}
                  className="w-full py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={15} className={processing ? "animate-spin" : ""} />
                  {processing ? "Memproses Gambar Cepat..." : "Pilih / Ganti Gambar dari HP atau Laptop"}
                </button>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p>
                Tampilan website, tombol WhatsApp, dan Instagram tetap sama persis seperti di ID Card. Hanya gambar di atas yang akan berganti saat Anda menyimpan.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-border flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-1/3 py-2.5 rounded-xl bg-muted text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || processing || !newImagePreview || newImagePreview === currentImage}
                className="w-2/3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 shadow-sm transition-all"
              >
                <Save size={14} />
                {saving ? "Menyimpan ke Database..." : "Simpan Gambar Baru"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
