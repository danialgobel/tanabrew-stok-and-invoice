import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import AnimatedNotification from "@/components/AnimatedNotification";
import { createInvoiceWithNumberAndStock } from "@/lib/invoiceNumber";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import type { InvoiceItem } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/Skeleton";

type ActionNotice = {
  id: number;
  title: string;
  description?: string;
};
type StockLocation = "Jogja" | "Lombok";

const CetakInvoice = () => {
  const { products, loading: loadingProducts } = useProducts();
  const { currentUser, userProfile } = useAuth();
  const { toast } = useToast();
  const [tanggal, setTanggal] = useState("");
  const [noInvoice, setNoInvoice] = useState("");
  const [customer, setCustomer] = useState("");
  const [stockLocation, setStockLocation] = useState<StockLocation>("Jogja");
  
  const [items, setItems] = useState<InvoiceItem[]>([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  const [diskon, setDiskon] = useState(0);
  const [jumlahDibayar, setJumlahDibayar] = useState(0);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState("");
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal - (diskon || 0);
  const sisa = total - (jumlahDibayar || 0);
  const status = sisa <= 0 ? "LUNAS" : "BELUM LUNAS";
  const isAdmin = userProfile?.role === "admin";

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  useEffect(() => {
    if (!actionNotice) return;

    const timer = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const showActionNotice = (title: string, description?: string) => {
    setActionNotice({ id: Date.now(), title, description });
  };

  const updateItem = (idx: number, field: string, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "nama_barang") {
        const prod = products.find((p) => p.nama_barang === value);
        if (prod) {
          item.product_id = prod.id;
          item.harga = prod.harga;
        } else {
          item.product_id = "";
        }
      }
      item.subtotal = (item.harga || 0) * (item.jumlah || 0);
      next[idx] = item;
      return next;
    });
  };

  const addItem = () => setItems([...items, { nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  const removeItem = (idx: number) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invoiceItems = items.filter((i) => i.nama_barang && i.jumlah > 0);
    if (!customer.trim() || invoiceItems.length === 0) return;
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const stockItems = invoiceItems.map((item) => {
        const product = item.product_id
          ? products.find((p) => p.id === item.product_id)
          : products.find((p) => p.nama_barang === item.nama_barang);

        if (!product?.id) {
          throw new Error(`Produk ${item.nama_barang} tidak ditemukan.`);
        }

        return {
          productId: product.id,
          productName: product.nama_barang,
          quantity: Number(item.jumlah) || 0,
        };
      });
      const { invoiceId, noInvoice: generatedNoInvoice } = await createInvoiceWithNumberAndStock({
        invoiceData: {
        tanggal, customer,
          items: invoiceItems,
          subtotal, diskon, total, jumlah_dibayar: jumlahDibayar, sisa, status,
        dibuat_oleh: userProfile.name,
        dibuat_oleh_uid: currentUser.uid,
        dibuat_oleh_role: userProfile.role,
        created_at: serverTimestamp(),
        is_printed: false,
        printed_at: null,
        printed_by: "",
        printed_by_uid: "",
        printed_by_role: "",
        print_count: 0,
        },
        stockItems,
        stockLocation,
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        customer,
      });
      setNoInvoice(generatedNoInvoice);
      setSavedInvoiceId(invoiceId);
      setSaved(true);
      showActionNotice("Invoice berhasil dibuat", `No Invoice: ${generatedNoInvoice}`);
      toast({ title: "Berhasil", description: "Invoice tersimpan" });
    } catch (error) {
      const description = error instanceof Error && error.message ? error.message : "Gagal menyimpan";
      toast({ title: "Error", description, variant: "destructive" });
    }
    setSaving(false);
  };

  const updatePrintStatus = async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat mencetak invoice.", variant: "destructive" });
      return;
    }

    if (!savedInvoiceId) return;

    try {
      await updateDoc(doc(db, "invoices", savedInvoiceId), {
        is_printed: true,
        printed_at: serverTimestamp(),
        printed_by: userProfile.name,
        printed_by_uid: currentUser.uid,
        printed_by_role: userProfile.role,
        print_count: increment(1),
      });
    } catch {
      toast({ title: "Error", description: "Gagal memperbarui status cetak invoice.", variant: "destructive" });
      return;
    }

    try {
      await addActivityLog({
        user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
        action: "PRINT_INVOICE",
        targetType: "invoice",
        targetId: savedInvoiceId,
        targetName: noInvoice,
        description: `${userProfile.name} mencetak invoice ${noInvoice}`,
      });
    } catch {
      toast({ title: "Perhatian", description: "Status cetak tersimpan, tetapi log aktivitas gagal dibuat." });
    }

    showActionNotice("Invoice diproses untuk dicetak", "Status cetak diperbarui");
  };

  const handlePrint = async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat mencetak invoice.", variant: "destructive" });
      return;
    }

    setPrinting(true);
    const itemsHtml = items.filter((i) => i.nama_barang).map((item) => `
      <tr>
        <td style="padding:8px;border-top:1px solid #ddd;">${item.nama_barang}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:right;">Rp ${fmt(item.harga)}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:center;">${item.jumlah}</td>
        <td style="padding:8px;border-top:1px solid #ddd;text-align:right;">Rp ${fmt(item.subtotal)}</td>
      </tr>
    `).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${noInvoice}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color:#111; margin:0; padding:16px; font-size:13px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .head img { width:140px; height:auto; }
  .info { text-align:right; line-height:1.5; }
  .info span { color:#666; }
  h2 { text-align:center; color:#2E7D32; margin:8px 0 16px; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  thead th { background:#A5D6A7; padding:8px; text-align:left; font-weight:600; }
  thead th.r { text-align:right; } thead th.c { text-align:center; }
  .sum { border-top:1px solid #ddd; padding-top:8px; }
  .row { display:flex; justify-content:space-between; padding:2px 0; }
  .bold { font-weight:700; }
  .green { color:#2E7D32; }
  .red { color:#c0392b; }
  .foot { border-top:1px solid #ddd; padding-top:8px; margin-top:12px; font-size:11px; color:#555; }
  .foot b { color:#111; display:block; margin-bottom:4px; }
</style></head><body>
  <div class="head">
    <img src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png" alt="Tanabrew" />
    <div class="info">
      <div><span>No Invoice:</span> ${noInvoice}</div>
      <div><span>Tanggal:</span> ${tanggal}</div>
      <div><span>Customer:</span> ${customer}</div>
      <div><span>Stok Keluar:</span> ${stockLocation}</div>
    </div>
  </div>
  <h2>INVOICE</h2>
  <table>
    <thead><tr><th>Nama Barang</th><th class="r">Harga</th><th class="c">Jumlah</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>Rp ${fmt(subtotal)}</span></div>
    ${diskon > 0 ? `<div class="row"><span>Diskon</span><span>- Rp ${fmt(diskon)}</span></div>` : ""}
    <div class="row bold"><span>Total</span><span>Rp ${fmt(total)}</span></div>
    <div class="row"><span>Jumlah Dibayar</span><span>Rp ${fmt(jumlahDibayar)}</span></div>
    <div class="row"><span>Sisa Pembayaran</span><span>Rp ${fmt(sisa)}</span></div>
    <div class="row bold"><span>Status</span><span class="${status === "LUNAS" ? "green" : "red"}">${status}</span></div>
  </div>
  <div class="foot">
    <b>Instruksi Pembayaran</b>
    <div>Transfer ke Seabank a.n. AHMAD FARID MUSADDAD</div>
    <div>No. Rekening 9011 2193 2420</div>
    <div style="margin-top:6px;">Transfer ke BSI a.n. AHMAD FARID MUSADDAD</div>
    <div>No. Rekening 7196999501</div>
  </div>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ window.focus(); window.print(); }, 300);
    });
  <\/script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      // Fallback: write into iframe and print (popup blocked on some mobiles)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const idoc = iframe.contentWindow?.document;
      if (idoc) {
        idoc.open();
        idoc.write(html);
        idoc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
        await updatePrintStatus();
      }
      setPrinting(false);
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();

    await updatePrintStatus();
    setPrinting(false);
  };

  if (saved) {
    return (
      <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
        {actionNotice && (
          <AnimatedNotification
            key={actionNotice.id}
            title={actionNotice.title}
            description={actionNotice.description}
          />
        )}

        {/* Invoice Preview */}
        <div id="invoice" className="tanabrew-page-enter bg-card rounded-xl border border-border p-5">
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
              <p><span className="text-muted-foreground">Stok Keluar:</span> {stockLocation}</p>
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
          <div className="flex-1">
            <button
              onClick={handlePrint}
              disabled={!isAdmin || printing}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {printing ? "Memproses Cetak..." : "Cetak Invoice"}
            </button>
            {!isAdmin && (
              <p className="mt-2 text-xs text-destructive text-center">Hanya admin yang dapat mencetak invoice.</p>
            )}
          </div>
          <button
            onClick={() => { setSaved(false); setSavedInvoiceId(""); setItems([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]); setDiskon(0); setJumlahDibayar(0); setNoInvoice(""); setCustomer(""); setTanggal(""); setStockLocation("Jogja"); }}
            className="flex-1 bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
          >
            Invoice Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-24 pt-6">
      {actionNotice && (
        <AnimatedNotification
          key={actionNotice.id}
          title={actionNotice.title}
          description={actionNotice.description}
        />
      )}

      <h1 className="text-lg font-bold text-primary mb-4">Cetak Invoice</h1>

      <form onSubmit={handleSubmit} className="max-w-full space-y-3">
        <div className="max-w-full bg-card rounded-xl border border-border p-4 space-y-3">
          <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-sm font-semibold text-primary">Nomor invoice akan dibuat otomatis saat invoice disimpan.</p>
            <p className="mt-1 text-xs text-muted-foreground">Format: INV/TNB/YYYY/MM/0001</p>
          </div>
          <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Lokasi Stok Keluar</label>
            <select
              value={stockLocation}
              onChange={(e) => setStockLocation(e.target.value as StockLocation)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Jogja">Jogja</option>
              <option value="Lombok">Lombok</option>
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="max-w-full overflow-hidden bg-card rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold text-primary">Item</h2>
          {loadingProducts && (
            <div className="space-y-2 rounded-lg bg-primary/5 p-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {items.map((item, idx) => (
            <div key={idx} className="max-w-full space-y-2 overflow-hidden border-b border-border pb-3 last:border-0">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <select
                    value={item.nama_barang}
                    onChange={(e) => updateItem(idx, "nama_barang", e.target.value)}
                    className="w-full min-w-0 max-w-full truncate rounded-lg border border-input bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
                  >
                    <option value="">Pilih Barang</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.nama_barang}>
                        {p.nama_barang} - Stok {stockLocation}: {stockLocation === "Jogja" ? p.stok_jogja : p.stok_lombok}
                      </option>
                    ))}
                  </select>
                  {item.nama_barang && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">{item.nama_barang}</p>
                  )}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="shrink-0 p-2 text-destructive hover:bg-muted rounded-lg">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Subtotal</label>
                  <p className="break-words rounded-lg bg-primary/5 px-2 py-2 text-sm font-medium text-primary">Rp {fmt(item.subtotal)}</p>
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

        <button type="submit" disabled={saving || loadingProducts}
          className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? "Menyimpan Invoice..." : loadingProducts ? "Memuat Produk..." : "Simpan & Lihat Invoice"}
        </button>
      </form>
    </div>
  );
};

export default CetakInvoice;
