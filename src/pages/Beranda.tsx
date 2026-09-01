import { useProducts } from "@/hooks/useProducts";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { arrayUnion, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Bell, LogOut, X, TrendingUp, DollarSign, ShoppingBag, Award, User as UserIcon, Calendar, ArrowRight, CheckCircle2, AlertCircle, Package, Receipt, ChevronRight, Sparkles, Plus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import WelcomeAnimation from "@/components/WelcomeAnimation";
import PriceListManagerModal from "@/components/PriceListManagerModal";
import { CardSkeleton, Skeleton } from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";
import { sendTanabrewNotification } from "@/lib/notificationSender";
import { triggerHaptic } from "@/lib/haptics";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  syncOneSignalUserIdentity,
  type OneSignalPermissionState,
} from "@/lib/onesignal";
import { getInvoiceDateValue, getDateValue, formatInvoiceDate as formatInvoiceDateUtil } from "@/lib/dateUtils";
import type { ActivityLog, Invoice } from "@/types";

const actionLabel = (action?: string) => {
  switch (action) {
    case "CREATE_PRODUCT":
      return "Tambah Produk";
    case "UPDATE_PRODUCT":
      return "Edit Produk";
    case "DELETE_PRODUCT":
      return "Hapus Produk";
    case "CREATE_INVOICE":
      return "Buat Invoice";
    case "PRINT_INVOICE":
      return "Cetak Invoice";
    case "UPDATE_PAYMENT_STATUS":
      return "Tandai Lunas";
    case "OWNER_ANNOUNCEMENT":
      return "Arahan Owner";
    default:
      return action || "Aktivitas";
  }
};

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

type SummaryModalType = "lunas" | "belum_lunas" | "stok_aman" | "stok_menipis" | "stok_habis";
type OverviewModalType = "omzet" | "transaksi" | "terjual" | null;
type StockModalType = "total_produk" | "total_stok" | "jogja" | "lombok" | null;

const hasWelcomeAnimationFlag = () => sessionStorage.getItem("showWelcomeAnimation") === "true";

