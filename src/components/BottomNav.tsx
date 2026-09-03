import { useEffect, useState } from "react";
import { Home, Package, FileText, History, User, MessageSquare } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { triggerHaptic } from "@/lib/haptics";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUnreadChat } from "@/hooks/useUnreadChat";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasUnreadChat } = useUnreadChat();
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
    { path: "/obrolan", label: "Obrolan", icon: MessageSquare, badge: hasUnreadChat },
    { path: "/riwayat", label: "Riwayat", icon: History, badge: hasUnpaid },
    { path: "/akun", label: "Akun", icon: User },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.25rem)] max-w-lg print:hidden select-none transition-all duration-300"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="relative flex h-[3.85rem] w-full items-center justify-around rounded-2xl sm:rounded-3xl border border-white/70 dark:border-white/10 bg-card/85 dark:bg-card/90 backdrop-blur-2xl px-1.5 py-1 shadow-[0_12px_36px_-6px_rgba(22,78,33,0.18)] dark:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.55)]">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => {
                triggerHaptic(active ? 8 : 14);
                navigate(tab.path);
              }}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center h-full py-1 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer ${
                active
                  ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25 scale-[1.02]"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/40 active:scale-90"
              }`}
            >
              <div className="relative">
                <tab.icon
                  size={19}
                  strokeWidth={active ? 2.5 : 2}
                  className={`transition-transform duration-300 ${active ? "scale-110" : "scale-100"}`}
                />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive border border-background"></span>
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full px-0.5 ${
                active ? "font-bold text-primary-foreground" : "font-medium"
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
