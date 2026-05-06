import { useState } from "react";
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useProducts } from "@/hooks/useProducts";
import type { InvoiceItem } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CetakInvoice = () => {
  const { products } = useProducts();
  const { toast } = useToast();
  const [tanggal, setTanggal] = useState("");
  const [noInvoice, setNoInvoice] = useState("");
  const [customer, setCustomer] = useState("");
  
  const [items, setItems] = useState<InvoiceItem[]>([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  const [diskon, setDiskon] = useState(0);
  const [jumlahDibayar, setJumlahDibayar] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal - (diskon || 0);
  const sisa = total - (jumlahDibayar || 0);
  const status = sisa <= 0 ? "LUNAS" : "BELUM LUNAS";

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "nama_barang") {
        const prod = products.find((p) => p.nama_barang === value);
        if (prod) item.harga = prod.harga;
      }
      item.subtotal = (item.harga || 0) * (item.jumlah || 0);
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => setItems([...items, { nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  const removeItem = (idx: number) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));

  const reduceStock = async () => {
    for (const item of items) {
      if (!item.nama_barang || !item.jumlah) continue;
      const q = query(collection(db, "products"), where("nama_barang", "==", item.nama_barang));
      const snap = await getDocs(q);
      if (snap.empty) continue;
      const prodDoc = snap.docs[0];
      const prod = prodDoc.data();
      let remaining = item.jumlah;
      let jogja = prod.stok_jogja || 0;
      let lombok = prod.stok_lombok || 0;

      // Prioritize Jogja
      const fromJogja = Math.min(jogja, remaining);
      jogja -= fromJogja;
      remaining -= fromJogja;
      const fromLombok = Math.min(lombok, remaining);
      lombok -= fromLombok;

      await updateDoc(doc(db, "products", prodDoc.id), {
        stok_jogja: jogja,
        stok_lombok: lombok,
        total_stok: jogja + lombok,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noInvoice.trim() || !customer.trim() || items.every((i) => !i.nama_barang)) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "invoices"), {
        tanggal, no_invoice: noInvoice, customer,
        items, subtotal, diskon, total, jumlah_dibayar: jumlahDibayar, sisa, status,
      });
      await reduceStock();
      setSaved(true);
      toast({ title: "Berhasil", description: "Invoice tersimpan" });
    } catch {
      toast({ title: "Error", description: "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(false);
  };

  const handlePrint = () => {
    setTimeout(() => { window.print(); }, 800);
  };

  if (saved) {
    return (
      <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
        {/* Invoice Preview */}
        <div id="invoice" className="bg-card rounded-xl border border-border p-5">
          <div className="flex justify-between items-start mb-4">
            <img
              src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png"
              alt="Tanabrew"
              style={{ width: 140, height: "auto" }}
            />
            <div className="text-right space-y-1 text-sm">
              <p><span className="text-muted-foreground">No Invoice:</span> {noInvoice}</p>
              <p><span className="text-muted-foreground">Tanggal:</span> {tanggal}</p>
              <p><span className="text-muted-foreground">Customer:</span> {customer}</p>
            </div>
          </div>
          <h2 className="text-center text-xl font-bold text-primary mb-4">INVOICE</h2>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-primary/50 text-primary-foreground">
                <th className="px-2 py-2 text-left font-medium">Nama Barang</th>
                <th className="px-2 py-2 text-right font-medium">Harga</th>
                <th className="px-2 py-2 text-center font-medium">Jumlah</th>
                <th className="px-2 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.filter((i) => i.nama_barang).map((item, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="px-2 py-2">{item.nama_barang}</td>
                  <td className="px-2 py-2 text-right">Rp {fmt(item.harga)}</td>
                  <td className="px-2 py-2 text-center">{item.jumlah}</td>
                  <td className="px-2 py-2 text-right">Rp {fmt(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-sm border-t border-border pt-3 mb-4">
            <div className="flex justify-between">
              <span>Subtotal</span><span>Rp {fmt(subtotal)}</span>
            </div>
            {diskon > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span><span>- Rp {fmt(diskon)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Total</span><span>Rp {fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Jumlah Dibayar</span><span>Rp {fmt(jumlahDibayar)}</span>
            </div>
            <div className="flex justify-between">
              <span>Sisa Pembayaran</span><span>Rp {fmt(sisa)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Status</span>
              <span className={status === "LUNAS" ? "text-primary" : "text-destructive"}>{status}</span>
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Instruksi Pembayaran</p>
            <p>Transfer ke Seabank a.n. AHMAD FARID MUSADDAD</p>
            <p>No. Rekening 9011 2193 2420</p>
            <p className="mt-2">Transfer ke BSI a.n. AHMAD FARID MUSADDAD</p>
            <p>No. Rekening 7196999501</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3 print:hidden">
          <button onClick={handlePrint} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold">
            Cetak Invoice
          </button>
          <button
            onClick={() => { setSaved(false); setItems([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]); setDiskon(0); setJumlahDibayar(0); setNoInvoice(""); setCustomer(""); setTanggal(""); }}
            className="flex-1 bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
          >
            Invoice Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-primary mb-4">Cetak Invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          <input placeholder="No Invoice" value={noInvoice} onChange={(e) => setNoInvoice(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
        </div>

        {/* Items */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold text-primary">Item</h2>
          {items.map((item, idx) => (
            <div key={idx} className="space-y-2 pb-3 border-b border-border last:border-0">
              <div className="flex gap-2 items-start">
                <select
                  value={item.nama_barang}
                  onChange={(e) => updateItem(idx, "nama_barang", e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Pilih Barang</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.nama_barang}>{p.nama_barang}</option>
                  ))}
                </select>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="p-2 text-destructive hover:bg-muted rounded-lg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Harga</label>
                  <input type="number" value={item.harga || ""} onChange={(e) => updateItem(idx, "harga", Number(e.target.value))}
                    className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Jumlah</label>
                  <input type="number" value={item.jumlah || ""} onChange={(e) => updateItem(idx, "jumlah", Number(e.target.value))}
                    className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" min={1} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subtotal</label>
                  <p className="px-2 py-2 text-sm font-medium text-primary">Rp {fmt(item.subtotal)}</p>
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-primary font-medium">
            <Plus size={16} /> Tambah Item
          </button>
        </div>

        {/* Payment */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold text-primary">Rp {fmt(subtotal)}</span>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Diskon</label>
            <input type="number" value={diskon || ""} onChange={(e) => setDiskon(Number(e.target.value))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-primary">Rp {fmt(total)}</span>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Jumlah Dibayar</label>
            <input type="number" value={jumlahDibayar || ""} onChange={(e) => setJumlahDibayar(Number(e.target.value))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sisa</span>
            <span className="font-medium">Rp {fmt(sisa)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-bold ${status === "LUNAS" ? "text-primary" : "text-destructive"}`}>{status}</span>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan & Lihat Invoice"}
        </button>
      </form>
    </div>
  );
};

export default CetakInvoice;
