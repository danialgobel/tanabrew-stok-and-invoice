import { useEffect, useState } from "react";
import { Home, Package, FileText, History, User, MessageSquare } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { triggerHaptic } from "@/lib/haptics";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [hasUnpaid, setHasUnpaid] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "invoices"),
      where("status", "in", ["BELUM LUNAS", "DRAFT", "Pending"]),
      limit(1)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setHasUnpaid(!snapshot.empty);
      },
      (error) => {
        console.warn("Unpaid badge listener error", error);
      }
    );
    return () => unsubscribe();
  }, []);

  const tabs = [
    { path: "/", label: "Beranda", icon: Home },
    { path: "/update-stok", label: "Stok", icon: Package },
    { path: "/cetak-invoice", label: "Invoice", icon: FileText },
    { path: "/obrolan", label: "Obrolan", icon: MessageSquare },
    { path: "/riwayat", label: "Riwayat", icon: History, badge: hasUnpaid },
    { path: "/akun", label: "Akun", icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-full overflow-x-hidden bg-card border-t border-border print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => {
                triggerHaptic(10);
                navigate(tab.path);
              }}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 transition-colors ${
                active ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <tab.icon size={20} strokeWidth={active ? 2.5 : 2} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive"></span>
                  </span>
                )}
              </div>
              <span className="max-w-full truncate text-[10px] leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

