import { useState } from "react";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyForm = { nama_barang: "", stok_jogja: 0, stok_lombok: 0, harga: 0 };

const UpdateStok = () => {
  const { products, loading } = useProducts();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalStok = (form.stok_jogja || 0) + (form.stok_lombok || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_barang.trim()) return;
    setSaving(true);
    try {
      const data = {
        nama_barang: form.nama_barang.trim(),
        stok_jogja: Number(form.stok_jogja) || 0,
        stok_lombok: Number(form.stok_lombok) || 0,
        total_stok: totalStok,
        harga: Number(form.harga) || 0,
      };
      if (editId) {
        await updateDoc(doc(db, "products", editId), data);
        toast({ title: "Berhasil", description: "Produk diperbarui" });
      } else {
        await addDoc(collection(db, "products"), data);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus produk ini?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
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
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-2 py-2 text-xs">{p.nama_barang}</td>
                    <td className="px-2 py-2 text-center text-xs">{p.stok_jogja}</td>
                    <td className="px-2 py-2 text-center text-xs">{p.stok_lombok}</td>
                    <td className="px-2 py-2 text-center text-xs font-medium">{p.total_stok}</td>
                    <td className="px-2 py-2 text-right text-xs">{fmt(p.harga)}</td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEdit(p)} className="p-1 rounded hover:bg-muted text-primary">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(p.id!)} className="p-1 rounded hover:bg-muted text-destructive">
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
