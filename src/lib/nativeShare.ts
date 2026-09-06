import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export interface NativeShareOptions {
  title?: string;
  text?: string;
  url?: string;
  phone?: string;
  dialogTitle?: string;
}

/**
 * Membagikan teks/dokumen faktur menggunakan iOS Native Share Sheet (UIActivityViewController)
 * pada iPhone, atau fallback ke web WhatsApp URL jika dijalankan di browser standar.
 */
export const shareToWhatsAppOrNative = async (options: NativeShareOptions): Promise<boolean> => {
  const {
    title = "Faktur Resmi Tanabrew",
    text = "",
    url,
    phone,
    dialogTitle = "Bagikan Faktur Tanabrew",
  } = options;

  // 1. Native iOS / Android via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title,
          text,
          url,
          dialogTitle,
        });
        return true;
      }
    } catch (error) {
      console.warn("Native Share Sheet dibatalkan atau terkendala:", error);
    }
  }

  // 2. Fallback ke WhatsApp Web / wa.me langsung
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "";
  const targetPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.substring(1) : cleanPhone;
  const waUrl = targetPhone
    ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;

  if (typeof window !== "undefined") {
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return true;
};
