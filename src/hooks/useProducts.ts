import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/types";

// Shared module-level cache: Mencegah re-fetch produk saat berpindah halaman
let cachedProducts: Product[] = [];
let hasLoadedOnce = false;
const productSubscribers = new Set<(prods: Product[]) => void>();

let activeUnsubscribe: (() => void) | null = null;
let activeRefCount = 0;

const MOCK_PRODUCTS: Product[] = [
  { id: "prod-1", nama_barang: "Toraja Sapan 200g (Filter)", kategori: "Kopi Biji (Beans)", divisi: "Roastery", stok_jogja: 24, stok_lombok: 12, total_stok: 36, harga: 120000, harga_b2b: 105000 },
  { id: "prod-2", nama_barang: "Gayo Pantan Musara 200g", kategori: "Kopi Biji (Beans)", divisi: "Roastery", stok_jogja: 18, stok_lombok: 8, total_stok: 26, harga: 115000, harga_b2b: 100000 },
  { id: "prod-3", nama_barang: "Flores Bajawa Honey 200g", kategori: "Kopi Biji (Beans)", divisi: "Roastery", stok_jogja: 15, stok_lombok: 5, total_stok: 20, harga: 110000, harga_b2b: 95000 },
  { id: "prod-4", nama_barang: "Bali Kintamani Natural 200g", kategori: "Kopi Biji (Beans)", divisi: "Roastery", stok_jogja: 8, stok_lombok: 2, total_stok: 10, harga: 110000, harga_b2b: 95000 },
  { id: "prod-5", nama_barang: "House Blend Signature 1kg", kategori: "Kopi Biji (Beans)", divisi: "Roastery", stok_jogja: 35, stok_lombok: 15, total_stok: 50, harga: 280000, harga_b2b: 250000 },
  { id: "prod-6", nama_barang: "Drip Bag Coffee Box (5 sachet)", kategori: "Kopi Bubuk / Drip", divisi: "Roastery", stok_jogja: 40, stok_lombok: 20, total_stok: 60, harga: 75000, harga_b2b: 65000 },
  { id: "prod-7", nama_barang: "Cold Brew Concentrate 1 Liter", kategori: "Kopi Bubuk / Drip", divisi: "Roastery", stok_jogja: 12, stok_lombok: 0, total_stok: 12, harga: 145000, harga_b2b: 125000 },
  { id: "prod-8", nama_barang: "V60 Paper Filter 01 (100 pcs)", kategori: "Alat & Kemasan", divisi: "Warehouse", stok_jogja: 2, stok_lombok: 1, total_stok: 3, harga: 65000, harga_b2b: 55000 },
];

export const useProducts = () => {
  const isPreview =
    typeof window !== "undefined" &&
    (window.location.search.includes("preview_mode=true") ||
      localStorage.getItem("tanabrew_preview_mode") === "true");

  const [products, setProducts] = useState<Product[]>(isPreview ? MOCK_PRODUCTS : cachedProducts);
  const [loading, setLoading] = useState(isPreview ? false : !hasLoadedOnce);

  useEffect(() => {
    if (isPreview) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }
    // Berlangganan ke update produk bersama
    const updateHandler = (newProducts: Product[]) => {
      setProducts(newProducts);
      setLoading(false);
    };
    productSubscribers.add(updateHandler);

    activeRefCount++;

    // Jika belum ada listener aktif, buat satu listener terpusat
    if (!activeUnsubscribe) {
      activeUnsubscribe = onSnapshot(collection(db, "products"), (snap) => {
        const data = snap.docs
          .filter((doc) => doc.id !== "config_pricelist" && !doc.data().is_system_config)
          .map((doc) => ({ id: doc.id, ...doc.data() } as Product));
        cachedProducts = data;
        hasLoadedOnce = true;
        productSubscribers.forEach((cb) => cb(data));
      });
    } else if (hasLoadedOnce) {
      setProducts(cachedProducts);
      setLoading(false);
    }

    return () => {
      productSubscribers.delete(updateHandler);
      activeRefCount--;
      // Jika tidak ada komponen yang menggunakan produk selama 10 detik, bersihkan listener
      if (activeRefCount <= 0) {
        activeRefCount = 0;
      }
    };
  }, []);

  return { products, loading };
};
