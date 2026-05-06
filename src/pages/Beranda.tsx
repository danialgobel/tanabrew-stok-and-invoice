import { useProducts } from "@/hooks/useProducts";
import { useState } from "react";
import { X } from "lucide-react";

const Beranda = () => {
  const { products, loading } = useProducts();
  const [modal, setModal] = useState<"jogja" | "lombok" | null>(null);

  const totalProduk = products.length;
  const totalStok = products.reduce((s, p) => s + (p.total_stok || 0), 0);
  const stokJogja = products.reduce((s, p) => s + (p.stok_jogja || 0), 0);
  const stokLombok = products.reduce((s, p) => s + (p.stok_lombok || 0), 0);

  const cards = [
    { label: "Total Produk", value: totalProduk, clickable: false },
    { label: "Total Stok", value: totalStok, clickable: false },
    { label: "Stok Jogja", value: stokJogja, clickable: true, key: "jogja" as const },
    { label: "Stok Lombok", value: stokLombok, clickable: true, key: "lombok" as const },
  ];

  return (
    <div className="px-4 pb-24 pt-6 max-w-lg mx-auto">
      {/* Logo */}
      <div className="flex flex-col items-center mb-6">
        <img
          src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
          alt="Tanabrew Logo"
          className="w-24 h-24 rounded-full object-cover border-2 border-primary bg-primary"
        />
        <h1 className="text-xl font-bold text-primary mt-3">Tanabrew</h1>
        <p className="text-sm text-muted-foreground">Trademark</p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map((c) => (
          <button
            key={c.label}
            disabled={!c.clickable}
            onClick={() => c.clickable && c.key && setModal(c.key)}
            className={`rounded-xl bg-card border border-border p-4 text-center transition-shadow ${
              c.clickable ? "cursor-pointer active:shadow-md hover:border-primary/40" : "cursor-default"
            }`}
          >
            <p className="text-2xl font-bold text-primary">{loading ? "..." : c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Stock Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-primary/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-primary">Tabel Stok</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-3 py-2 text-left font-medium">Nama Barang</th>
                <th className="px-3 py-2 text-center font-medium">Jogja</th>
                <th className="px-3 py-2 text-center font-medium">Lombok</th>
                <th className="px-3 py-2 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Memuat...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Belum ada produk</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2">{p.nama_barang}</td>
                    <td className="px-3 py-2 text-center">{p.stok_jogja}</td>
                    <td className="px-3 py-2 text-center">{p.stok_lombok}</td>
                    <td className="px-3 py-2 text-center font-medium">{p.total_stok}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setModal(null)}>
          <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-primary">
                Stok {modal === "jogja" ? "Jogja" : "Lombok"}
              </h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-full hover:bg-muted">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-muted">
                  <span className="text-sm">{p.nama_barang}</span>
                  <span className="text-sm font-semibold text-primary">
                    {modal === "jogja" ? p.stok_jogja : p.stok_lombok}
                  </span>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">Belum ada data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Beranda;
