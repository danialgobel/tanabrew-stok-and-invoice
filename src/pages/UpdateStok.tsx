import { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyForm = { nama_barang: "", stok_jogja: 0, stok_lombok: 0, harga: 0 };

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

  const totalStok = (form.stok_jogja || 0) + (form.stok_lombok || 0);

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
    if (!confirm("Hapus produk ini?")) return;
    if (!currentUser || !userProfile || !p.id) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
      return;
    }

    try {
      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "DELETE_PRODUCT",
        targetType: "product",
        targetId: p.id,
        targetName: p.nama_barang,
        description: `${userProfile.name} menghapus produk ${p.nama_barang}`,
      });
      await deleteDoc(doc(db, "products", p.id));
      toast({ title: "Dihapus", description: "Produk berhasil dihapus" });
    } catch {
      toast({ title: "Error", description: "Gagal menghapus", variant: "destructive" });
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

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
          {saving ? "Menyimpan..." : editId ? "Perbarui" : "Simpan"}
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
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Memuat...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Belum ada produk</td></tr>
              ) : (
                products.map((p) => (
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
                    <td className="px-2 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEdit(p)} className="p-1 rounded hover:bg-muted text-primary">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(p)} className="p-1 rounded hover:bg-muted text-destructive">
                          <Trash2 size={14} />
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
    </div>
  );
};

export default UpdateStok;
