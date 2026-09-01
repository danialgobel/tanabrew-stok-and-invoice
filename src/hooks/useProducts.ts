import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product } from "@/types";

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const data = snap.docs
        .filter((doc) => doc.id !== "config_pricelist" && !doc.data().is_system_config)
        .map((doc) => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { products, loading };
};
