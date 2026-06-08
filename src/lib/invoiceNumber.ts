import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildStockMovementData } from "@/lib/stockMovement";

const padInvoiceNumber = (value: number) => String(value).padStart(4, "0");

export const buildInvoiceNumber = (year: number, month: string, sequence: number) =>
  `INV/TNB/${year}/${month}/${padInvoiceNumber(sequence)}`;

export const createInvoiceWithNumber = async (invoiceData: Record<string, unknown>, date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const counterRef = doc(db, "invoice_counters", `${year}-${month}`);
  const invoiceRef = doc(collection(db, "invoices"));

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const lastNumber = counterSnap.exists() ? Number(counterSnap.data().last_number || 0) : 0;
    const nextNumber = lastNumber + 1;
    const noInvoice = buildInvoiceNumber(year, month, nextNumber);

    transaction.set(invoiceRef, {
      ...invoiceData,
      no_invoice: noInvoice,
    });

    transaction.set(
      counterRef,
      {
        last_number: nextNumber,
        year,
        month,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    return {
      invoiceId: invoiceRef.id,
      noInvoice,
    };
  });
};

interface InvoiceStockItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface InvoiceTransactionUser {
  uid: string;
  name: string;
  role: string;
}

interface CreateInvoiceWithStockInput {
  invoiceData: Record<string, unknown>;
  stockItems: InvoiceStockItem[];
  stockLocation: "Jogja" | "Lombok";
  user: InvoiceTransactionUser;
  customer: string;
  date?: Date;
}

const getLocationStockField = (location: "Jogja" | "Lombok") =>
  location === "Jogja" ? "stok_jogja" : "stok_lombok";

export const createInvoiceWithNumberAndStock = async ({
  invoiceData,
  stockItems,
  stockLocation,
  user,
  customer,
  date = new Date(),
}: CreateInvoiceWithStockInput) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const counterRef = doc(db, "invoice_counters", `${year}-${month}`);
  const invoiceRef = doc(collection(db, "invoices"));
  const activityRef = doc(collection(db, "activity_logs"));
  const stockField = getLocationStockField(stockLocation);
  const combinedItems = Array.from(
    stockItems.reduce((map, item) => {
      const current = map.get(item.productId);
      map.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        quantity: (current?.quantity || 0) + item.quantity,
      });
      return map;
    }, new Map<string, InvoiceStockItem>()),
  ).map(([, item]) => item);

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const productSnapshots = await Promise.all(
      combinedItems.map(async (item) => {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await transaction.get(productRef);
        return { item, productRef, productSnap };
      }),
    );
    const lastNumber = counterSnap.exists() ? Number(counterSnap.data().last_number || 0) : 0;
    const nextNumber = lastNumber + 1;
    const noInvoice = buildInvoiceNumber(year, month, nextNumber);

    productSnapshots.forEach(({ item, productSnap }) => {
      if (!productSnap.exists()) {
        throw new Error(`Produk ${item.productName} tidak ditemukan.`);
      }

      const product = productSnap.data();
      const availableStock = Number(product[stockField] || 0);

      if (item.quantity > availableStock) {
        throw new Error(`Stok tidak mencukupi untuk ${item.productName}. Stok ${stockLocation} tersisa ${availableStock}.`);
      }
    });

    transaction.set(invoiceRef, {
      ...invoiceData,
      no_invoice: noInvoice,
      stock_location: stockLocation,
    });

    transaction.set(
      counterRef,
      {
        last_number: nextNumber,
        year,
        month,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    productSnapshots.forEach(({ item, productRef, productSnap }) => {
      const product = productSnap.data();
      const stokJogja = Number(product.stok_jogja || 0);
      const stokLombok = Number(product.stok_lombok || 0);
      const stockBefore = stockLocation === "Jogja" ? stokJogja : stokLombok;
      const stockAfter = stockBefore - item.quantity;
      const nextJogja = stockLocation === "Jogja" ? stockAfter : stokJogja;
      const nextLombok = stockLocation === "Lombok" ? stockAfter : stokLombok;
      const movementRef = doc(collection(db, "stock_movements"));

      transaction.update(productRef, {
        stok_jogja: nextJogja,
        stok_lombok: nextLombok,
        total_stok: nextJogja + nextLombok,
        diedit_oleh: user.name,
        diedit_oleh_uid: user.uid,
        diedit_oleh_role: user.role,
        updated_at: serverTimestamp(),
      });

      transaction.set(
        movementRef,
        buildStockMovementData({
          productId: item.productId,
          productName: item.productName,
          movementType: "STOCK_OUT_INVOICE",
          location: stockLocation,
          quantityChange: -item.quantity,
          stockBefore,
          stockAfter,
          source: "invoice",
          referenceId: invoiceRef.id,
          referenceLabel: noInvoice,
          description: `Stok ${stockLocation} berkurang ${item.quantity} karena invoice ${noInvoice}.`,
          user,
        }),
      );
    });

    transaction.set(activityRef, {
      user_id: user.uid,
      user_name: user.name,
      user_role: user.role,
      action: "CREATE_INVOICE",
      target_type: "invoice",
      target_id: invoiceRef.id,
      target_name: noInvoice,
      description: `${user.name} membuat invoice ${noInvoice} untuk customer ${customer}`,
      created_at: serverTimestamp(),
    });

    return {
      invoiceId: invoiceRef.id,
      noInvoice,
    };
  });
};
