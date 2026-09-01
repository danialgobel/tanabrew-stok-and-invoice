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

const CACHE_KEY = "tanabrew_pricelist_img_cache";
const DOC_REF = () => doc(db, "products", "config_pricelist");

/**
 * Get cached image URL synchronously (prevents flash of default image)
 */
export const getCachedPriceListImage = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
};

/**
 * Set cached image URL
 */
export const setCachedPriceListImage = (url: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, url);
  } catch {
    // ignore
  }
};

/**
 * Fetch price list image for public customers (uses serverless API to bypass client permission rules)
 */
export const fetchPublicPriceListImage = async (): Promise<string> => {
  // 1. Try public serverless API endpoint
  try {
    const res = await fetch("/api/pricelist", { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      if (data?.image_url) {
        setCachedPriceListImage(data.image_url);
        return data.image_url;
      }
    }
  } catch {
    // Ignore and fallback to direct firestore
  }

  // 2. Direct Firestore fallback
  try {
    const snap = await getDoc(DOC_REF());
    if (snap.exists()) {
      const data = snap.data();
      if (data?.image_url) {
        setCachedPriceListImage(data.image_url);
        return data.image_url;
      }
    }
  } catch {
    // ignore
  }

  return getCachedPriceListImage() || DEFAULT_PRICELIST_IMAGE;
};

/**
 * Fetch current price list settings from Firestore (for admin panel)
 */
export const getPriceListSettings = async (): Promise<PriceListSettings> => {
  try {
    const snap = await getDoc(DOC_REF());
    if (snap.exists()) {
      const data = snap.data();
      const img = data.image_url || DEFAULT_PRICELIST_IMAGE;
      setCachedPriceListImage(img);
      return {
        image_url: img,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
      };
    }
  } catch (err) {
    console.warn("Gagal memuat pengaturan price list dari Firestore:", err);
  }
  const cached = getCachedPriceListImage();
  return {
    image_url: cached || DEFAULT_PRICELIST_IMAGE,
  };
};

/**
 * Real-time subscription to price list settings
 */
export const subscribePriceListSettings = (
  callback: (settings: PriceListSettings) => void,
): (() => void) => {
  // Immediate callback with cache if available
  const cached = getCachedPriceListImage();
  if (cached) {
    callback({ image_url: cached });
  }

  // Also fetch via public API
  void fetchPublicPriceListImage().then((img) => {
    if (img) callback({ image_url: img });
  });

  return onSnapshot(
    DOC_REF(),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const img = data.image_url || DEFAULT_PRICELIST_IMAGE;
        setCachedPriceListImage(img);
        callback({
          image_url: img,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        });
      }
    },
    (err) => {
      console.warn("Snapshot notice pada price list:", err.message);
      // Fallback via API
      void fetchPublicPriceListImage().then((img) => {
        callback({ image_url: img });
      });
    },
  );
};

/**
 * Save updated price list settings to Firestore & API (overwrites single record, 0 storage waste)
 */
export const savePriceListSettings = async (
  imageUrl: string,
  updatedByName?: string,
): Promise<void> => {
  setCachedPriceListImage(imageUrl);

  // 1. Direct Firestore write
  try {
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
  } catch (firestoreErr) {
    console.warn("Direct Firestore setDoc failed, attempting API fallback:", firestoreErr);
  }

  // 2. Call serverless API endpoint for synchronization
  try {
    await fetch("/api/pricelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        updated_by: updatedByName || "Owner",
      }),
    });
  } catch (apiErr) {
    console.warn("API sync failed:", apiErr);
  }
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
