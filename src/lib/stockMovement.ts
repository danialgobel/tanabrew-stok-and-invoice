import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StockMovement } from "@/types";

interface StockMovementUser {
  uid: string;
  name: string;
  role: string;
}

interface StockMovementInput {
  productId: string;
  productName: string;
  movementType: NonNullable<StockMovement["movement_type"]>;
  location: NonNullable<StockMovement["location"]>;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  source: NonNullable<StockMovement["source"]>;
  referenceId?: string;
  referenceLabel?: string;
  description: string;
  user: StockMovementUser;
}

export const buildStockMovementData = ({
  productId,
  productName,
  movementType,
  location,
  quantityChange,
  stockBefore,
  stockAfter,
  source,
  referenceId,
  referenceLabel,
  description,
  user,
}: StockMovementInput) => ({
  product_id: productId,
  product_name: productName,
  movement_type: movementType,
  location,
  quantity_change: quantityChange,
  stock_before: stockBefore,
  stock_after: stockAfter,
  source,
  reference_id: referenceId || "",
  reference_label: referenceLabel || "",
  description,
  user_id: user.uid,
  user_name: user.name,
  user_role: user.role,
  created_at: serverTimestamp(),
});

export const addStockMovement = async (input: StockMovementInput) => {
  await addDoc(collection(db, "stock_movements"), buildStockMovementData(input));
};