const Beranda = () => {
  const { products, loading } = useProducts();
  const { currentUser, userProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [modal, setModal] = useState<StockModalType>(null);
  const [summaryModal, setSummaryModal] = useState<SummaryModalType | null>(null);
  const [overviewModal, setOverviewModal] = useState<OverviewModalType>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("tanabrew_dismissed_activity_ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [tickerIndex, setTickerIndex] = useState(0);
  const [adminInvoices, setAdminInvoices] = useState<Invoice[]>([]);
  const [dashboardInvoices, setDashboardInvoices] = useState<Invoice[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [invoiceReminderError, setInvoiceReminderError] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<OneSignalPermissionState>(() => getNotificationPermissionState());
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSyncLoading, setNotificationSyncLoading] = useState(false);
  const [notificationTestLoading, setNotificationTestLoading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("Arahan Owner Tanabrew");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showOwnerCommandMode, setShowOwnerCommandMode] = useState(false);
  const shouldShowWelcomeFromRoute = Boolean((location.state as { showWelcomeAnimation?: boolean } | null)?.showWelcomeAnimation);
  const shouldShowWelcome = shouldShowWelcomeFromRoute || hasWelcomeAnimationFlag();
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(() => shouldShowWelcome);
  const [homeIntroReady, setHomeIntroReady] = useState(() => !shouldShowWelcome);

  const totalProduk = products.length;
  const totalStok = products.reduce((s, p) => s + (p.total_stok || 0), 0);
  const stokJogja = products.reduce((s, p) => s + (p.stok_jogja || 0), 0);
  const stokLombok = products.reduce((s, p) => s + (p.stok_lombok || 0), 0);
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const displayName = userProfile?.name || currentUser?.email || "-";
  const roleLabel = userProfile?.role === "owner" ? "Owner" : userProfile?.role === "admin" ? "Admin" : userProfile?.role === "staff" ? "Staff" : "-";
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "owner";
  const isOwner = userProfile?.role === "owner";
  const [showPriceListModal, setShowPriceListModal] = useState(false);

  const handleLogoClick = () => {
    triggerHaptic(10);
    setLogoClickCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        triggerHaptic(20);
        setShowPriceListModal(true);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    const handleOpenPricelist = () => {
      setShowPriceListModal(true);
    };
    window.addEventListener("tanabrew:open-pricelist-modal", handleOpenPricelist);
    return () => window.removeEventListener("tanabrew:open-pricelist-modal", handleOpenPricelist);
  }, []);
  const profileDismissedActivityIds = useMemo(
    () => (Array.isArray(userProfile?.dismissed_activity_ids) ? userProfile.dismissed_activity_ids : []),
    [userProfile?.dismissed_activity_ids],
  );

  const dismissedSet = useMemo(() => new Set([
    ...profileDismissedActivityIds,
    ...dismissedActivityIds,
    ...(userProfile?.last_seen_activity_id ? [userProfile.last_seen_activity_id] : []),
  ]), [profileDismissedActivityIds, dismissedActivityIds, userProfile?.last_seen_activity_id]);

  const newActivities = useMemo(() => {
    return activityLogs.filter((activity) => activity.id && !dismissedSet.has(activity.id));
  }, [activityLogs, dismissedSet]);

  const demoActivities: ActivityLog[] = useMemo(
    () => [
      {
        id: "demo-act-1",
        action: "PRINT_INVOICE",
        description: "Invoice #INV-2026-089 berhasil dicetak",
        user_name: "Admin Tanabrew",
      },
      {
        id: "demo-act-2",
        action: "CREATE_INVOICE",
        description: "Invoice baru dicatat untuk Pesanan Espresso Roast",
        user_name: "Kasir",
      },
      {
        id: "demo-act-3",
        action: "UPDATE_PAYMENT_STATUS",
        description: "Pembayaran invoice disinkronkan lunas secara real-time",
        user_name: "Owner",
      },
    ],
    [],
  );

  const displayActivities = useMemo(() => {
    if (newActivities.length > 0) return newActivities;
    const remainingLogs = activityLogs.filter((act) => act.id && !dismissedSet.has(act.id));
    if (remainingLogs.length > 0) return remainingLogs;
    const remainingDemo = demoActivities.filter((act) => !dismissedSet.has(act.id));
    return remainingDemo;
  }, [newActivities, activityLogs, demoActivities, dismissedSet]);

  useEffect(() => {
    if (displayActivities.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % displayActivities.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [displayActivities.length]);

  const currentTickerActivity = displayActivities[tickerIndex % displayActivities.length] || displayActivities[0];
  const notificationInfo = useMemo(() => {
    switch (notificationStatus) {
      case "granted":
        return {
          label: "Notifikasi aktif",
          description: "Tanabrew siap menerima web push dari OneSignal.",
          badgeClass: "bg-primary/10 text-primary",
        };
      case "denied":
        return {
          label: "Notifikasi diblokir browser",
          description: "Izin notifikasi diblokir. Aktifkan kembali dari pengaturan browser.",
          badgeClass: "bg-destructive/10 text-destructive",
        };
      case "unsupported":
        return {
          label: "Browser tidak mendukung notifikasi",
          description: "Gunakan browser yang mendukung Web Push, seperti Chrome Android.",
          badgeClass: "bg-muted text-muted-foreground",
        };
      case "missing_app_id":
        return {
          label: "Konfigurasi OneSignal belum siap",
          description: "Tambahkan VITE_ONESIGNAL_APP_ID di environment production.",
          badgeClass: "bg-yellow-100/80 text-yellow-800",
        };
      default:
        return {
          label: "Notifikasi belum diaktifkan",
          description: "Aktifkan notifikasi untuk menerima info invoice baru, invoice dicetak, dan status pembayaran.",
          badgeClass: "bg-yellow-100/80 text-yellow-800",
        };
    }
  }, [notificationStatus]);
  const notificationButtonDisabled =
    notificationLoading
    || notificationStatus === "granted"
    || notificationStatus === "denied"
    || notificationStatus === "unsupported"
    || notificationStatus === "missing_app_id";
  const notificationTestDisabled = notificationTestLoading || notificationStatus !== "granted";
  const notificationSyncDisabled =
    notificationSyncLoading
    || notificationStatus === "denied"
    || notificationStatus === "unsupported"
    || notificationStatus === "missing_app_id";

  useEffect(() => {
    const q = query(collection(db, "activity_logs"), orderBy("created_at", "desc"), limit(10));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((activityDoc) => ({ id: activityDoc.id, ...activityDoc.data() } as ActivityLog));
        setActivityLogs(data);
      },
      () => {
        setActivityLogs([]);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("created_at", "desc"), limit(80));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));
        setDashboardInvoices(data);
        setLoadingDashboard(false);
      },
      () => {
        setDashboardInvoices([]);
        setLoadingDashboard(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const shouldShowWelcome = shouldShowWelcomeFromRoute || hasWelcomeAnimationFlag();
    setShowWelcomeAnimation(shouldShowWelcome);
    setHomeIntroReady(!shouldShowWelcome);
  }, [shouldShowWelcomeFromRoute]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tanabrew_dismissed_activity_ids");
      if (stored) {
        setDismissedActivityIds(JSON.parse(stored));
      }
    } catch {}
    setTickerIndex(0);
    setNotificationStatus(getNotificationPermissionState());
  }, [currentUser?.uid]);

  useEffect(() => {
    setLoadingDashboard(true);
    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snap) => {
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));
        data.sort((a, b) => getInvoiceDateValue(b) - getInvoiceDateValue(a));
        setAdminInvoices(data);
        setDashboardInvoices(data);
        setLoadingDashboard(false);
        setInvoiceReminderError(false);
      },
      () => {
        setInvoiceReminderError(true);
        setAdminInvoices([]);
        setDashboardInvoices([]);
        setLoadingDashboard(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const unprintedInvoices = useMemo(
    () => adminInvoices.filter((invoice) => invoice.is_printed !== true),
    [adminInvoices],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) > 0 && (p.total_stok || 0) <= 5),
    [products],
  );
  const emptyStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) === 0),
    [products],
  );
  const safeStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) > 5),
    [products],
  );
  const hasAdminWarning = invoiceReminderError || unprintedInvoices.length > 0 || lowStockProducts.length > 0 || emptyStockProducts.length > 0;

  const todayOverview = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const todayInvoices = dashboardInvoices.filter((inv) => {
      const time = getInvoiceDateValue(inv);
      if (!time) return false;
      const d = new Date(time);
      return d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDate;
    });

    const revenue = todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const count = todayInvoices.length;
    const itemsSold = todayInvoices.reduce(
      (sum, inv) => sum + (inv.items || []).reduce((itemSum, item) => itemSum + (item.jumlah || 0), 0),
      0,
    );

    return { revenue, count, itemsSold };
  }, [dashboardInvoices]);

  const todayDetails = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const invoicesToday = dashboardInvoices.filter((inv) => {
      const time = getInvoiceDateValue(inv);
      if (!time) return false;
      const d = new Date(time);
      return d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDate;
    });

    const lunasInvoices = invoicesToday.filter((inv) => inv.status === "LUNAS");
    const belumLunasInvoices = invoicesToday.filter((inv) => inv.status !== "LUNAS");

    const omzetLunas = lunasInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const omzetBelumLunas = belumLunasInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalOmzet = omzetLunas + omzetBelumLunas;
    const avgOmzet = invoicesToday.length > 0 ? totalOmzet / invoicesToday.length : 0;

    const soldItemsMap: Record<string, { nama: string; qty: number; total: number }> = {};
    invoicesToday.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const key = item.nama_barang || "Produk";
        if (!soldItemsMap[key]) {
          soldItemsMap[key] = { nama: key, qty: 0, total: 0 };
        }
        soldItemsMap[key].qty += (item.jumlah || 0);
        soldItemsMap[key].total += (item.subtotal || ((item.harga || 0) * (item.jumlah || 0)));
      });
    });

    const soldItemsList = Object.values(soldItemsMap).sort((a, b) => b.qty - a.qty);

    return {
      invoicesToday,
      lunasInvoices,
      belumLunasInvoices,
      omzetLunas,
      omzetBelumLunas,
      totalOmzet,
      avgOmzet,
      soldItemsList,
    };
  }, [dashboardInvoices]);

  const chartRevenueData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = i === 6 ? "Hari Ini" : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(d);
      return { key, label, omzet: 0, transaksi: 0 };
    });

    dashboardInvoices.forEach((inv) => {
      const time = getInvoiceDateValue(inv);
      if (!time) return;
      const d = new Date(time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const matched = days.find((day) => day.key === key);
      if (matched) {
        matched.omzet += inv.total || 0;
        matched.transaksi += 1;
      }
    });

    return days;
  }, [dashboardInvoices]);

  const dashboardStatus = useMemo(
    () => ({
      lunas: dashboardInvoices.filter((invoice) => invoice.status === "LUNAS").length,
      belumLunas: dashboardInvoices.filter((invoice) => invoice.status === "BELUM LUNAS" || invoice.status === "Pending").length,
    }),
    [dashboardInvoices],
  );

  const topBestSellers = useMemo(() => {
    const map = new Map<string, number>();
    let totalPcs = 0;
    dashboardInvoices.forEach((inv) => {
      (inv.items || []).forEach((it) => {
        if (!it.nama_barang) return;
        const qty = it.jumlah || 0;
        map.set(it.nama_barang, (map.get(it.nama_barang) || 0) + qty);
        totalPcs += qty;
      });
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalPcs > 0 ? Math.round((count / totalPcs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [dashboardInvoices]);

  const hasDashboardData = dashboardInvoices.length > 0 || products.length > 0;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleWelcomeFinish = useCallback(() => {
    sessionStorage.removeItem("showWelcomeAnimation");
    setShowWelcomeAnimation(false);
    setHomeIntroReady(true);
    navigate(".", { replace: true, state: null });
  }, [navigate]);

  const handleSafeRefresh = useCallback(() => {
    window.setTimeout(() => window.location.reload(), 320);
  }, []);

  const formatInvoiceDate = useCallback((invoice: Invoice) => {
    return formatInvoiceDateUtil(invoice);
  }, []);

  const syncCurrentNotificationIdentity = useCallback(async () => {
    if (!currentUser || !userProfile) {
      throw new Error("Data user belum siap, silakan coba lagi.");
    }

    await syncOneSignalUserIdentity({
      uid: currentUser.uid,
      role: userProfile.role,
      name: userProfile.name || currentUser.displayName || currentUser.email || "",
      email: userProfile.email || currentUser.email || "",
    });
  }, [currentUser, userProfile]);

  const handleEnableNotifications = useCallback(async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    setNotificationLoading(true);
    try {
      const status = await requestNotificationPermission();
      setNotificationStatus(status);

      if (status === "granted") {
        try {
          await syncCurrentNotificationIdentity();
          toast({ title: "Notifikasi aktif", description: "Identitas notifikasi berhasil disinkronkan." });
        } catch (error) {
          console.warn("Gagal menyinkronkan identitas setelah notifikasi aktif", error);
          toast({ title: "Perhatian", description: "Notifikasi aktif, tetapi identitas user gagal disinkronkan." });
        }
      } else if (status === "denied") {
        toast({ title: "Notifikasi diblokir", description: "Aktifkan kembali izin dari pengaturan browser.", variant: "destructive" });
      } else if (status === "unsupported") {
        toast({ title: "Tidak didukung", description: "Browser ini belum mendukung Web Push.", variant: "destructive" });
      } else {
        toast({ title: "Belum aktif", description: "Izin notifikasi belum diberikan." });
      }
    } catch {
      toast({ title: "Error", description: "Gagal mengaktifkan notifikasi.", variant: "destructive" });
    } finally {
      setNotificationLoading(false);
    }
  }, [currentUser, syncCurrentNotificationIdentity, toast, userProfile]);

  const handleSyncNotificationIdentity = useCallback(async () => {
    setNotificationSyncLoading(true);
    try {
      await syncCurrentNotificationIdentity();
      setNotificationStatus(getNotificationPermissionState());
      toast({ title: "Berhasil", description: "Identitas notifikasi berhasil disinkronkan." });
    } catch (error) {
      console.warn("Gagal menyinkronkan identitas notifikasi", error);
      const description = error instanceof Error && error.message
        ? error.message
        : "Gagal menyinkronkan identitas notifikasi.";
      toast({ title: "Gagal menyinkronkan identitas notifikasi", description, variant: "destructive" });
    } finally {
      setNotificationSyncLoading(false);
    }
  }, [syncCurrentNotificationIdentity, toast]);

  const handleSendTestNotification = useCallback(async () => {
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    if (userProfile.role !== "admin") {
      toast({ title: "Error", description: "Hanya admin yang dapat mengirim test notifikasi.", variant: "destructive" });
      return;
    }

    setNotificationTestLoading(true);
    try {
      await syncCurrentNotificationIdentity();
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const result = await sendTanabrewNotification(
        {
          type: "TEST_NOTIFICATION",
          invoiceId: "TEST",
          invoiceNumber: "TEST",
          customer: "Tanabrew",
          total: 0,
          actorName: userProfile.name || "System",
          actorRole: "admin",
        },
        currentUser,
      );
      toast({
        title: "Test notifikasi dikirim",
        description: `Message ID: ${result.messageId}`,
      });
    } catch (error) {
      console.warn("Gagal mengirim test notifikasi Tanabrew", error);
      const description = error instanceof Error && error.message
        ? error.message
        : "Endpoint notifikasi gagal diakses.";
      toast({ title: "Gagal mengirim test notifikasi", description, variant: "destructive" });
    } finally {
      setNotificationTestLoading(false);
    }
  }, [currentUser, syncCurrentNotificationIdentity, toast, userProfile]);

  const handleSendOwnerAnnouncement = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      toast({ title: "Error", description: "Data user belum siap, silakan coba lagi.", variant: "destructive" });
      return;
    }

    const isOwnerOrDev = userProfile.role === "owner" || userProfile.role === "webdev";
    if (!isOwnerOrDev) {
      toast({ title: "Error", description: "Hanya owner atau developer yang dapat mengirim arahan owner.", variant: "destructive" });
      return;
    }

    const cleanTitle = announcementTitle.trim() || "Arahan Owner Tanabrew";
    const cleanMessage = announcementMessage.trim();

    if (!cleanMessage) {
      toast({ title: "Error", description: "Pesan wajib diisi.", variant: "destructive" });
      return;
    }

    const confirmSend = window.confirm("Notifikasi arahan owner akan dikirim ke seluruh pengguna yang aktif. Lanjutkan?");
    if (!confirmSend) {
      return;
    }

    setAnnouncementLoading(true);
    try {
      try {
        await syncCurrentNotificationIdentity();
      } catch (syncErr) {
        console.warn("Sync identity sebelum kirim arahan dilewati", syncErr);
      }

      const result = await sendTanabrewNotification(
        {
          type: "OWNER_ANNOUNCEMENT",
          actorName: userProfile.name || (userProfile.role === "webdev" ? "Developer" : "Owner"),
          actorRole: (userProfile.role as "owner" | "webdev") || "owner",
          title: cleanTitle,
          message: `Dari Owner: ${cleanMessage}`,
          invoiceNumber: "ANNOUNCEMENT",
          customer: "ALL",
          total: 0
        },
        currentUser
      );

      toast({
        title: "Arahan terkirim",
        description: `Berhasil dikirim ke seluruh perangkat aktif. Message ID: ${result.messageId || "OK"}`,
      });
      
      setAnnouncementMessage("");
      
      try {
        const { addActivityLog } = await import("@/lib/activityLog");
        await addActivityLog({
          user: {
            uid: currentUser.uid,
            name: userProfile.name || "Owner",
            role: userProfile.role
          },
          action: "OWNER_ANNOUNCEMENT",
          targetType: "notification",
          targetId: result.messageId || "announcement",
          targetName: cleanTitle,
          description: `${userProfile.role} mengirim arahan: ${cleanTitle}`
        });
      } catch (logErr) {
        console.warn("Gagal mencatat log aktivitas untuk Arahan Owner", logErr);
      }
    } catch (error) {
      console.warn("Gagal mengirim arahan owner", error);
      const description = error instanceof Error && error.message
        ? error.message
        : "Gagal mengirim arahan owner.";
      toast({ title: "Gagal mengirim arahan", description, variant: "destructive" });
    } finally {
      setAnnouncementLoading(false);
    }
  }, [currentUser, syncCurrentNotificationIdentity, toast, userProfile, announcementTitle, announcementMessage]);

  const handleDismissActivity = async (activity: ActivityLog) => {
    if (!activity.id) return;
    const activityId = activity.id;
    triggerHaptic(10);
    setDismissedActivityIds((prev) => {
      const next = prev.includes(activityId) ? prev : [...prev, activityId];
      try {
        localStorage.setItem("tanabrew_dismissed_activity_ids", JSON.stringify(next.slice(-100)));
      } catch {}
      return next;
    });

    if (currentUser && !activityId.startsWith("demo-")) {
      try {
        const remainingActivities = newActivities.filter((item) => item.id !== activity.id);
        const updatePayload: Record<string, unknown> = {
          dismissed_activity_ids: arrayUnion(activity.id),
        };

        if (remainingActivities.length === 0) {
          updatePayload.last_seen_activity_id = activity.id;
          updatePayload.last_seen_activity_at = serverTimestamp();
        }

        await updateDoc(doc(db, "users", currentUser.uid), updatePayload);
      } catch (err) {
        console.warn("Failed to persist dismissed activity in firestore", err);
      }
    }
  };

  const cards = [
    { label: "Total Produk", value: totalProduk, clickable: true, key: "total_produk" as const },
    { label: "Total Stok", value: totalStok, clickable: true, key: "total_stok" as const },
    { label: "Stok Jogja", value: stokJogja, clickable: true, key: "jogja" as const },
    { label: "Stok Lombok", value: stokLombok, clickable: true, key: "lombok" as const },
  ];

  return (
    <>
      <PullToRefresh onRefresh={handleSafeRefresh} disabled={Boolean(modal || summaryModal || overviewModal || profileModalOpen)} />

      {showWelcomeAnimation && (
        <WelcomeAnimation name={displayName} role={userProfile?.role} onFinish={handleWelcomeFinish} />
      )}

      <div className={`px-4 sm:px-6 lg:px-8 pb-28 sm:pb-32 pt-4 lg:pt-8 max-w-lg lg:max-w-7xl mx-auto ${homeIntroReady ? "tanabrew-page-enter" : "opacity-0"}`}>
        {/* Mobile Header Logo & Brand (Hidden on Desktop) */}
        <div className="lg:hidden tanabrew-waterfall-1 flex flex-col items-center mb-6">
          <img
            src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
            alt="Tanabrew Logo"
            onClick={handleLogoClick}
            className="w-24 h-24 rounded-full object-cover border-2 border-primary bg-primary cursor-pointer select-none active:scale-95 transition-transform shadow-md"
          />
          <h1 
            onClick={handleLogoClick}
            className="text-xl font-bold text-primary mt-3 cursor-pointer select-none active:opacity-80"
          >
            Tanabrew
          </h1>
          <p className="text-sm text-muted-foreground">Trademark</p>
        </div>

        {/* Desktop Welcome Banner */}
        <div className="hidden lg:flex items-center justify-between gap-4 mb-6 bg-card/70 backdrop-blur-md rounded-2xl border border-border/80 p-5 shadow-sm">
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              Selamat Datang, {displayName}!
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dashboard monitoring penjualan, stok inventaris Jogja & Lombok, dan operasional kasir.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                navigate("/cetak-invoice");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-bold shadow-md shadow-primary/25 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              Buat Invoice Baru
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                navigate("/update-stok");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted/70 text-foreground px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Package size={15} />
              Update Stok
            </button>
          </div>
        </div>

        {/* Main 12-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Area (Desktop: 8 Cols) */}
          <div className="lg:col-span-8 space-y-6 order-2 lg:order-1">
            {/* Grid 4 Kartu Stok Metrik */}
            <div className="tanabrew-waterfall-2 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {loading ? (
                <>
                  <CardSkeleton lines={2} />
                  <CardSkeleton lines={2} />
                  <CardSkeleton lines={2} />
                  <CardSkeleton lines={2} />
                </>
              ) : cards.map((c) => (
                <button
                  key={c.label}
                  disabled={!c.clickable}
                  onClick={() => {
                    triggerHaptic(10);
                    if (c.clickable && c.key) setModal(c.key);
                  }}
                  className={`tanabrew-glass-card rounded-2xl border border-border p-4 text-center transition-all ${
                    c.clickable ? "cursor-pointer active:scale-95 active:shadow-md hover:border-primary/40 select-none" : "cursor-default"
                  }`}
                >
                  <p className="text-2xl font-bold text-primary">{loading ? "..." : c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                </button>
              ))}
            </div>

            {/* Analitik & Performa Toko */}
            <div className="tanabrew-waterfall-3 tanabrew-dashboard-panel rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Analitik & Performa Toko</h2>
                  <p className="text-xs text-muted-foreground">Tren pendapatan 7 hari terakhir & peringkat produk terlaris</p>
                </div>
              </div>

              {loadingDashboard || loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-36 w-full rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                </div>
              ) : !hasDashboardData ? (
                <p className="rounded-xl bg-muted px-3 py-4 text-center text-xs text-muted-foreground">Belum ada data transaksi yang dicatat.</p>
              ) : (
                <div className="space-y-5">
                  {/* Grafik Tren Omzet 7 Hari */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                        Tren Omzet 7 Hari Terakhir
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                        Rp {fmt(chartRevenueData.reduce((sum, day) => sum + day.omzet, 0))}
                      </span>
                    </div>

                    <div className="w-full rounded-xl bg-muted/30 p-2.5 border border-border/50" style={{ height: 210 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${val >= 1000000 ? (val / 1000000).toFixed(1) + "M" : val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "0.75rem",
                              fontSize: "11px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            }}
                            formatter={(val: number) => [`Rp ${fmt(val)}`, "Omzet"]}
                            labelFormatter={(lbl) => `Tanggal: ${lbl}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="omzet"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#revenueGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Status Transaksi & Stok Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setSummaryModal("lunas");
                      }}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-left hover:bg-emerald-500/15 transition-all"
                    >
                      <p className="text-[11px] text-muted-foreground">Invoice Lunas</p>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{dashboardStatus.lunas}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setSummaryModal("belum_lunas");
                      }}
                      className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-left hover:bg-destructive/15 transition-all"
                    >
                      <p className="text-[11px] text-muted-foreground">Belum Lunas</p>
                      <p className="text-base font-bold text-destructive">{dashboardStatus.belumLunas}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setSummaryModal("stok_menipis");
                      }}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-left hover:bg-amber-500/15 transition-all"
                    >
                      <p className="text-[11px] text-muted-foreground">Stok Menipis (&le; 5)</p>
                      <p className="text-base font-bold text-amber-700 dark:text-amber-400">{lowStockProducts.length}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setSummaryModal("stok_habis");
                      }}
                      className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-left hover:bg-destructive/15 transition-all"
                    >
                      <p className="text-[11px] text-muted-foreground">Stok Habis (0)</p>
                      <p className="text-base font-bold text-destructive">{emptyStockProducts.length}</p>
                    </button>
                  </div>

                  {/* 5 Produk Terlaris (Top 5 Best Seller) */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Award size={14} className="text-amber-500" />
                        Peringkat 5 Produk Terlaris
                      </span>
                      <span className="text-[10px] text-muted-foreground">Berdasarkan data penjualan</span>
                    </div>

                    {topBestSellers.length === 0 ? (
                      <p className="rounded-xl bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground">Belum ada riwayat penjualan produk.</p>
                    ) : (
                      <div className="space-y-2">
                        {topBestSellers.map((item, idx) => (
                          <div key={item.name} className="rounded-xl border border-border bg-card p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`flex h-5 w-5 items-center justify-center rounded-md font-bold text-[10px] shrink-0 ${
                                  idx === 0 ? "bg-amber-500/20 text-amber-600 border border-amber-500/30" :
                                  idx === 1 ? "bg-slate-300/30 text-slate-700 dark:text-slate-300 border border-slate-300/40" :
                                  idx === 2 ? "bg-amber-700/20 text-amber-800 dark:text-amber-300 border border-amber-700/30" :
                                  "bg-muted text-muted-foreground"
                                }`}>
                                  #{idx + 1}
                                </span>
                                <span className="font-semibold text-foreground truncate">{item.name}</span>
                              </div>
                              <span className="font-bold text-primary shrink-0 text-xs">{item.count} pcs</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tabel Stok */}
            <div className="tanabrew-waterfall-4 rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
              <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-primary">Tabel Stok Inventaris</h2>
                <button
                  type="button"
                  onClick={() => navigate("/update-stok")}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Kelola Stok →
                </button>
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
                      Array.from({ length: 4 }).map((_, index) => (
                        <tr key={index} className="border-t border-border">
                          <td className="px-3 py-3"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-3 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                          <td className="px-3 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                          <td className="px-3 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                        </tr>
                      ))
                    ) : products.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Belum ada produk</td></tr>
                    ) : (
                      products.map((p) => (
                        <tr key={p.id} className={`border-t border-border ${stockState(p.total_stok || 0).rowClass}`}>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <span>{p.nama_barang}</span>
                              {stockState(p.total_stok || 0).label && (
                                <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockState(p.total_stok || 0).labelClass}`}>
                                  {stockState(p.total_stok || 0).label}
                                </span>
                              )}
                            </div>
                          </td>
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
          </div>

          {/* Side Widget Column (Desktop: 4 Cols) */}
          <div className="lg:col-span-4 space-y-5 order-1 lg:order-2">
            {/* Header Profil Pengguna */}
            <div 
              onClick={() => {
                triggerHaptic(10);
                setProfileModalOpen(true);
              }}
              className="tanabrew-waterfall-1 tanabrew-glass-card rounded-2xl border border-border/80 p-4 flex items-center justify-between gap-3 shadow-sm cursor-pointer hover:border-primary/40 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm border border-primary/20 shrink-0 overflow-hidden">
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
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">{roleLabel}</span>
                    {isAdmin && notificationStatus === "granted" && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Notif Aktif
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(10);
                  navigate("/akun");
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <UserIcon size={14} />
                Akun
              </button>
            </div>

            {/* Kapsul Ticker Aktivitas Terbaru (Ultra-Compact 1 Baris) */}
            {displayActivities.length > 0 && currentTickerActivity && (
              <div className="tanabrew-waterfall-2 rounded-xl border border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3.5 py-2 transition-all flex items-center justify-between gap-2.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    navigate("/riwayat?tab=aktivitas", { state: { tab: "aktivitas" } });
                  }}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left select-none cursor-pointer group"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>

                  <div 
                    key={`ticker-text-${tickerIndex}`}
                    className="min-w-0 flex-1 truncate text-xs animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1.5">
                      {actionLabel(currentTickerActivity.action)}:
                    </span>
                    <span className="text-foreground/90 font-medium truncate">
                      {currentTickerActivity.description || "Ada pembaruan data."}
                    </span>
                    <span className="text-muted-foreground/60 text-[10px] ml-1.5 hidden sm:inline">
                      • {currentTickerActivity.user_name || "User"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] group-hover:translate-x-0.5 transition-transform">
                    <span>Riwayat</span>
                    <ArrowRight size={12} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    void handleDismissActivity(currentTickerActivity);
                  }}
                  className="relative z-20 rounded-lg p-1.5 text-muted-foreground/70 hover:text-foreground hover:bg-muted active:scale-90 transition-all shrink-0 cursor-pointer"
                  title="Tutup aktivitas ini"
                  aria-label="Tutup aktivitas"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Ringkasan Cepat Hari Ini (Today's Quick Overview) */}
            <div className="tanabrew-waterfall-3 grid grid-cols-3 lg:grid-cols-1 gap-2.5">
              <div 
                onClick={() => {
                  triggerHaptic(10);
                  setOverviewModal("omzet");
                }}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 p-3.5 space-y-1 shadow-sm cursor-pointer active:scale-95 transition-all select-none group"
              >
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Omzet Hari Ini</span>
                  </div>
                  <ChevronRight size={14} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm sm:text-base font-bold text-foreground truncate">Rp {fmt(todayOverview.revenue)}</p>
              </div>

              <div 
                onClick={() => {
                  triggerHaptic(10);
                  setOverviewModal("transaksi");
                }}
                className="rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 p-3.5 space-y-1 shadow-sm cursor-pointer active:scale-95 transition-all select-none group"
              >
                <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Transaksi</span>
                  </div>
                  <ChevronRight size={14} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm sm:text-base font-bold text-foreground">{todayOverview.count} Transaksi</p>
              </div>

              <div 
                onClick={() => {
                  triggerHaptic(10);
                  setOverviewModal("terjual");
                }}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 p-3.5 space-y-1 shadow-sm cursor-pointer active:scale-95 transition-all select-none group"
              >
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Produk Terjual</span>
                  </div>
                  <ChevronRight size={14} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm sm:text-base font-bold text-foreground">{todayOverview.itemsSold} Pcs</p>
              </div>
            </div>

            {notificationStatus !== "granted" && !showWelcomeAnimation && (
              <div className="tanabrew-card-enter rounded-2xl border border-yellow-200 bg-yellow-50/70 p-4 shadow-sm" style={{ animationDelay: "20ms" }}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
                    <Bell size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-yellow-900">Notifikasi Belum Aktif</p>
                    <p className="mt-1 text-xs text-yellow-800 leading-relaxed">
                      Aktifkan notifikasi agar info invoice dan arahan owner langsung masuk ke HP.
                    </p>
                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      disabled={notificationLoading}
                      className="mt-3 inline-flex min-h-8 items-center justify-center rounded-lg bg-yellow-800 hover:bg-yellow-900 text-white px-4 py-1.5 text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      {notificationLoading ? "Mengaktifkan..." : "Aktifkan Notifikasi"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isOwner && showOwnerCommandMode && (
              <div className="tanabrew-card-enter rounded-2xl border border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10 p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300" style={{ animationDelay: "50ms" }}>
                <div className="flex items-center justify-between mb-4 border-b border-amber-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      Mode Owner Aktif
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowOwnerCommandMode(false)}
                    className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:underline"
                  >
                    Tutup
                  </button>
                </div>

                <div className="mb-4">
                  <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300">Arahan Owner</h2>
                  <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                    Kirim arahan penting langsung ke seluruh pengguna Tanabrew.
                  </p>
                </div>
                
                <form onSubmit={handleSendOwnerAnnouncement} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-400 mb-1 block">Judul Notifikasi</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="Arahan Owner Tanabrew"
                      className="w-full rounded-lg border border-amber-500/30 bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-400 mb-1 block">Isi Pesan Notifikasi</label>
                    <textarea
                      required
                      maxLength={240}
                      rows={3}
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      placeholder="Ketik pesan arahan di sini..."
                      className="w-full rounded-lg border border-amber-500/30 bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={announcementLoading || !announcementMessage.trim()}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Bell size={15} />
                    {announcementLoading ? "Mengirim..." : "Kirim Arahan Owner"}
                  </button>
                </form>
              </div>
            )}

            {isAdmin && (
              <div className="tanabrew-card-enter rounded-2xl border border-border bg-card p-4 shadow-sm" style={{ animationDelay: "70ms" }}>
                <h2 className="text-sm font-bold text-primary mb-3">Pengingat Admin</h2>

                {!hasAdminWarning ? (
                  <p className="text-sm text-muted-foreground">Semua aman untuk saat ini.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Invoice belum dicetak</span>
                        <span className="font-bold text-primary">{invoiceReminderError ? "-" : unprintedInvoices.length}</span>
                      </div>
                      {invoiceReminderError ? (
                        <p className="mt-1 text-xs text-destructive">Gagal memuat invoice belum dicetak.</p>
                      ) : (
                        unprintedInvoices.slice(0, 3).map((invoice) => (
                          <div key={invoice.id} className="tanabrew-card-enter mt-2 rounded-lg bg-muted px-3 py-2 text-xs">
                            <p className="font-semibold text-foreground">{invoice.no_invoice || "-"}</p>
                            <p className="text-muted-foreground">Customer: {invoice.customer || "-"}</p>
                            <p className={invoice.status === "LUNAS" ? "text-primary" : "text-destructive"}>{invoice.status || "-"}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Stok menipis</span>
                        <span className="font-bold text-yellow-800">{lowStockProducts.length} barang</span>
                      </div>
                      {lowStockProducts.slice(0, 3).map((p) => (
                        <div key={p.id} className="tanabrew-card-enter mt-2 flex justify-between rounded-lg bg-yellow-100/70 px-3 py-2 text-xs">
                          <span className="font-semibold text-foreground">{p.nama_barang}</span>
                          <span className="font-bold text-yellow-800">{p.total_stok}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Stok habis</span>
                        <span className="font-bold text-destructive">{emptyStockProducts.length} barang</span>
                      </div>
                      {emptyStockProducts.slice(0, 3).map((p) => (
                        <div key={p.id} className="tanabrew-card-enter mt-2 flex justify-between rounded-lg bg-destructive/10 px-3 py-2 text-xs">
                          <span className="font-semibold text-foreground">{p.nama_barang}</span>
                          <span className="font-bold text-destructive">{p.total_stok}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

        {/* MODAL DETAIL PROFIL PENGGUNA */}
        {profileModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setProfileModalOpen(false)}>
            <div 
              className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-10 sm:pb-5 max-h-[85vh] overflow-y-auto tanabrew-card-enter animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <UserIcon size={18} />
                  Profil Pengguna
                </h3>
                <button onClick={() => setProfileModalOpen(false)} className="p-1 rounded-full hover:bg-muted" aria-label="Tutup">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-2xl border border-border mb-4">
                <div className="h-20 w-20 rounded-full border-2 border-primary/30 p-0.5 mb-3 overflow-hidden bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shadow-sm">
                  {userProfile?.photo_url ? (
                    <img src={userProfile.photo_url} alt={displayName} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    displayName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <h4 className="text-base font-bold text-foreground">{displayName}</h4>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase mt-1">
                  {roleLabel}
                </div>
                {currentUser?.email && (
                  <p className="text-xs text-muted-foreground mt-2">{currentUser.email}</p>
                )}
              </div>

              <div className="space-y-2 mb-4 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-muted-foreground font-medium">Status Notifikasi</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full ${
                    notificationStatus === "granted" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-yellow-500/15 text-yellow-700"
                  }`}>
                    {notificationStatus === "granted" ? "✓ Aktif" : "Belum Aktif"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-muted-foreground font-medium">ID Pengguna</span>
                  <span className="font-mono text-[11px] text-foreground/80 truncate max-w-[180px]">{currentUser?.uid || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileModalOpen(false);
                    navigate("/akun");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground py-2.5 px-3 text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  <UserIcon size={14} />
                  Buka Akun
                </button>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="rounded-xl border border-border bg-muted py-2.5 px-3 text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL RINCIAN HARI INI (OMZET / TRANSAKSI / TERJUAL) */}
        {overviewModal && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setOverviewModal(null)}>
            <div 
              className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-10 sm:pb-5 max-h-[85vh] overflow-y-auto tanabrew-card-enter animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  {overviewModal === "omzet" && <><DollarSign size={18} /> Rincian Omzet Hari Ini</>}
                  {overviewModal === "transaksi" && <><TrendingUp size={18} /> Daftar Transaksi Hari Ini</>}
                  {overviewModal === "terjual" && <><ShoppingBag size={18} /> Produk Terjual Hari Ini</>}
                </h3>
                <button onClick={() => setOverviewModal(null)} className="p-1 rounded-full hover:bg-muted" aria-label="Tutup">
                  <X size={20} />
                </button>
              </div>

              {/* Konten Omzet */}
              {overviewModal === "omzet" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Pendapatan Hari Ini</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">Rp {fmt(todayDetails.totalOmzet)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                      <p className="text-muted-foreground text-[11px]">Sudah Lunas ({todayDetails.lunasInvoices.length})</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">Rp {fmt(todayDetails.omzetLunas)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/15">
                      <p className="text-muted-foreground text-[11px]">Belum Lunas ({todayDetails.belumLunasInvoices.length})</p>
                      <p className="font-bold text-destructive text-sm mt-0.5">Rp {fmt(todayDetails.omzetBelumLunas)}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Transaksi</span>
                      <span className="font-bold text-foreground">{todayDetails.invoicesToday.length} Invoice</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rata-rata per Transaksi</span>
                      <span className="font-bold text-foreground">Rp {fmt(Math.round(todayDetails.avgOmzet))}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setOverviewModal(null);
                      navigate("/riwayat?tab=invoice", { state: { tab: "invoice" } });
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <span>Lihat Semua Invoice di Riwayat</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Konten Transaksi */}
              {overviewModal === "transaksi" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted/50 p-3 rounded-xl border border-border text-xs">
                    <span className="text-muted-foreground">Total Invoice Hari Ini:</span>
                    <span className="font-bold text-foreground">{todayDetails.invoicesToday.length} Transaksi</span>
                  </div>

                  {todayDetails.invoicesToday.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Belum ada transaksi hari ini.</p>
                  ) : (
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                      {todayDetails.invoicesToday.map((inv) => (
                        <div key={inv.id} className="p-3 rounded-xl border border-border bg-muted/20 text-xs space-y-1.5">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-primary truncate max-w-[65%]">{inv.no_invoice || "-"}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              inv.status === "LUNAS" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                            }`}>
                              {inv.status || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span className="truncate max-w-[60%]">Customer: <strong className="text-foreground">{inv.customer || "-"}</strong></span>
                            <span className="font-bold text-foreground">Rp {fmt(inv.total || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOverviewModal(null);
                      navigate("/riwayat?tab=invoice", { state: { tab: "invoice" } });
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <span>Buka Riwayat Transaksi</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Konten Terjual */}
              {overviewModal === "terjual" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs">
                    <span className="text-amber-800 dark:text-amber-400 font-medium">Total Kuantitas Terjual:</span>
                    <span className="font-bold text-amber-900 dark:text-amber-300 text-sm">{todayOverview.itemsSold} Pcs</span>
                  </div>

                  {todayDetails.soldItemsList.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Belum ada barang terjual hari ini.</p>
                  ) : (
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                      {todayDetails.soldItemsList.map((item, idx) => (
                        <div key={`${item.nama}-${idx}`} className="flex justify-between items-center p-3 rounded-xl border border-border bg-muted/20 text-xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="font-bold text-foreground truncate">{item.nama}</p>
                            <p className="text-[11px] text-muted-foreground">Total: Rp {fmt(item.total)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="inline-block font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                              {item.qty} pcs
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setOverviewModal(null);
                      navigate("/riwayat?tab=stok", { state: { tab: "stok" } });
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    <span>Cek Mutasi Stok di Riwayat</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL RINCIAN STOK INVENTARIS */}
        {modal && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setModal(null)}>
            <div 
              className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-12 sm:pb-5 max-h-[75vh] overflow-y-auto tanabrew-card-enter animate-in fade-in slide-in-from-bottom-4 duration-300" 
              style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                  <Package size={18} />
                  {modal === "total_produk" && `Total Produk (${totalProduk})`}
                  {modal === "total_stok" && `Total Semua Stok (${totalStok} Pcs)`}
                  {modal === "jogja" && `Stok Cabang Jogja (${stokJogja} Pcs)`}
                  {modal === "lombok" && `Stok Cabang Lombok (${stokLombok} Pcs)`}
                </h3>
                <button onClick={() => setModal(null)} className="p-1 rounded-full hover:bg-muted" aria-label="Tutup">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-xs font-bold text-foreground block truncate">{p.nama_barang}</span>
                      <span className="text-[10px] text-muted-foreground">Harga: Rp {fmt(p.harga || 0)}</span>
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0 bg-primary/10 px-2.5 py-1 rounded-lg">
                      {modal === "total_produk" && `Rp ${fmt(p.harga || 0)}`}
                      {modal === "total_stok" && `${p.total_stok || 0} Pcs`}
                      {modal === "jogja" && `${p.stok_jogja || 0} Pcs`}
                      {modal === "lombok" && `${p.stok_lombok || 0} Pcs`}
                    </span>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">Belum ada data produk.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {summaryModal && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setSummaryModal(null)}>
            <div 
              className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 pb-12 sm:pb-5 max-h-[80vh] overflow-y-auto tanabrew-card-enter animate-in fade-in slide-in-from-bottom-4 duration-300" 
              style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <h3 className="text-lg font-bold text-primary">
                  {summaryModal === "lunas" && "Invoice Lunas"}
                  {summaryModal === "belum_lunas" && "Invoice Belum Lunas"}
                  {summaryModal === "stok_aman" && "Stok Aman"}
                  {summaryModal === "stok_menipis" && "Stok Menipis"}
                  {summaryModal === "stok_habis" && "Stok Habis"}
                </h3>
                <button onClick={() => setSummaryModal(null)} className="p-1 rounded-full hover:bg-muted" aria-label="Tutup modal">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                {/* Render Invoices */}
                {(summaryModal === "lunas" || summaryModal === "belum_lunas") && (() => {
                  const filtered = summaryModal === "lunas"
                    ? dashboardInvoices.filter((inv) => inv.status === "LUNAS")
                    : dashboardInvoices.filter((inv) => inv.status === "BELUM LUNAS");

                  if (filtered.length === 0) {
                    return (
                      <p className="text-center text-muted-foreground text-sm py-6">
                        {summaryModal === "lunas" ? "Belum ada invoice lunas." : "Belum ada invoice belum lunas."}
                      </p>
                    );
                  }

                  return filtered.map((invoice) => (
                    <div key={invoice.id} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30 text-left">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-primary text-xs truncate max-w-[70%]">{invoice.no_invoice || "-"}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          invoice.status === "LUNAS" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <p><span className="font-medium text-foreground">Customer:</span> {invoice.customer || "-"}</p>
                        <p className="text-right"><span className="font-medium text-foreground">Total:</span> Rp {fmt(invoice.total || 0)}</p>
                        <p><span className="font-medium text-foreground">Tanggal:</span> {formatInvoiceDate(invoice)}</p>
                        <p className="text-right truncate"><span className="font-medium text-foreground">Pembuat:</span> {invoice.dibuat_oleh || "-"}</p>
                      </div>
                      <div className="flex justify-end pt-1 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => {
                            setSummaryModal(null);
                            navigate("/riwayat");
                          }}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          Lihat di Riwayat
                        </button>
                      </div>
                    </div>
                  ));
                })()}

                {/* Render Products */}
                {(summaryModal === "stok_aman" || summaryModal === "stok_menipis" || summaryModal === "stok_habis") && (() => {
                  const filtered = summaryModal === "stok_aman"
                    ? safeStockProducts
                    : summaryModal === "stok_menipis"
                      ? lowStockProducts
                      : emptyStockProducts;

                  if (filtered.length === 0) {
                    return (
                      <p className="text-center text-muted-foreground text-sm py-6">
                        {summaryModal === "stok_aman" && "Semua stok masih aman."}
                        {summaryModal === "stok_menipis" && "Tidak ada produk dengan stok menipis."}
                        {summaryModal === "stok_habis" && "Tidak ada produk dengan stok habis."}
                      </p>
                    );
                  }

                  return filtered.map((product) => (
                    <div key={product.id} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30 text-left">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{product.nama_barang}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          summaryModal === "stok_aman"
                            ? "bg-primary/15 text-primary"
                            : summaryModal === "stok_menipis"
                              ? "bg-yellow-200/80 text-yellow-800"
                              : "bg-destructive/15 text-destructive"
                        }`}>
                          {summaryModal === "stok_aman" && "Aman"}
                          {summaryModal === "stok_menipis" && "Menipis"}
                          {summaryModal === "stok_habis" && "Habis"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                        <div className="rounded bg-muted py-1.5">
                          <p className="text-[10px] text-muted-foreground">Jogja</p>
                          <p className="font-bold text-foreground">{product.stok_jogja}</p>
                        </div>
                        <div className="rounded bg-muted py-1.5">
                          <p className="text-[10px] text-muted-foreground">Lombok</p>
                          <p className="font-bold text-foreground">{product.stok_lombok}</p>
                        </div>
                        <div className="rounded bg-primary/10 py-1.5">
                          <p className="text-[10px] text-primary">Total</p>
                          <p className="font-bold text-primary">{product.total_stok}</p>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* MODAL PENGATURAN PRICE LIST RAHASIA (5-TAP LOGO) */}
        <PriceListManagerModal
          open={showPriceListModal}
          onOpenChange={setShowPriceListModal}
        />
      </>
    );
  };

export default Beranda;
