import { useEffect, useState, useMemo } from "react";
import { doc, getDoc, updateDoc, serverTimestamp, increment, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addActivityLog } from "@/lib/activityLog";
import AnimatedNotification from "@/components/AnimatedNotification";
import { createInvoiceWithNumberAndStock, updateInvoiceWithStock } from "@/lib/invoiceNumber";
import { sendTanabrewNotification } from "@/lib/notificationSender";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import type { Product, Invoice, InvoiceItem } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, ShoppingBag, Check, Coffee, Layers, Grid, List, Minus, Sparkles, Tag, Receipt, FileText, Package } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { useSearchParams, useNavigate } from "react-router-dom";
import { triggerHaptic } from "@/lib/haptics";
import { todayInputValue, parseDateInput, formatDisplayDate, toValidDateInputValue } from "@/lib/dateUtils";
import { generateInvoicePdfBlob } from "@/lib/invoicePdfGenerator";
import { sendInvoiceToWhatsApp } from "@/lib/whatsappClient";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [tanggal, setTanggal] = useState(() => todayInputValue());
  const [noInvoice, setNoInvoice] = useState("");
  const [customer, setCustomer] = useState("");
  const [stockLocation, setStockLocation] = useState<StockLocation>(() => {
    return (localStorage.getItem("tanabrew_default_warehouse") as StockLocation) || "Jogja";
  });
  
  const [items, setItems] = useState<InvoiceItem[]>([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  const [diskon, setDiskon] = useState(0);
  const [jumlahDibayar, setJumlahDibayar] = useState(0);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState("");
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const [frequentCustomers, setFrequentCustomers] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchFrequentCustomers = async () => {
      try {
        const q = query(
          collection(db, "invoices"),
          orderBy("created_at", "desc"),
          limit(120)
        );
        const querySnapshot = await getDocs(q);
        const counts: Record<string, number> = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const name = data.customer ? String(data.customer).trim() : "";
          if (name && name !== "-" && name.toLowerCase() !== "offline" && name.toLowerCase() !== "penjualan offline") {
            counts[name] = (counts[name] || 0) + 1;
          }
        });
        
        const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        setFrequentCustomers(sorted.slice(0, 8));
      } catch (error) {
        console.error("Gagal memuat daftar customer sering dihubungi:", error);
      }
    };
    
    void fetchFrequentCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customer.trim()) return frequentCustomers;
    return frequentCustomers.filter((name) =>
      name.toLowerCase().includes(customer.toLowerCase().trim())
    );
  }, [customer, frequentCustomers]);

  useEffect(() => {
    if (!editId) return;

    const fetchInvoiceData = async () => {
      setLoadingInvoice(true);
      try {
        const snap = await getDoc(doc(db, "invoices", editId));
        if (snap.exists()) {
          const data = snap.data();
          const isOwnerOrWebdev = userProfile?.role === "owner" || userProfile?.role === "webdev";
          if (!isOwnerOrWebdev && (data.is_printed || data.status === "LUNAS")) {
            toast({
              title: "Akses Ditolak",
              description: "Hanya Owner yang dapat mengedit invoice yang sudah dicetak atau lunas.",
              variant: "destructive",
            });
            navigate("/riwayat");
            return;
          }

          setTanggal(toValidDateInputValue(data.tanggal || data.created_at));
          setCustomer(data.customer || "");
          setStockLocation(data.stock_location || "Jogja");
          setItems(
            Array.isArray(data.items)
              ? data.items.map((it: any) => ({
                  product_id: it.product_id || "",
                  nama_barang: it.nama_barang || "",
                  harga: Number(it.harga) || 0,
                  jumlah: Number(it.jumlah) || 0,
                  subtotal: Number(it.subtotal) || 0,
                }))
              : [{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]
          );
          setDiskon(Number(data.diskon) || 0);
          setJumlahDibayar(Number(data.jumlah_dibayar) || 0);
          setNoInvoice(data.no_invoice || "");
          setSavedInvoiceId(editId);
        } else {
          toast({ title: "Error", description: "Invoice tidak ditemukan", variant: "destructive" });
          navigate("/riwayat");
        }
      } catch (err) {
        console.error("Gagal memuat invoice untuk diedit", err);
        toast({ title: "Error", description: "Gagal memuat data invoice", variant: "destructive" });
        navigate("/riwayat");
      } finally {
        setLoadingInvoice(false);
      }
    };

    void fetchInvoiceData();
  }, [editId, navigate, toast, userProfile?.role]);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal - (diskon || 0);
  const sisa = total - (jumlahDibayar || 0);
  const status = sisa <= 0 ? "LUNAS" : "BELUM LUNAS";
  const canPrint = userProfile?.role === "admin" || userProfile?.role === "owner" || userProfile?.role === "webdev";
  const isAdmin = canPrint;

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  useEffect(() => {
    if (!actionNotice) return;

    const timer = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const showActionNotice = (title: string, description?: string) => {
    setActionNotice({ id: Date.now(), title, description });
  };

  const sendInvoiceNotification = (
    type: "CREATE_INVOICE" | "PRINT_INVOICE" | "UPDATE_PAYMENT_STATUS",
    invoiceId: string,
    invoiceNumber: string,
  ) => {
    if (!currentUser || !userProfile) return;

    void sendTanabrewNotification(
      {
        type,
        invoiceId,
        invoiceNumber,
        customer,
        total,
        actorName: userProfile.name,
        actorRole: userProfile.role === "admin" ? "admin" : "staff",
      },
      currentUser,
    ).catch((error) => {
      console.error("Gagal mengirim notifikasi invoice", error);
      toast({ title: "Perhatian", description: "Invoice berhasil diproses, tetapi notifikasi gagal dikirim." });
    });
  };

  const [posMode, setPosMode] = useState<"catalog" | "manual">("catalog");
  const [catalogCategory, setCatalogCategory] = useState<string>("Semua");
  const [catalogSearch, setCatalogSearch] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return ["Semua", ...Array.from(set)];
  }, [products]);

  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = catalogCategory === "Semua" || p.kategori === catalogCategory;
      const matchSearch = !catalogSearch.trim() || p.nama_barang.toLowerCase().includes(catalogSearch.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [products, catalogCategory, catalogSearch]);

  const handleAddProductFromCatalog = (product: Product) => {
    triggerHaptic(12);
    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.nama_barang === product.nama_barang);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentQty = updated[existingIdx].jumlah || 1;
        const newQty = currentQty + 1;
        const price = updated[existingIdx].harga || product.harga || 0;
        updated[existingIdx] = {
          ...updated[existingIdx],
          jumlah: newQty,
          subtotal: newQty * price,
        };
        return updated;
      }

      // If the only row is empty, replace it
      if (prev.length === 1 && !prev[0].nama_barang && (!prev[0].harga || prev[0].harga === 0)) {
        return [{
          product_id: product.id || "",
          nama_barang: product.nama_barang,
          harga: product.harga || 0,
          jumlah: 1,
          subtotal: product.harga || 0,
        }];
      }

      return [
        ...prev,
        {
          product_id: product.id || "",
          nama_barang: product.nama_barang,
          harga: product.harga || 0,
          jumlah: 1,
          subtotal: product.harga || 0,
        },
      ];
    });
  };

  const handleQuickCash = (amount: number | "exact") => {
    triggerHaptic(10);
    if (amount === "exact") {
      setJumlahDibayar(total > 0 ? total : 0);
    } else {
      setJumlahDibayar(amount);
    }
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

  const handleIncrementQty = (idx: number) => {
    triggerHaptic(8);
    setItems((prev) => {
      const next = [...prev];
      const newQty = (next[idx].jumlah || 1) + 1;
      next[idx] = {
        ...next[idx],
        jumlah: newQty,
        subtotal: newQty * (next[idx].harga || 0),
      };
      return next;
    });
  };

  const handleDecrementQty = (idx: number) => {
    triggerHaptic(8);
    setItems((prev) => {
      const next = [...prev];
      const curQty = next[idx].jumlah || 1;
      if (curQty <= 1) {
        if (next.length > 1) {
          return next.filter((_, i) => i !== idx);
        }
        return [{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }];
      }
      const newQty = curQty - 1;
      next[idx] = {
        ...next[idx],
        jumlah: newQty,
        subtotal: newQty * (next[idx].harga || 0),
      };
      return next;
    });
  };

  const addItem = () => {
    triggerHaptic(10);
    setItems([...items, { nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
  };
  const removeItem = (idx: number) => {
    triggerHaptic(10);
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    } else {
      setItems([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(15);
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

      if (isEditMode && savedInvoiceId) {
        await updateInvoiceWithStock({
          invoiceId: savedInvoiceId,
          invoiceData: {
            tanggal,
            customer,
            items: invoiceItems,
            subtotal,
            diskon,
            total,
            jumlah_dibayar: jumlahDibayar,
            sisa,
            status,
            edited_at: serverTimestamp(),
            edited_by: userProfile.name,
            edited_by_uid: currentUser.uid,
            edited_by_role: userProfile.role,
          },
          stockItems,
          stockLocation,
          user: { uid: currentUser.uid, name: userProfile.name, role: userProfile.role },
          customer,
        });

        setSaved(true);
        showActionNotice("Invoice berhasil diperbarui", `No Invoice: ${noInvoice}`);
        toast({ title: "Berhasil", description: "Invoice diperbarui" });
        sendInvoiceNotification("CREATE_INVOICE", savedInvoiceId, noInvoice);
      } else {
        const parsedDate = tanggal ? parseDateInput(tanggal) || new Date() : new Date();
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
          date: parsedDate,
        });
        setNoInvoice(generatedNoInvoice);
        setSavedInvoiceId(invoiceId);
        setSaved(true);
        showActionNotice("Invoice berhasil dibuat", `No Invoice: ${generatedNoInvoice}`);
        toast({ title: "Berhasil", description: "Invoice tersimpan" });
        sendInvoiceNotification("CREATE_INVOICE", invoiceId, generatedNoInvoice);
      }
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
    sendInvoiceNotification("PRINT_INVOICE", savedInvoiceId, noInvoice);

    // Otomatis kirim PDF invoice ke Grup WhatsApp
    const currentInvoiceData: Invoice = {
      id: savedInvoiceId,
      no_invoice: noInvoice,
      tanggal,
      customer,
      items: invoiceItems,
      subtotal,
      diskon,
      total,
      jumlah_dibayar: jumlahDibayar,
      sisa,
      status,
      stock_location: stockLocation,
      dibuat_oleh: userProfile.name,
      dibuat_oleh_role: userProfile.role,
    };

    void (async () => {
      try {
        const { base64, fileName } = await generateInvoicePdfBlob(currentInvoiceData);
        const waRes = await sendInvoiceToWhatsApp(currentUser, {
          invoice: currentInvoiceData,
          pdfBase64: base64,
          fileName,
        });

        if (waRes.alreadySent) {
          console.log("Invoice sudah terkirim ke WhatsApp sebelumnya.");
        } else {
          toast({
            title: "WhatsApp Terkirim",
            description: `PDF invoice berhasil dikirim ke grup ${waRes.groupName || "WhatsApp"}.`,
          });
        }
      } catch (waErr: any) {
        console.warn("Gagal mengirim PDF invoice ke WhatsApp:", waErr);
        toast({
          title: "Status WhatsApp",
          description: `Invoice berhasil dicetak, namun pengiriman WhatsApp gagal: ${waErr.message || "Server belum siap"}`,
        });
      }
    })();
  };

  const handlePrint = async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (!canPrint) {
      toast({ title: "Error", description: "Hanya Admin, Owner, atau Developer yang dapat mencetak invoice.", variant: "destructive" });
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
  .print-toolbar { position:sticky; top:0; z-index:20; display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:-16px -16px 16px; padding:10px 16px; background:#f1f8e9; border-bottom:1px solid #c8e6c9; }
  .back-button { min-height:42px; border:0; border-radius:10px; background:#2E7D32; color:#fff; padding:0 14px; font-size:15px; font-weight:700; cursor:pointer; }
  .back-button:active { transform:translateY(1px); }
  .back-note { display:none; font-size:12px; color:#49624c; }
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
  @media print { .no-print { display:none !important; } }
</style></head><body>
  <div class="print-toolbar no-print">
    <button type="button" class="back-button" onclick="kembaliTanabrew()">&larr; Kembali ke Tanabrew</button>
    <span id="back-note" class="back-note">Gunakan tombol kembali browser untuk kembali ke Tanabrew.</span>
  </div>
  <div class="head">
    <img src="https://i.ibb.co.com/Q7dCXq9q/logo-tanabrew-hijau.png" alt="Tanabrew" />
    <div class="info">
      <div><span>No Invoice:</span> ${noInvoice}</div>
      <div><span>Tanggal:</span> ${formatDisplayDate(tanggal)}</div>
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
    function kembaliTanabrew(){
      var note = document.getElementById('back-note');
      try {
        window.close();
        setTimeout(function(){
          if (window.closed) return;
          if (window.history.length > 1) {
            window.history.back();
            return;
          }
          if (note) note.style.display = 'inline';
        }, 160);
      } catch (error) {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        if (note) note.style.display = 'inline';
      }
    }
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

  if (loadingInvoice) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 pb-28 sm:pb-32 pt-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (saved) {
    return (
      <div className="px-4 pb-28 sm:pb-32 pt-6 max-w-lg mx-auto">
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
              <p><span className="text-muted-foreground">Tanggal:</span> {formatDisplayDate(tanggal)}</p>
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
            {!canPrint && (
              <p className="mt-2 text-xs text-destructive text-center">Hanya Admin atau Owner yang dapat mencetak invoice.</p>
            )}
          </div>
          <button
            onClick={() => {
              setSaved(false);
              setSavedInvoiceId("");
              setItems([{ nama_barang: "", harga: 0, jumlah: 1, subtotal: 0 }]);
              setDiskon(0);
              setJumlahDibayar(0);
              setNoInvoice("");
              setCustomer("");
              setTanggal(todayInputValue());
              setStockLocation("Jogja");
              navigate("/cetak-invoice");
            }}
            className="flex-1 bg-muted text-muted-foreground rounded-lg py-2.5 text-sm font-medium"
          >
            Invoice Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-7xl px-4 sm:px-6 lg:px-8 pb-28 sm:pb-32 pt-4 lg:pt-8">
      {actionNotice && (
        <AnimatedNotification
          key={actionNotice.id}
          title={actionNotice.title}
          description={actionNotice.description}
        />
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-primary">
            {isEditMode ? `Edit Invoice (${noInvoice})` : "Kasir & Cetak Invoice"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pilih gudang pengeluaran stok, masukkan data pelanggan dan item transaksi.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: POS Catalog & Item Management (Desktop 7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer & Location Card */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tanggal Transaksi</label>
                <input 
                  type="date" 
                  value={tanggal} 
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
                  required 
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Lokasi Gudang Pengeluaran</label>
                <select
                  value={stockLocation}
                  onChange={(e) => setStockLocation(e.target.value as StockLocation)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                >
                  <option value="Jogja">Gudang Jogja</option>
                  <option value="Lombok">Gudang Lombok</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Nama Pelanggan / Customer</label>
              <input 
                placeholder="Contoh: Bpk. Ahmad / Kedai Kopi Selaras" 
                value={customer} 
                onChange={(e) => setCustomer(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
                required 
              />
              {showSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Sering Dihubungi</div>
                  {filteredCustomers.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCustomer(name);
                        setShowSuggestions(false);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground text-left transition-colors cursor-pointer"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* POS Mode Switcher & Catalog Grid */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPosMode("catalog")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    posMode === "catalog"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Grid size={14} /> Katalog Kartu POS
                </button>
                <button
                  type="button"
                  onClick={() => setPosMode("manual")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    posMode === "manual"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List size={14} /> Form Baris Manual
                </button>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">{items.filter(i => i.nama_barang).length} Item Dipilih</span>
            </div>

            {/* Catalog Mode */}
            {posMode === "catalog" && (
              <div className="space-y-3">
                {/* Search & Category Filter Chips */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari biji kopi / produk..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          triggerHaptic(8);
                          setCatalogCategory(cat);
                        }}
                        className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                          catalogCategory === cat
                            ? "bg-primary/15 text-primary border border-primary/30 shadow-xs"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Grid Cards */}
                {loadingProducts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                  </div>
                ) : filteredCatalogProducts.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 p-6 text-center text-xs text-muted-foreground">
                    Tidak ada produk sesuai pencarian.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto scrollbar-thin p-0.5">
                    {filteredCatalogProducts.map((prod) => {
                      const stockVal = stockLocation === "Jogja" ? prod.stok_jogja : prod.stok_lombok;
                      const isLow = (stockVal || 0) <= 5;
                      const isOut = (stockVal || 0) <= 0;
                      const inCart = items.find((i) => i.nama_barang === prod.nama_barang);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleAddProductFromCatalog(prod)}
                          className={`group relative rounded-xl border p-3 text-left transition-all cursor-pointer active:scale-95 select-none ${
                            inCart
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                          }`}
                        >
                          {inCart && (
                            <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-xs">
                              {inCart.jumlah}
                            </span>
                          )}
                          <p className="font-bold text-xs text-foreground line-clamp-2 pr-5 leading-tight">
                            {prod.nama_barang}
                          </p>
                          <p className="text-xs font-black text-primary mt-1.5">
                            Rp {fmt(prod.harga || 0)}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className={`font-semibold rounded-md px-1.5 py-0.5 ${
                              isOut 
                                ? "bg-destructive/15 text-destructive" 
                                : isLow 
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" 
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            }`}>
                              Stok: {stockVal || 0}
                            </span>
                            <span className="text-primary font-bold opacity-80 group-hover:opacity-100">+ Tambah</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected Items Cart List */}
            <div className="border-t border-border pt-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShoppingBag size={13} /> Rincian Keranjang ({items.filter(i => i.nama_barang).length})
              </h3>

              <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {posMode === "manual" ? (
                          <select
                            value={item.nama_barang}
                            onChange={(e) => updateItem(idx, "nama_barang", e.target.value)}
                            className="w-full truncate rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring font-medium"
                          >
                            <option value="">Pilih Produk Kopi</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.nama_barang}>
                                {p.nama_barang} (Stok: {stockLocation === "Jogja" ? p.stok_jogja : p.stok_lombok})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs font-bold text-foreground truncate">{item.nama_barang || "Pilih produk dari katalog..."}</p>
                        )}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeItem(idx)} 
                        className="shrink-0 p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                        title="Hapus baris"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-muted-foreground">Harga:</label>
                        <input 
                          type="number" 
                          value={item.harga || ""} 
                          onChange={(e) => updateItem(idx, "harga", Number(e.target.value))}
                          placeholder="0"
                          className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono" 
                        />
                      </div>

                      {/* Qty Stepper */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecrementQty(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-7 text-center font-bold text-xs">{item.jumlah || 1}</span>
                        <button
                          type="button"
                          onClick={() => handleIncrementQty(idx)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <span className="font-bold text-primary text-xs">Rp {fmt(item.subtotal)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {posMode === "manual" && (
                <button 
                  type="button" 
                  onClick={addItem} 
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer pt-1"
                >
                  <Plus size={15} /> Tambah Baris Manual
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: POS Payment & Checkout Summary (Desktop 5 Cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground border-b border-border pb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt size={16} className="text-primary" /> Struk Pembayaran
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                POS Kasir
              </span>
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal ({items.filter(i => i.nama_barang).length} Item)</span>
                <span className="font-bold text-foreground">Rp {fmt(subtotal)}</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Diskon / Potongan Harga (Rp)</label>
                <input 
                  type="number" 
                  value={diskon || ""} 
                  onChange={(e) => setDiskon(Number(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono" 
                />
              </div>

              <div className="border-t border-border/80 pt-2.5 flex justify-between items-baseline">
                <span className="font-bold text-foreground">Total Pembayaran</span>
                <span className="font-black text-primary text-xl">Rp {fmt(total)}</span>
              </div>

              {/* Quick Cash Buttons */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-muted-foreground block font-semibold">Pecahan Uang Cepat (Quick Cash)</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleQuickCash("exact")}
                    className="rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary py-1.5 font-bold transition-all cursor-pointer text-center"
                  >
                    Uang Pas
                  </button>
                  {[50000, 100000, 200000, 500000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickCash(val)}
                      className="rounded-lg border border-border bg-muted/40 hover:bg-muted py-1.5 font-semibold text-foreground transition-all cursor-pointer text-center text-[11px]"
                    >
                      {val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Jumlah Uang Diterima (Rp)</label>
                <input 
                  type="number" 
                  value={jumlahDibayar || ""} 
                  onChange={(e) => setJumlahDibayar(Number(e.target.value))}
                  placeholder="0"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono font-bold" 
                />
              </div>

              <div className="flex justify-between text-sm rounded-xl bg-muted/40 p-2.5">
                <span className="text-muted-foreground font-medium">{sisa <= 0 ? "Kembalian Kasir" : "Sisa Piutang"}</span>
                <span className={`font-black text-base ${sisa <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  Rp {fmt(Math.abs(sisa))}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Status Pelunasan</span>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  status === "LUNAS" 
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30" 
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}>
                  {status}
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={saving || loadingProducts}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-3.5 text-sm font-bold shadow-md shadow-primary/25 transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              {saving ? "Menyimpan Invoice..." : loadingProducts ? "Memuat Produk..." : "Simpan & Cetak Invoice"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CetakInvoice;
