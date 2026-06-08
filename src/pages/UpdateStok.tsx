import { useMemo, useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import { addStockMovement } from "@/lib/stockMovement";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types";
import { Pencil, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { printStockReport } from "@/lib/reportPrint";
import { Skeleton } from "@/components/Skeleton";
import ConfirmDialog from "@/components/ConfirmDialog";

const emptyForm = { nama_barang: "", stok_jogja: 0, stok_lombok: 0, harga: 0 };
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
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("semua");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_barang.trim()) return;
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
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
    } catch {
      toast({ title: "Error", description: "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = (p: Product) => {
    setForm({ nama_barang: p.nama_barang, stok_jogja: p.stok_jogja, stok_lombok: p.stok_lombok, harga: p.harga });
    setEditId(p.id!);
  };

  const handleDelete = async (p: Product) => {
    if (!currentUser || !userProfile || !p.id) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
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
    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-primary mb-4">Update Stok</h1>

      <form onSubmit={handleSubmit} className="space-y-3 mb-6 bg-card rounded-xl border border-border p-4">
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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">Harga</label>
            <input
              type="number"
              value={form.harga}
              onChange={(e) => setForm({ ...form, harga: Number(e.target.value) })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="text-center pt-5">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{totalStok}</p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (editId ? "Memperbarui..." : "Menyimpan...") : editId ? "Perbarui" : "Simpan"}
        </button>
        {editId && (
          <button
            type="button"
            onClick={() => { setForm(emptyForm); setEditId(null); }}
            className="w-full bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
          >
            Batal
          </button>
        )}
      </form>

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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm font-semibold text-muted-foreground"
          >
            <RotateCcw size={15} />
            Reset Filter
          </button>
          <button
            type="button"
            onClick={handlePrintStockReport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Printer size={15} />
            Cetak Laporan Stok
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
                    <td className="px-2 py-2 text-right text-xs">{fmt(p.harga)}</td>
                    <td className="px-2 py-2 text-center align-middle">
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
    </div>
  );
};

export default UpdateStok;
