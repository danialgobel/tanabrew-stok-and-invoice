import { useState, useEffect } from "react";
import {
  Home,
  Package,
  FileText,
  History,
  User,
  MessageSquare,
  ShieldAlert,
  LogOut,
  Clock,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { triggerHaptic } from "@/lib/haptics";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CURRENT_RELEASE } from "@/config/appRelease";
import { openAppChangelogModal } from "@/components/AppUpdateAnnouncementModal";
import { useUnreadChat } from "@/hooks/useUnreadChat";

interface DesktopSidebarProps {
  onSecretLogoClick?: () => void;
}

export const DesktopSidebar = ({ onSecretLogoClick }: DesktopSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile, logout } = useAuth();
  const { hasUnreadChat } = useUnreadChat();
  const [hasUnpaid, setHasUnpaid] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [logoClicks, setLogoClicks] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("tanabrew_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("tanabrew_sidebar_collapsed", String(collapsed));
    window.dispatchEvent(
      new CustomEvent("tanabrew:sidebar-state-change", { detail: { collapsed } })
    );
  }, [collapsed]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(now)
      );
      setCurrentDate(
        new Intl.DateTimeFormat("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(now)
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleLogoClick = () => {
    triggerHaptic(10);
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        triggerHaptic(20);
        if (onSecretLogoClick) {
          onSecretLogoClick();
        } else {
          window.dispatchEvent(new CustomEvent("tanabrew:open-pricelist-modal"));
        }
        return 0;
      }
      return next;
    });
  };

  const isOwnerOrDev = userProfile?.role === "owner" || userProfile?.role === "webdev";

  const navItems = [
    { path: "/", label: "Beranda", icon: Home, desc: "Dashboard & Metrik" },
    { path: "/update-stok", label: "Update Stok", icon: Package, desc: "Gudang & Inventaris" },
    { path: "/cetak-invoice", label: "Cetak Invoice", icon: FileText, desc: "Kasir & Transaksi" },
    { path: "/riwayat", label: "Riwayat", icon: History, badge: hasUnpaid, desc: "Laporan & Log" },
    { path: "/obrolan", label: "Obrolan Tim", icon: MessageSquare, badge: hasUnreadChat, desc: "Pesan & Koordinasi" },
    { path: "/akun", label: "Akun Saya", icon: User, desc: "Profil & Pengaturan" },
    ...(isOwnerOrDev
      ? [{ path: "/god-mode", label: "Developer", icon: ShieldAlert, desc: "Akses Developer" }]
      : []),
  ];

  const handleLogout = async () => {
    triggerHaptic(20);
    const confirm = window.confirm("Apakah Anda yakin ingin logout dari akun Tanabrew?");
    if (confirm) {
      await logout();
      navigate("/login");
    }
  };

  const displayName = userProfile?.name || currentUser?.email || "User";
  const roleLabel =
    userProfile?.role === "owner"
      ? "Owner"
      : userProfile?.role === "webdev"
      ? "Developer"
      : userProfile?.role === "admin"
      ? "Admin"
      : "Staff";

  return (
    <aside
      className={`hidden lg:flex fixed top-0 bottom-0 left-0 z-40 flex-col bg-card/90 dark:bg-card/95 backdrop-blur-2xl border-r border-border shadow-xl select-none transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className={`p-4 border-b border-border/80 flex items-center justify-between gap-2 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            onClick={handleLogoClick}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform overflow-hidden group"
            title="Klik 5x untuk menu rahasia Price List"
          >
            <img
              src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
              alt="Tanabrew"
              className="h-full w-full object-cover"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1
                  onClick={handleLogoClick}
                  className="font-black text-base tracking-tight text-primary cursor-pointer hover:opacity-90 transition-opacity truncate"
                >
                  Tanabrew
                </h1>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground truncate">Trademark</p>
            </div>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(8);
            setCollapsed(!collapsed);
          }}
          className={`p-1.5 rounded-xl border border-border/60 bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ${
            collapsed ? "absolute -right-3.5 top-6 bg-card shadow-md z-50 border-primary/30 text-primary" : ""
          }`}
          title={collapsed ? "Mekarkan Sidebar" : "Ciutkan Sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Live Clock & Date Widget (Expanded Only) */}
      {!collapsed && (
        <div className="mx-3 mt-3 rounded-xl border border-border/60 bg-muted/40 p-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock size={12} className="text-primary animate-pulse" />
            <span className="font-mono font-bold text-foreground text-[11px]">{currentTime || "..."}</span>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground truncate">{currentDate}</span>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3.5 space-y-1.5 scrollbar-thin">
        {!collapsed && (
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Menu Utama
          </div>
        )}
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                triggerHaptic(active ? 8 : 12);
                navigate(item.path);
              }}
              title={collapsed ? `${item.label} (${item.desc})` : undefined}
              className={`group relative flex w-full items-center rounded-xl text-left transition-all duration-200 cursor-pointer ${
                collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]"
              }`}
            >
              <div className="relative shrink-0">
                <item.icon
                  size={19}
                  strokeWidth={active ? 2.5 : 2}
                  className={`transition-transform duration-200 ${
                    active ? "scale-110" : "group-hover:scale-110"
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive border border-background"></span>
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs leading-none truncate ${active ? "font-bold text-primary-foreground" : "font-semibold"}`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] leading-tight mt-1 truncate ${active ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>
                      {item.desc}
                    </p>
                  </div>
                  {active && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground shadow-sm" />
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile & Changelog Trigger */}
      <div className="p-2.5 border-t border-border/80 space-y-2 bg-muted/20">
        <div
          onClick={() => {
            triggerHaptic(10);
            navigate("/akun");
          }}
          className={`flex items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2 hover:border-primary/40 active:scale-[0.98] transition-all cursor-pointer group ${
            collapsed ? "justify-center" : "justify-between"
          }`}
          title={collapsed ? `${displayName} (${roleLabel})` : undefined}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0 overflow-hidden border border-primary/20">
              {userProfile?.photo_url ? (
                <img
                  src={userProfile.photo_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.slice(0, 2).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {displayName}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">{roleLabel}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleLogout();
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout Akun"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>

        {/* Version Badge (Expanded Only) */}
        {!collapsed && (
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                openAppChangelogModal();
              }}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer font-medium"
            >
              <Sparkles size={11} className="text-primary" />
              <span>Tanabrew {CURRENT_RELEASE.versionLabel}</span>
            </button>
            <a
              href="/pricelist"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/80 hover:text-primary"
              title="Buka Menu Publik"
            >
              Menu <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
};
