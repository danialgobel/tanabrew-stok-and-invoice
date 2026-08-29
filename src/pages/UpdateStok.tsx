import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import { addStockMovement } from "@/lib/stockMovement";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types";
import { Pencil, Printer, RotateCcw, Search, Trash2, Plus, ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { printStockReport } from "@/lib/reportPrint";
import { Skeleton } from "@/components/Skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";
import PullToRefresh from "@/components/PullToRefresh";
import { printPricelist, type PricelistCategory, type PricelistItem } from "@/lib/pricelistPrint";

const emptyForm = { nama_barang: "", stok_jogja: 0, stok_lombok: 0, harga: 0, harga_b2b: 0 };
type StockFilter = "semua" | "menipis" | "habis";

const stockState = (total: number) => {
  if (total === 0) {
    return {
      rowClass: "bg-destructive/10",
      label: "Stok Habis",
      labelClass: "bg-destructive/15 text-destructive",
    };
  }

  if (total > 0 && total <= 3) {
    return {
      rowClass: "bg-yellow-100/70",
      label: "Stok Menipis",
      labelClass: "bg-yellow-200/80 text-yellow-800",
    };
  }

  return { rowClass: "", label: "", labelClass: "" };
};

const UpdateStok = () => {
  const { products, loading } = useProducts();
  const { currentUser, userProfile } = useAuth();
  const { toast } = useToast();
  const isOwner = userProfile?.role === "owner" || userProfile?.role === "webdev";
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("semua");
  const [editingProductName, setEditingProductName] = useState("");
  const [highlightEditForm, setHighlightEditForm] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // Pricelist feature state
  const [showPricelistModal, setShowPricelistModal] = useState(false);
  const [pricelistMode, setPricelistMode] = useState<"normal" | "b2b">("normal");
  const [pricelistStep, setPricelistStep] = useState<1 | 2>(1);
  const [selectedStockLocation, setSelectedStockLocation] = useState<"Jogja" | "Lombok" | "Semua">("Semua");
  const [pricelistCategories, setPricelistCategories] = useState<PricelistCategory[]>(() => {
    try {
      const saved = localStorage.getItem("tanabrew_pricelist_config");
      return saved ? JSON.parse(saved) : [
        { id: "cat-1", name: "SINGLE ORIGIN FILTER ROAST 150GR", items: [] },
        { id: "cat-2", name: "ROASTED BEANS ESPRESSO 1000GR", items: [] }
      ];
    } catch {
      return [
        { id: "cat-1", name: "SINGLE ORIGIN FILTER ROAST 150GR", items: [] },
        { id: "cat-2", name: "ROASTED BEANS ESPRESSO 1000GR", items: [] }
      ];
    }
  });

  // Automatically save configuration to localStorage
  useEffect(() => {
    localStorage.setItem("tanabrew_pricelist_config", JSON.stringify(pricelistCategories));
  }, [pricelistCategories]);

  // Filter products that have stock in selected location
  const availableProductsForPricelist = useMemo(() => {
    return products.filter(product => {
      if (selectedStockLocation === "Jogja") return (product.stok_jogja || 0) > 0;
      if (selectedStockLocation === "Lombok") return (product.stok_lombok || 0) > 0;
      return (product.total_stok || 0) > 0;
    });
  }, [products, selectedStockLocation]);

  const addPricelistCategory = () => {
    const newCat: PricelistCategory = {
      id: `cat-${Date.now()}`,
      name: "KRITERIA BARU",
      items: []
    };
    setPricelistCategories(prev => [...prev, newCat]);
  };

  const removePricelistCategory = (catId: string) => {
    setPricelistCategories(prev => prev.filter(c => c.id !== catId));
  };

  const updateCategoryName = (catId: string, name: string) => {
    setPricelistCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c));
  };

  const addProductToCategory = (catId: string, productId: string) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    let name = prod.nama_barang;
    let desc = "";
    if (name.includes(" - ")) {
      const parts = name.split(" - ");
      name = parts[0].trim();
      desc = parts.slice(1).join(" - ").trim();
    }

    const newItem: PricelistItem = {
      id: `${productId}-${Date.now()}`, // unique item instance id
      nama_barang: name,
      harga: prod.harga,
      harga_b2b: prod.harga_b2b ?? "",
      deskripsi: desc
    };

    setPricelistCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return {
          ...c,
          items: [...c.items, newItem]
        };
      }
      return c;
    }));
  };

  const addManualProductToCategory = (catId: string) => {
    const newItem: PricelistItem = {
      id: `manual-${Date.now()}`,
      nama_barang: "",
      harga: "",
      harga_b2b: "",
      deskripsi: ""
    };

    setPricelistCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return {
          ...c,
          items: [...c.items, newItem]
        };
      }
      return c;
    }));
  };

  const removeProductFromCategory = (catId: string, itemId: string) => {
    setPricelistCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return {
          ...c,
          items: c.items.filter(i => i.id !== itemId)
        };
      }
      return c;
    }));
  };

  const updateItemField = (catId: string, itemId: string, field: keyof PricelistItem, value: string | number) => {
    setPricelistCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return {
          ...c,
          items: c.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
        };
      }
      return c;
    }));
  };

  const resetPricelistConfig = () => {
    if (window.confirm("Apakah Anda yakin ingin mereset susunan Price List?")) {
      const defaultConfig = [
        { id: "cat-1", name: "SINGLE ORIGIN FILTER ROAST 150GR", items: [] },
        { id: "cat-2", name: "ROASTED BEANS ESPRESSO 1000GR", items: [] }
      ];
      setPricelistCategories(defaultConfig);
    }
  };

  const handlePrintPricelist = (mode: "normal" | "b2b" = "normal") => {
    if (pricelistCategories.every(c => c.items.length === 0)) {
      toast({
        title: "Perhatian",
        description: "Silakan tambahkan minimal satu produk ke dalam kriteria sebelum mencetak.",
        variant: "destructive"
      });
      return;
    }

    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    const ok = printPricelist({
      categories: pricelistCategories,
      stockLocation: selectedStockLocation,
      printedBy: userProfile.name || currentUser.email || "-",
      roleLabel: formatRole(userProfile.role),
      priceMode: mode,
    });

    if (!ok) {
      toast({
        title: "Error",
        description: `Gagal membuka jendela cetak Price List${mode === "b2b" ? " B2B" : ""}. Pastikan pop-up browser tidak diblokir.`,
        variant: "destructive"
      });
    }
  };

  const totalStok = (form.stok_jogja || 0) + (form.stok_lombok || 0);
  const filteredProducts = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const total = product.total_stok || 0;
      const matchesSearch = !keyword || product.nama_barang.toLowerCase().includes(keyword);
      const matchesFilter =
        stockFilter === "semua"
        || (stockFilter === "habis" && total === 0)
        || (stockFilter === "menipis" && total > 0 && total <= 3);

      return matchesSearch && matchesFilter;
    });
  }, [products, searchTerm, stockFilter]);

  const formHasInput = Boolean(form.nama_barang.trim()) || form.stok_jogja !== 0 || form.stok_lombok !== 0 || form.harga !== 0 || form.harga_b2b !== 0;
  const pullRefreshDisabled = formHasInput || saving || deletingId !== null || pendingDelete !== null || showPricelistModal;

  const handleSafeRefresh = useCallback(() => {
    window.setTimeout(() => window.location.reload(), 320);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_barang.trim()) return;
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
      return;
    }

    if (!isOwner) {
      toast({ title: "Akses Ditolak", description: "Hanya Owner yang berhak menambah atau mengedit stok produk.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data = {
        nama_barang: form.nama_barang.trim(),
        stok_jogja: Number(form.stok_jogja) || 0,
        stok_lombok: Number(form.stok_lombok) || 0,
        total_stok: totalStok,
        harga: Number(form.harga) || 0,
        harga_b2b: Number(form.harga_b2b) || 0,
      };
      const auditUser = { uid: currentUser.uid, name: userProfile.name, role: userProfile.role };

      if (editId) {
        const oldProduct = products.find((product) => product.id === editId);
        await updateDoc(doc(db, "products", editId), {
          ...data,
          diedit_oleh: userProfile.name,
          diedit_oleh_uid: currentUser.uid,
          diedit_oleh_role: userProfile.role,
          updated_at: serverTimestamp(),
        });
        await addActivityLog({
          user: auditUser,
          action: "UPDATE_PRODUCT",
          targetType: "product",
          targetId: editId,
          targetName: data.nama_barang,
          description: `${userProfile.name} mengedit stok ${data.nama_barang}`,
        });
        if (oldProduct) {
          const stockChanges = [
            {
              location: "Jogja" as const,
              before: oldProduct.stok_jogja || 0,
              after: data.stok_jogja,
            },
            {
              location: "Lombok" as const,
              before: oldProduct.stok_lombok || 0,
              after: data.stok_lombok,
            },
          ];

          for (const change of stockChanges) {
            if (change.before === change.after) continue;

            await addStockMovement({
              productId: editId,
              productName: data.nama_barang,
              movementType: "STOCK_EDIT",
              location: change.location,
              quantityChange: change.after - change.before,
              stockBefore: change.before,
              stockAfter: change.after,
              source: "product_update",
              referenceId: editId,
              referenceLabel: data.nama_barang,
              description: `Edit stok ${change.location} dari ${change.before} menjadi ${change.after}.`,
              user: auditUser,
            });
          }
        }
        toast({ title: "Berhasil", description: "Produk diperbarui" });
      } else {
        const productRef = await addDoc(collection(db, "products"), {
          ...data,
          dibuat_oleh: userProfile.name,
          dibuat_oleh_uid: currentUser.uid,
          dibuat_oleh_role: userProfile.role,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        await addActivityLog({
          user: auditUser,
          action: "CREATE_PRODUCT",
          targetType: "product",
          targetId: productRef.id,
          targetName: data.nama_barang,
          description: `${userProfile.name} menambahkan produk ${data.nama_barang}`,
        });
        await addStockMovement({
          productId: productRef.id,
          productName: data.nama_barang,
          movementType: "PRODUCT_CREATE",
          location: "Semua",
          quantityChange: data.total_stok,
          stockBefore: 0,
          stockAfter: data.total_stok,
          source: "product_create",
          referenceId: productRef.id,
          referenceLabel: data.nama_barang,
          description: `Tambah produk baru dengan stok Jogja ${data.stok_jogja} dan stok Lombok ${data.stok_lombok}.`,
          user: auditUser,
        });
        toast({ title: "Berhasil", description: "Produk ditambahkan" });
      }
      setForm(emptyForm);
      setEditId(null);
      setEditingProductName("");
      setHighlightEditForm(false);
    } catch {
      toast({ title: "Error", description: "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = (p: Product) => {
    if (!isOwner) {
      toast({ title: "Akses Ditolak", description: "Hanya Owner yang berhak mengedit stok produk.", variant: "destructive" });
      return;
    }

    setForm({ nama_barang: p.nama_barang, stok_jogja: p.stok_jogja, stok_lombok: p.stok_lombok, harga: p.harga, harga_b2b: p.harga_b2b ?? 0 });
    setEditId(p.id!);
    setEditingProductName(p.nama_barang);
    setHighlightEditForm(true);

    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    highlightTimerRef.current = window.setTimeout(() => setHighlightEditForm(false), 1400);
  };

  const handleDelete = async (p: Product) => {
    if (!currentUser || !userProfile || !p.id) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
      return;
    }

    if (!isOwner) {
      toast({ title: "Akses Ditolak", description: "Hanya Owner yang berhak menghapus produk.", variant: "destructive" });
      return;
    }

    setDeletingId(p.id);
    try {
      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "DELETE_PRODUCT",
        targetType: "product",
        targetId: p.id,
        targetName: p.nama_barang,
        description: `${userProfile.name} menghapus produk ${p.nama_barang}`,
      });
      await addStockMovement({
        productId: p.id,
        productName: p.nama_barang,
        movementType: "PRODUCT_DELETE",
        location: "Semua",
        quantityChange: -(p.total_stok || 0),
        stockBefore: p.total_stok || 0,
        stockAfter: 0,
        source: "product_delete",
        referenceId: p.id,
        referenceLabel: p.nama_barang,
        description: "Produk dihapus oleh admin.",
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
      });
      await deleteDoc(doc(db, "products", p.id));
      toast({ title: "Dihapus", description: "Produk berhasil dihapus" });
      setPendingDelete(null);
    } catch {
      toast({ title: "Error", description: "Gagal menghapus", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const resetFilters = () => {
    setSearchTerm("");
    setStockFilter("semua");
  };

  const formatRole = (role?: string) => {
    if (role === "owner") return "Owner";
    if (role === "admin") return "Admin";
    if (role === "staff") return "Staff";
    return role || "Tidak diketahui";
  };

  const getStockFilterLabel = () => {
    const labels = [
      searchTerm.trim() ? `Pencarian: ${searchTerm.trim()}` : "",
      stockFilter !== "semua" ? `Filter: ${stockFilter === "habis" ? "Habis" : "Menipis"}` : "",
    ].filter(Boolean);

    return labels.length ? labels.join(" | ") : "Semua stok";
  };

  const handlePrintStockReport = () => {
    if (filteredProducts.length === 0) {
      toast({ title: "Perhatian", description: "Tidak ada stok sesuai filter." });
      return;
    }

    const ok = printStockReport({
      products: filteredProducts,
      filterLabel: getStockFilterLabel(),
      printedBy: userProfile?.name || currentUser?.email || "-",
      roleLabel: formatRole(userProfile?.role),
    });

    if (!ok) {
      toast({ title: "Error", description: "Gagal membuka jendela cetak laporan stok.", variant: "destructive" });
    }
  };

  return (
    <>
    <PullToRefresh onRefresh={handleSafeRefresh} disabled={pullRefreshDisabled} />

    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-primary mb-4">Update Stok</h1>

      {isOwner ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={`space-y-3 mb-6 bg-card rounded-xl border p-4 transition-colors ${
            editId ? "tanabrew-edit-form-active border-primary/40 bg-primary/5" : "border-border"
          } ${highlightEditForm ? "tanabrew-edit-form-highlight" : ""}`}
        >
          {editId && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              Sedang mengedit: {editingProductName || form.nama_barang}
            </p>
          )}
          <input
            placeholder="Nama Barang"
            value={form.nama_barang}
            onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stok Jogja</label>
              <input
                type="number"
                value={form.stok_jogja}
                onChange={(e) => setForm({ ...form, stok_jogja: Number(e.target.value) })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stok Lombok</label>
              <input
                type="number"
                value={form.stok_lombok}
                onChange={(e) => setForm({ ...form, stok_lombok: Number(e.target.value) })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Harga Normal</label>
              <input
                type="number"
                value={form.harga}
                onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Harga B2B</label>
              <input
                type="number"
                value={form.harga_b2b}
                onChange={(e) => setForm({ ...form, harga_b2b: Number(e.target.value) })}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Stok</p>
            <p className="text-lg font-bold text-primary">{totalStok}</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? (editId ? "Menyimpan Perubahan..." : "Menyimpan...") : editId ? "Simpan Perubahan" : "Simpan"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setEditId(null); setEditingProductName(""); setHighlightEditForm(false); }}
              className="w-full bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
            >
              Batal
            </button>
          )}
        </form>
      ) : (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-xs font-semibold text-muted-foreground">
            🔒 Mode Lihat Saja: Hanya akun Owner yang dapat menambah atau mengedit stok & harga produk.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama barang"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="semua">Semua Stok</option>
          <option value="menipis">Menipis</option>
          <option value="habis">Habis</option>
        </select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground sm:col-span-2"
          >
            <RotateCcw size={15} />
            Reset Filter
          </button>
          <button
            type="button"
            onClick={handlePrintStockReport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground sm:col-span-2"
          >
            <Printer size={15} />
            Cetak Laporan Stok
          </button>
          <button
            type="button"
            onClick={() => {
              setPricelistMode("normal");
              setPricelistStep(1);
              setShowPricelistModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors px-3 py-2.5 text-sm font-semibold text-white"
          >
            <Printer size={15} />
            Cetak Price List
          </button>
          <button
            type="button"
            onClick={() => {
              setPricelistMode("b2b");
              setPricelistStep(1);
              setShowPricelistModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors px-3 py-2.5 text-sm font-semibold text-white"
          >
            <Printer size={15} />
            Cetak Price List B2B
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-2 py-2 text-left font-medium">Nama</th>
                <th className="px-2 py-2 text-center font-medium">Jogja</th>
                <th className="px-2 py-2 text-center font-medium">Lombok</th>
                <th className="px-2 py-2 text-center font-medium">Total</th>
                <th className="px-2 py-2 text-right font-medium">Harga</th>
                <th className="px-2 py-2 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-2 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-2 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                    <td className="px-2 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                    <td className="px-2 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                    <td className="px-2 py-3"><Skeleton className="ml-auto h-4 w-14" /></td>
                    <td className="px-2 py-3"><Skeleton className="mx-auto h-6 w-12" /></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Tidak ada stok sesuai filter.</td></tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className={`border-t border-border ${stockState(p.total_stok || 0).rowClass}`}>
                    <td className="px-2 py-2 text-xs">
                      <div className="flex flex-col gap-1">
                        <span>{p.nama_barang}</span>
                        {stockState(p.total_stok || 0).label && (
                          <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockState(p.total_stok || 0).labelClass}`}>
                            {stockState(p.total_stok || 0).label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs">{p.stok_jogja}</td>
                    <td className="px-2 py-2 text-center text-xs">{p.stok_lombok}</td>
                    <td className="px-2 py-2 text-center text-xs font-medium">{p.total_stok}</td>
                    <td className="px-2 py-2 text-right text-xs">
                      <div>{fmt(p.harga)}</div>
                      {(p.harga_b2b ?? 0) > 0 && (
                        <div className="text-[10px] text-blue-600 font-medium">B2B: {fmt(p.harga_b2b!)}</div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center align-middle">
                      {isOwner ? (
                        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
                          <button
                            onClick={() => handleEdit(p)}
                            className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg bg-primary/10 px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/15 sm:min-h-9 sm:min-w-9 sm:px-2"
                            aria-label="Edit produk"
                          >
                            <Pencil size={18} />
                            <span className="sm:hidden">Edit</span>
                          </button>
                          <button
                            onClick={() => setPendingDelete(p)}
                            disabled={deletingId === p.id}
                            className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:min-w-9 sm:px-2"
                            aria-label={deletingId === p.id ? "Menghapus..." : "Hapus produk"}
                          >
                            <Trash2 size={18} />
                            <span className="sm:hidden">{deletingId === p.id ? "Menghapus..." : "Hapus"}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Lihat Saja</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus produk ini?"
        description="Data produk yang dihapus tidak dapat dikembalikan. Mutasi stok dan activity log akan tetap dicatat."
        confirmLabel="Hapus"
        danger
        loading={Boolean(pendingDelete?.id && deletingId === pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void handleDelete(pendingDelete)}
      />

      {showPricelistModal && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setShowPricelistModal(false)}>
          <div 
            className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto tanabrew-card-enter flex flex-col" 
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                {pricelistStep === 2 && (
                  <button 
                    type="button" 
                    onClick={() => setPricelistStep(1)} 
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Kembali"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                Konfigurasi Price List {pricelistMode === "b2b" && <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">B2B</span>}
              </h3>
              <button onClick={() => setShowPricelistModal(false)} className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Tutup modal">
                <X size={20} />
              </button>
            </div>

            {pricelistStep === 1 ? (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-primary/5 p-3 text-xs text-primary leading-relaxed border border-primary/10">
                  <strong>Info:</strong> Price List akan disaring berdasarkan stok yang aktif di lokasi terpilih. Produk dengan stok 0 di lokasi tersebut akan disembunyikan agar Anda dapat mencetak katalog yang relevan dengan cepat.
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">Pilih Lokasi Stok:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Jogja", "Lombok", "Semua"] as const).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setSelectedStockLocation(loc)}
                        className={`py-3 rounded-lg border text-sm font-bold text-center transition-all ${
                          selectedStockLocation === loc
                            ? "bg-primary border-primary text-primary-foreground shadow-sm"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPricelistStep(2)}
                    className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-1"
                  >
                    Lanjut ke Susunan
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-1 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg text-xs">
                  <span className="font-semibold text-muted-foreground text-[11px]">Lokasi Stok: {selectedStockLocation}</span>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={resetPricelistConfig} 
                      className="text-destructive hover:underline font-semibold text-[11px]"
                    >
                      Reset Kategori
                    </button>
                  </div>
                </div>

                <div className="space-y-4 overflow-y-auto pr-1 flex-1 max-h-[50vh]">
                  {pricelistCategories.map((cat) => (
                    <div key={cat.id} className="border border-border rounded-xl p-3 bg-card space-y-3 relative">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                          className="flex-1 bg-transparent text-sm font-bold text-primary border-b border-dashed border-primary/30 focus:border-primary focus:outline-none py-0.5"
                          placeholder="Nama Kriteria/Kategori"
                        />
                        <button
                          type="button"
                          onClick={() => removePricelistCategory(cat.id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {cat.items.map((item) => (
                          <div key={item.id} className="p-2.5 rounded-lg bg-muted/40 border border-border/55 text-xs space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.nama_barang}
                                onChange={(e) => updateItemField(cat.id, item.id!, "nama_barang", e.target.value)}
                                className="flex-1 bg-background px-2 py-1 rounded border border-input focus:outline-none"
                                placeholder="Nama Barang"
                              />
                              <button
                                type="button"
                                onClick={() => removeProductFromCategory(cat.id, item.id!)}
                                className="text-muted-foreground hover:text-destructive p-1"
                                title="Hapus Barang"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground mb-0.5 block">Harga Normal</label>
                                <input
                                  type="text"
                                  value={item.harga}
                                  onChange={(e) => updateItemField(cat.id, item.id!, "harga", e.target.value)}
                                  className="w-full bg-background px-2 py-1 rounded border border-input focus:outline-none text-right"
                                  placeholder="Harga Normal"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-blue-600 mb-0.5 block font-semibold">Harga B2B</label>
                                <input
                                  type="text"
                                  value={item.harga_b2b ?? ""}
                                  onChange={(e) => updateItemField(cat.id, item.id!, "harga_b2b", e.target.value)}
                                  className="w-full bg-background px-2 py-1 rounded border border-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-400 text-right text-blue-700"
                                  placeholder="Harga B2B"
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              value={item.deskripsi || ""}
                              onChange={(e) => updateItemField(cat.id, item.id!, "deskripsi", e.target.value)}
                              className="w-full bg-background px-2 py-1 rounded border border-input focus:outline-none"
                              placeholder="Deskripsi, contoh: Situbondo, Dried Raisin..."
                            />
                          </div>
                        ))}

                        {cat.items.length === 0 && (
                          <p className="text-[11px] text-muted-foreground text-center py-2 bg-muted/10 border border-dashed border-border rounded-lg">
                            Belum ada produk di kriteria ini.
                          </p>
                        )}
                      </div>

                      {/* Dropdown Menu to SELECT saved product */}
                      <div className="pt-1 flex gap-2">
                        <select
                          value=""
                          onChange={(e) => addProductToCategory(cat.id, e.target.value)}
                          className="flex-1 bg-background rounded-lg border border-input px-2 py-1.5 text-xs text-muted-foreground focus:outline-none"
                        >
                          <option value="">+ Pilih Produk dari Database...</option>
                          {availableProductsForPricelist
                            .filter(p => !cat.items.some(existing => existing.id?.startsWith(p.id!))) // avoid duplicates
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nama_barang} (Stok: {selectedStockLocation === "Jogja" ? p.stok_jogja : selectedStockLocation === "Lombok" ? p.stok_lombok : p.total_stok})
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => addManualProductToCategory(cat.id)}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-semibold rounded-lg transition-colors border border-primary/20 shrink-0"
                        >
                          + Manual
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addPricelistCategory}
                    className="w-full border border-dashed border-primary/40 hover:border-primary text-primary rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus size={14} /> Tambah Kriteria Baru
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPricelistStep(1)}
                      className="flex-1 bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-lg py-2.5 text-xs font-semibold"
                    >
                      Kembali
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintPricelist("normal")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 text-xs font-bold transition-colors"
                    >
                      Cetak Price List
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrintPricelist("b2b")}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-xs font-bold transition-colors"
                    >
                      Cetak Price List B2B
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default UpdateStok;
