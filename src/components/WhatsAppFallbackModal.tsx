import { useState } from "react";
import type { Invoice } from "@/types";
import { generateInvoicePdfBlob } from "@/lib/invoicePdfGenerator";
import { shareToWhatsAppOrNative } from "@/lib/nativeShare";
import { formatInvoiceDate } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Smartphone, AlertTriangle, X } from "lucide-react";

interface WhatsAppFallbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  errorMessage?: string;
}

export default function WhatsAppFallbackModal({
  open,
  onOpenChange,
  invoice,
  errorMessage,
}: WhatsAppFallbackModalProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  if (!invoice) return null;

  const formatCurrency = (val?: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { base64, fileName } = await generateInvoicePdfBlob(invoice);
      const byteCharacters = atob(base64.replace(/^data:application\/pdf;base64,/, ""));
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "PDF Berhasil Diunduh",
        description: `File ${fileName} siap diteruskan atau disimpan.`,
      });
    } catch {
      toast({
        title: "Gagal Mengunduh PDF",
        description: "Kendala memproses dokumen PDF.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleManualWhatsAppShare = () => {
    const itemsSummary = (invoice.items || [])
      .map((item) => `• ${item.nama_barang} (${item.jumlah} pcs) - ${formatCurrency(item.subtotal)}`)
      .join("\n");

    const statusBadge = invoice.status === "LUNAS" ? "🟢 LUNAS" : "🔴 BELUM LUNAS";

    const waText =
      `*FAKTUR / INVOICE TANABREW ROASTERY*\n\n` +
      `• *No. Invoice:* ${invoice.no_invoice || "-"}\n` +
      `• *Tanggal:* ${formatInvoiceDate(invoice)}\n` +
      `• *Customer:* ${invoice.customer || "Pelanggan"}\n` +
      `• *Gudang:* ${invoice.stock_location || "Jogja"}\n\n` +
      `*Rincian Belanja:*\n${itemsSummary}\n\n` +
      `*Total Tagihan: ${formatCurrency(invoice.total)}*\n` +
      `Jumlah Dibayar: ${formatCurrency(invoice.jumlah_dibayar)}\n` +
      `Status: *${statusBadge}*\n\n` +
      `_Terima kasih telah mempercayakan kebutuhan kopi Anda di Tanabrew! ☕_`;

    void shareToWhatsAppOrNative({
      title: `Invoice ${invoice.no_invoice}`,
      text: waText,
      dialogTitle: `Bagikan Invoice ${invoice.no_invoice}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Server WhatsApp Sedang Offline
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Laptop admin tidak aktif / mati lampu
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-1.5 text-amber-900 dark:text-amber-200">
            <p className="font-semibold text-foreground">
              Invoice <span className="font-mono text-primary font-bold">{invoice.no_invoice}</span> telah tersimpan aman!
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pengiriman otomatis ke grup belum dapat diproses karena server WhatsApp di laptop admin sedang tidak terhubung.
              {errorMessage && (
                <span className="block mt-1 text-[10px] text-muted-foreground/80 font-mono">
                  Info: {errorMessage}
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-border p-3 space-y-1 bg-muted/30">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-semibold text-foreground">{invoice.customer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Tagihan:</span>
              <span className="font-bold text-primary">{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status Pembayaran:</span>
              <span className={`font-bold ${invoice.status === "LUNAS" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {invoice.status === "LUNAS" ? "🟢 LUNAS" : "🔴 BELUM LUNAS"}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="font-semibold text-foreground text-xs">
              Silakan pilih metode kirim manual:
            </p>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="w-full py-2.5 px-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer text-xs"
            >
              <Download size={15} />
              {downloading ? "Menyiapkan PDF..." : "1. Unduh File PDF Faktur"}
            </button>

            <button
              type="button"
              onClick={handleManualWhatsAppShare}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all cursor-pointer text-xs"
            >
              <Smartphone size={15} />
              2. Buka WhatsApp untuk Teruskan Manual
            </button>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl text-muted-foreground hover:bg-muted text-xs font-semibold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

