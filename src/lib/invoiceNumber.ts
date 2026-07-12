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

interface UpdateInvoiceWithStockInput {
  invoiceId: string;
  invoiceData: Record<string, any>;
  stockItems: InvoiceStockItem[];
  stockLocation: "Jogja" | "Lombok";
  user: InvoiceTransactionUser;
  customer: string;
}

export const updateInvoiceWithStock = async ({
  invoiceId,
  invoiceData,
  stockItems,
  stockLocation,
  user,
  customer,
}: UpdateInvoiceWithStockInput) => {
  const invoiceRef = doc(db, "invoices", invoiceId);
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
    // 1. Get current invoice data
    const invoiceSnap = await transaction.get(invoiceRef);
    if (!invoiceSnap.exists()) {
      throw new Error("Invoice tidak ditemukan.");
    }
    const oldInvoice = invoiceSnap.data();

    // Check if printed or paid (only allow edit if not printed and not paid, unless they are webdev)
    const isWebdev = user.role === "webdev";
    if (!isWebdev && (oldInvoice.is_printed || oldInvoice.status === "LUNAS")) {
      throw new Error("Invoice yang sudah dicetak atau lunas tidak dapat diedit.");
    }

    const oldLocation = oldInvoice.stock_location || stockLocation;
    const oldStockField = getLocationStockField(oldLocation);

    // 2. Map old items by product ID
    const oldItemsMap = new Map<string, number>();
    if (Array.isArray(oldInvoice.items)) {
      oldInvoice.items.forEach((item: any) => {
        if (item.product_id) {
          oldItemsMap.set(item.product_id, (oldItemsMap.get(item.product_id) || 0) + Number(item.jumlah || 0));
        }
      });
    }

    // 3. Map new items by product ID
    const newItemsMap = new Map<string, number>();
    combinedItems.forEach((item) => {
      newItemsMap.set(item.productId, (newItemsMap.get(item.productId) || 0) + item.quantity);
    });

    // 4. Collect all unique product IDs involved
    const allProductIds = Array.from(new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]));

    // 5. Fetch all products snapshots
    const productRefsMap = new Map<string, any>();
    const productSnapsMap = new Map<string, any>();
    await Promise.all(
      allProductIds.map(async (productId) => {
        const productRef = doc(db, "products", productId);
        const productSnap = await transaction.get(productRef);
        productRefsMap.set(productId, productRef);
        productSnapsMap.set(productId, productSnap);
      })
    );

    // 6. Validate stock availability for increases
    allProductIds.forEach((productId) => {
      const productSnap = productSnapsMap.get(productId);
      if (!productSnap.exists()) {
        const newQty = newItemsMap.get(productId) || 0;
        if (newQty > 0) {
          throw new Error(`Produk dengan ID ${productId} tidak ditemukan.`);
        }
        return;
      }

      const product = productSnap.data();
      const oldQty = oldItemsMap.get(productId) || 0;
      const newQty = newItemsMap.get(productId) || 0;

      // Calculate stock adjustments
      if (oldLocation === stockLocation) {
        const currentStock = Number(product[stockField] || 0);
        const diff = oldQty - newQty; // positive: returned to stock, negative: taken from stock
        if (diff < 0 && Math.abs(diff) > currentStock) {
          throw new Error(`Stok tidak mencukupi untuk ${product.nama_barang}. Stok ${stockLocation} tersisa ${currentStock}.`);
        }
      } else {
        const currentNewStock = Number(product[stockField] || 0);
        if (newQty > currentNewStock) {
          throw new Error(`Stok tidak mencukupi di lokasi ${stockLocation} untuk ${product.nama_barang}. Tersisa ${currentNewStock}.`);
        }
      }
    });

    // 7. Update stocks and write movement logs
    allProductIds.forEach((productId) => {
      const productRef = productRefsMap.get(productId);
      const productSnap = productSnapsMap.get(productId);
      if (!productSnap.exists()) return;

      const product = productSnap.data();
      const oldQty = oldItemsMap.get(productId) || 0;
      const newQty = newItemsMap.get(productId) || 0;

      let nextJogja = Number(product.stok_jogja || 0);
      let nextLombok = Number(product.stok_lombok || 0);

      // Return old stock
      if (oldLocation === "Jogja") {
        nextJogja += oldQty;
      } else {
        nextLombok += oldQty;
      }

      // Subtract new stock
      if (stockLocation === "Jogja") {
        nextJogja -= newQty;
      } else {
        nextLombok -= newQty;
      }

      transaction.update(productRef, {
        stok_jogja: nextJogja,
        stok_lombok: nextLombok,
        total_stok: nextJogja + nextLombok,
        diedit_oleh: user.name,
        diedit_oleh_uid: user.uid,
        diedit_oleh_role: user.role,
        updated_at: serverTimestamp(),
      });

      const qtyChange = oldQty - newQty;
      if (qtyChange !== 0 || oldLocation !== stockLocation) {
        const movementRef = doc(collection(db, "stock_movements"));
        transaction.set(
          movementRef,
          buildStockMovementData({
            productId,
            productName: product.nama_barang,
            movementType: "STOCK_EDIT",
            location: stockLocation,
            quantityChange: -qtyChange,
            stockBefore: oldLocation === stockLocation ? (stockLocation === "Jogja" ? product.stok_jogja : product.stok_lombok) : 0,
            stockAfter: stockLocation === "Jogja" ? nextJogja : nextLombok,
            source: "invoice",
            referenceId: invoiceRef.id,
            referenceLabel: oldInvoice.no_invoice || "",
            description: `Invoice ${oldInvoice.no_invoice} diedit. Stok disesuaikan.`,
            user,
          })
        );
      }
    });

    // 8. Update the invoice document
    transaction.update(invoiceRef, {
      ...invoiceData,
      stock_location: stockLocation,
      updated_at: serverTimestamp(),
    });

    // 9. Add activity log
    transaction.set(activityRef, {
      user_id: user.uid,
      user_name: user.name,
      user_role: user.role,
      action: "EDIT_INVOICE",
      target_type: "invoice",
      target_id: invoiceRef.id,
      target_name: oldInvoice.no_invoice,
      description: `${user.name} mengedit invoice ${oldInvoice.no_invoice} untuk customer ${customer}`,
      created_at: serverTimestamp(),
    });

    return {
      invoiceId: invoiceRef.id,
      noInvoice: oldInvoice.no_invoice,
    };
  });
};
