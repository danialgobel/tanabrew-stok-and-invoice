import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export interface PriceListSettings {
  image_url: string;
  title: string;
  subtitle?: string;
  whatsapp_number: string;
  whatsapp_message?: string;
  instagram_username: string;
  instagram_url?: string;
  updated_at?: unknown;
  updated_by?: string;
}

export const DEFAULT_PRICELIST_SETTINGS: PriceListSettings = {
  image_url: "https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png",
  title: "Tanabrew Coffee & Roastery",
  subtitle: "Kopi pilihan berkualitas tinggi. Single Origin Filter & Roasted Beans Espresso.",
  whatsapp_number: "62895392770243",
  whatsapp_message: "Halo Tanabrew! Saya ingin bertanya dan memesan kopi dari Price List.",
  instagram_username: "tanabrew.id",
  instagram_url: "https://instagram.com/tanabrew.id",
};

const DOC_REF = () => doc(db, "system_settings", "pricelist");

/**
 * Fetch current price list settings from Firestore (with default fallback)
 */
export const getPriceListSettings = async (): Promise<PriceListSettings> => {
  try {
    const snap = await getDoc(DOC_REF());
    if (snap.exists()) {
      return { ...DEFAULT_PRICELIST_SETTINGS, ...snap.data() } as PriceListSettings;
    }
  } catch (err) {
    console.warn("Gagal memuat pengaturan price list dari Firestore:", err);
  }
  return DEFAULT_PRICELIST_SETTINGS;
};

/**
 * Real-time subscription to price list settings
 */
export const subscribePriceListSettings = (
  callback: (settings: PriceListSettings) => void,
): (() => void) => {
  return onSnapshot(
    DOC_REF(),
    (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_PRICELIST_SETTINGS, ...snap.data() } as PriceListSettings);
      } else {
        callback(DEFAULT_PRICELIST_SETTINGS);
      }
    },
    (err) => {
      console.warn("Snapshot error pada price list:", err);
      callback(DEFAULT_PRICELIST_SETTINGS);
    },
  );
};

/**
 * Save updated price list settings to Firestore
 */
export const savePriceListSettings = async (
  settings: Partial<PriceListSettings>,
  updatedByName?: string,
): Promise<void> => {
  await setDoc(
    DOC_REF(),
    {
      ...settings,
      updated_at: serverTimestamp(),
      updated_by: updatedByName || "Admin",
    },
    { merge: true },
  );
};

/**
 * Compress an image file in browser to maximum dimension & JPEG quality
 */
export const compressImageFile = async (
  file: File,
  maxWidth = 1600,
  maxHeight = 2200,
  quality = 0.85,
): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context tidak tersedia."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error("Gagal mengompres gambar."));
            }
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => reject(new Error("Gagal membaca gambar."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
};

/**
 * Upload Price List image to Firebase Storage (with Base64 fallback if storage bucket is restricted)
 */
export const uploadPriceListImage = async (file: File): Promise<string> => {
  const { blob, dataUrl } = await compressImageFile(file);

  try {
    if (storage) {
      const fileName = `pricelist/pricelist_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    }
  } catch (storageErr) {
    console.warn("Storage upload fallback to Data URL:", storageErr);
  }

  // Fallback to data URL
  return dataUrl;
};
