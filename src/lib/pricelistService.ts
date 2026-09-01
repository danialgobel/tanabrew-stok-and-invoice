import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface PriceListSettings {
  image_url: string;
  updated_at?: unknown;
  updated_by?: string;
}

export const DEFAULT_PRICELIST_IMAGE =
  "https://raw.githubusercontent.com/danialgobel/price-list-id-card/main/images/pricelist.jpg";

export const DEFAULT_PRICELIST_SETTINGS: PriceListSettings = {
  image_url: DEFAULT_PRICELIST_IMAGE,
};

const DOC_REF = () => doc(db, "products", "config_pricelist");

/**
 * Fetch current price list settings from Firestore (with default fallback)
 */
export const getPriceListSettings = async (): Promise<PriceListSettings> => {
  try {
    const snap = await getDoc(DOC_REF());
    if (snap.exists()) {
      const data = snap.data();
      return {
        image_url: data.image_url || DEFAULT_PRICELIST_IMAGE,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
      };
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
        const data = snap.data();
        callback({
          image_url: data.image_url || DEFAULT_PRICELIST_IMAGE,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        });
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
  imageUrl: string,
  updatedByName?: string,
): Promise<void> => {
  await setDoc(
    DOC_REF(),
    {
      is_system_config: true,
      image_url: imageUrl,
      updated_at: serverTimestamp(),
      updated_by: updatedByName || "Owner",
    },
    { merge: true },
  );
};

/**
 * Fast client-side image compression (instant 50ms) to optimized JPEG
 */
export const processAndCompressImage = async (
  file: File,
  maxWidth = 1400,
  maxHeight = 2000,
  quality = 0.82,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Safety timeout in case browser file reader fails
    const timeout = setTimeout(() => {
      reject(new Error("Waktu proses gambar habis. Silakan pilih gambar lain."));
    }, 8000);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        try {
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
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } catch {
          resolve(e.target?.result as string);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Format gambar tidak dapat dibaca."));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Gagal membaca file dari perangkat."));
    };

    reader.readAsDataURL(file);
  });
};
