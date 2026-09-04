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

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>(cachedProducts);
  const [loading, setLoading] = useState(!hasLoadedOnce);

  useEffect(() => {
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
