import { useProducts } from "@/hooks/useProducts";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { arrayUnion, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Bell, LogOut, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import WelcomeAnimation from "@/components/WelcomeAnimation";
import { CardSkeleton, Skeleton } from "@/components/Skeleton";
import PullToRefresh from "@/components/PullToRefresh";
import { sendTanabrewNotification } from "@/lib/notificationSender";
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  syncOneSignalUserIdentity,
  type OneSignalPermissionState,
} from "@/lib/onesignal";
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
    default:
      return action || "Aktivitas";
  }
};

const getDateValue = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number") return value;
  return 0;
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

const hasWelcomeAnimationFlag = () => sessionStorage.getItem("showWelcomeAnimation") === "true";

const Beranda = () => {
  const { products, loading } = useProducts();
  const { currentUser, userProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const swipeStartX = useRef<number | null>(null);
  const [modal, setModal] = useState<"jogja" | "lombok" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [dismissedActivityIds, setDismissedActivityIds] = useState<string[]>([]);
  const [closingActivity, setClosingActivity] = useState<{ activity: ActivityLog; direction: "left" | "right"; offset: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [adminInvoices, setAdminInvoices] = useState<Invoice[]>([]);
  const [dashboardInvoices, setDashboardInvoices] = useState<Invoice[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [invoiceReminderError, setInvoiceReminderError] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<OneSignalPermissionState>(() => getNotificationPermissionState());
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSyncLoading, setNotificationSyncLoading] = useState(false);
  const [notificationTestLoading, setNotificationTestLoading] = useState(false);
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
  const roleLabel = userProfile?.role === "admin" ? "Admin" : userProfile?.role === "staff" ? "Staff" : "-";
  const isAdmin = userProfile?.role === "admin";
  const profileDismissedActivityIds = useMemo(
    () => (Array.isArray(userProfile?.dismissed_activity_ids) ? userProfile.dismissed_activity_ids : []),
    [userProfile?.dismissed_activity_ids],
  );
  const newActivities = useMemo(() => {
    const dismissedSet = new Set([
      ...profileDismissedActivityIds,
      ...dismissedActivityIds,
      ...(userProfile?.last_seen_activity_id ? [userProfile.last_seen_activity_id] : []),
    ]);

    return activityLogs.filter((activity) => activity.id && !dismissedSet.has(activity.id));
  }, [activityLogs, dismissedActivityIds, profileDismissedActivityIds, userProfile?.last_seen_activity_id]);
  const visibleActivityCards = newActivities.slice(0, 5);
  const topActivity = newActivities[0];
  const showActivityStack = newActivities.length > 0 || Boolean(closingActivity);
  const activityCountLabel = newActivities.length > 0 ? `${newActivities.length} aktivitas baru` : "Menutup aktivitas";
  const showHistoryHint = activityLogs.length >= 10;
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
    setDismissedActivityIds([]);
    setClosingActivity(null);
    setDragOffset(0);
    setNotificationStatus(getNotificationPermissionState());
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminInvoices([]);
      setInvoiceReminderError(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snap) => {
        const data = snap.docs.map((invoiceDoc) => ({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice));
        data.sort((a, b) => {
          const aDate = getDateValue(a.created_at) || getDateValue(a.tanggal);
          const bDate = getDateValue(b.created_at) || getDateValue(b.tanggal);
          return bDate - aDate;
        });
        setAdminInvoices(data);
        setInvoiceReminderError(false);
      },
      () => {
        setInvoiceReminderError(true);
        setAdminInvoices([]);
      },
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const unprintedInvoices = useMemo(
    () => adminInvoices.filter((invoice) => invoice.is_printed !== true),
    [adminInvoices],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) > 0 && (p.total_stok || 0) <= 3),
    [products],
  );
  const emptyStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) === 0),
    [products],
  );
  const safeStockProducts = useMemo(
    () => products.filter((p) => (p.total_stok || 0) > 3),
    [products],
  );
  const hasAdminWarning = invoiceReminderError || unprintedInvoices.length > 0 || lowStockProducts.length > 0 || emptyStockProducts.length > 0;
  const dashboardDays = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(date),
        revenue: 0,
        count: 0,
      };
    });

    dashboardInvoices.forEach((invoice) => {
      const time = getDateValue(invoice.created_at) || getDateValue(invoice.tanggal);
      if (!time) return;

      const date = new Date(time);
      const key = date.toISOString().slice(0, 10);
      const day = days.find((item) => item.key === key);
      if (!day) return;

      day.revenue += invoice.total || 0;
      day.count += 1;
    });

    return days;
  }, [dashboardInvoices]);
  const maxRevenue = Math.max(...dashboardDays.map((day) => day.revenue), 1);
  const maxInvoiceCount = Math.max(...dashboardDays.map((day) => day.count), 1);
  const dashboardStatus = useMemo(
    () => ({
      lunas: dashboardInvoices.filter((invoice) => invoice.status === "LUNAS").length,
      belumLunas: dashboardInvoices.filter((invoice) => invoice.status === "BELUM LUNAS").length,
    }),
    [dashboardInvoices],
  );
  const topInvoiceProducts = useMemo(() => {
    const productMap = new Map<string, number>();

    dashboardInvoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        if (!item.nama_barang) return;
        productMap.set(item.nama_barang, (productMap.get(item.nama_barang) || 0) + (item.jumlah || 0));
      });
    });

    return Array.from(productMap.entries())
      .map(([name, count]) => ({ name, count }))
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

  const handleDismissActivity = async (activity: ActivityLog, direction: "left" | "right" = "right") => {
    if (!currentUser || !activity.id || closingActivity) return;

    const remainingActivities = newActivities.filter((item) => item.id !== activity.id);
    const updatePayload: Record<string, unknown> = {
      dismissed_activity_ids: arrayUnion(activity.id),
    };

    if (remainingActivities.length === 0) {
      updatePayload.last_seen_activity_id = activity.id;
      updatePayload.last_seen_activity_at = serverTimestamp();
    }

    const activityId = activity.id;
    const closeOffset = dragOffset;
    setClosingActivity({ activity, direction, offset: closeOffset });
    setDragOffset(0);
    setDismissedActivityIds((prev) => (prev.includes(activityId) ? prev : [...prev, activityId]));
    window.setTimeout(() => {
      setClosingActivity((current) => (current?.activity.id === activityId ? null : current));
    }, 260);

    try {
      await updateDoc(doc(db, "users", currentUser.uid), updatePayload);
    } catch {
      setDismissedActivityIds((prev) => prev.filter((id) => id !== activityId));
      toast({ title: "Error", description: "Gagal menutup notifikasi, silakan coba lagi.", variant: "destructive" });
    }
  };

  const handleActivityPointerDown = (event: React.PointerEvent<HTMLDivElement>, activity: ActivityLog) => {
    if (activity.id !== topActivity?.id || closingActivity) return;
    swipeStartX.current = event.clientX;
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleActivityPointerMove = (event: React.PointerEvent<HTMLDivElement>, activity: ActivityLog) => {
    if (activity.id !== topActivity?.id || swipeStartX.current === null || closingActivity) return;

    const nextOffset = event.clientX - swipeStartX.current;
    setDragOffset(Math.max(-110, Math.min(110, nextOffset)));
  };

  const handleActivityPointerEnd = (activity: ActivityLog) => {
    if (activity.id !== topActivity?.id || swipeStartX.current === null || closingActivity) return;

    const direction = dragOffset < 0 ? "left" : "right";
    const shouldDismiss = Math.abs(dragOffset) >= 70;
    swipeStartX.current = null;

    if (shouldDismiss) {
      void handleDismissActivity(activity, direction);
      return;
    }

    setDragOffset(0);
  };

  const cards = [
    { label: "Total Produk", value: totalProduk, clickable: false },
    { label: "Total Stok", value: totalStok, clickable: false },
    { label: "Stok Jogja", value: stokJogja, clickable: true, key: "jogja" as const },
    { label: "Stok Lombok", value: stokLombok, clickable: true, key: "lombok" as const },
  ];

  return (
    <>
      <PullToRefresh onRefresh={handleSafeRefresh} disabled={Boolean(modal)} />

      {showWelcomeAnimation && (
        <WelcomeAnimation name={displayName} role={userProfile?.role} onFinish={handleWelcomeFinish} />
      )}

      <div className={`px-4 pb-24 pt-6 max-w-lg mx-auto ${homeIntroReady ? "tanabrew-page-enter" : "opacity-0"}`}>
        <div className="flex flex-col items-center mb-6">
          <img
            src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
            alt="Tanabrew Logo"
            className="w-24 h-24 rounded-full object-cover border-2 border-primary bg-primary"
          />
          <h1 className="text-xl font-bold text-primary mt-3">Tanabrew</h1>
          <p className="text-sm text-muted-foreground">Trademark</p>
        </div>

        <div className="tanabrew-card-enter bg-card rounded-xl border border-border p-4 mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary truncate">Login sebagai: {displayName}</p>
            <p className="text-xs text-muted-foreground">Role: {roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>

        <div className="tanabrew-card-enter mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm" style={{ animationDelay: "40ms" }}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-primary">Notifikasi Tanabrew</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aktifkan notifikasi untuk menerima info invoice baru, invoice dicetak, dan status pembayaran.
                  </p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${notificationInfo.badgeClass}`}>
                  {notificationInfo.label}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{notificationInfo.description}</p>
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={notificationButtonDisabled}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
              >
                <Bell size={15} />
                {notificationLoading ? "Memproses..." : notificationStatus === "granted" ? "Notifikasi Aktif" : "Aktifkan Notifikasi"}
              </button>
              <button
                type="button"
                onClick={handleSyncNotificationIdentity}
                disabled={notificationSyncDisabled}
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-background px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-55 sm:ml-2 sm:mt-3 sm:w-auto"
              >
                <Bell size={15} />
                {notificationSyncLoading ? "Menyinkronkan..." : "Sinkronkan Identitas Notifikasi"}
              </button>
              {isAdmin && (
                <div className="mt-3 rounded-lg border border-primary/15 bg-background/70 p-3">
                  <p className="text-xs font-semibold text-primary">Untuk uji coba OneSignal.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kirim test otomatis untuk memastikan endpoint Vercel dan OneSignal aktif.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    disabled={notificationTestDisabled}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                  >
                    <Bell size={15} />
                    {notificationTestLoading ? "Mengirim..." : "Kirim Test Notifikasi"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showActivityStack && (
          <div className="tanabrew-card-enter rounded-xl border border-primary/25 bg-primary/5 p-4 mb-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-primary">Aktivitas Terbaru</p>
                <p className="text-xs text-muted-foreground">{activityCountLabel}</p>
              </div>
              {showHistoryHint && (
                <button
                  onClick={() => navigate("/riwayat")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Lihat semua di Riwayat
                </button>
              )}
            </div>

            <div className="tanabrew-activity-stack">
              {closingActivity && (
                <div
                  key={`closing-${closingActivity.activity.id}`}
                  className={`tanabrew-activity-card tanabrew-activity-card-front tanabrew-activity-card-close-${closingActivity.direction}`}
                  style={{
                    zIndex: visibleActivityCards.length + 2,
                    "--tanabrew-activity-drag-x": `${closingActivity.offset}px`,
                    "--tanabrew-activity-drag-rotate": `${closingActivity.offset / 28}deg`,
                  } as CSSProperties}
                  aria-hidden="true"
                >
                  <p className="pr-8 text-sm font-semibold text-foreground">
                    {closingActivity.activity.description || "Ada aktivitas baru."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{closingActivity.activity.user_name || "Tidak diketahui"}</span>
                    <span>-</span>
                    <span>{actionLabel(closingActivity.activity.action)}</span>
                    <span>-</span>
                    <span>Baru saja</span>
                  </div>
                </div>
              )}

              {visibleActivityCards.map((activity, index) => {
                const isFront = index === 0;
                const canInteract = isFront && !closingActivity;
                const rotate = index === 1 ? -2 : index === 2 ? 2 : index === 3 ? -1 : 1;
                const translateY = index * 8;
                const scale = 1 - index * 0.035;
                const opacity = 1 - index * 0.14;
                const activeDragOffset = canInteract ? dragOffset : 0;
                const frontTransform = `translateX(${activeDragOffset}px) rotate(${activeDragOffset / 28}deg)`;
                const backTransform = `translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`;

                return (
                  <div
                    key={activity.id}
                    className={`tanabrew-activity-card ${isFront ? "tanabrew-activity-card-front" : ""}`}
                    style={{
                      zIndex: visibleActivityCards.length - index,
                      opacity,
                      transform: isFront ? frontTransform : backTransform,
                    }}
                    onPointerDown={(event) => handleActivityPointerDown(event, activity)}
                    onPointerMove={(event) => handleActivityPointerMove(event, activity)}
                    onPointerUp={() => handleActivityPointerEnd(activity)}
                    onPointerCancel={() => {
                      swipeStartX.current = null;
                      setDragOffset(0);
                    }}
                    aria-hidden={!isFront || Boolean(closingActivity)}
                  >
                    {canInteract && (
                      <button
                        onClick={() => handleDismissActivity(activity)}
                        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        aria-label="Tutup notifikasi"
                      >
                        <X size={16} />
                      </button>
                    )}

                    <p className="pr-8 text-sm font-semibold text-foreground">
                      {activity.description || "Ada aktivitas baru."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{activity.user_name || "Tidak diketahui"}</span>
                      <span>-</span>
                      <span>{actionLabel(activity.action)}</span>
                      <span>-</span>
                      <span>Baru saja</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Geser atau tutup untuk melihat aktivitas berikutnya
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="tanabrew-card-enter rounded-xl border border-border bg-card p-4 mb-6" style={{ animationDelay: "70ms" }}>
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

        <div className="tanabrew-card-enter tanabrew-dashboard-panel rounded-xl border border-border bg-card p-4 mb-6" style={{ animationDelay: "90ms" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-primary">Dashboard Operasional</h2>
              <p className="text-xs text-muted-foreground">Ringkasan invoice dan stok terbaru</p>
            </div>
          </div>

          {loadingDashboard || loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>
          ) : !hasDashboardData ? (
            <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">Belum ada data grafik.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">Pemasukan 7 Hari</span>
                  <span className="text-muted-foreground">Rp {fmt(dashboardDays.reduce((sum, day) => sum + day.revenue, 0))}</span>
                </div>
                <div className="grid grid-cols-7 items-end gap-2 rounded-lg bg-primary/5 p-3" style={{ minHeight: 132 }}>
                  {dashboardDays.map((day, index) => (
                    <div key={day.key} className="flex h-28 flex-col items-center justify-end gap-1">
                      <div
                        className="tanabrew-dashboard-bar w-full rounded-t-md bg-primary/80 transition-all"
                        style={{ height: `${Math.max(8, (day.revenue / maxRevenue) * 88)}px`, animationDelay: `${index * 80}ms` }}
                        title={`Rp ${fmt(day.revenue)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">Invoice 7 Hari</span>
                  <span className="text-muted-foreground">{dashboardDays.reduce((sum, day) => sum + day.count, 0)} invoice</span>
                </div>
                <div className="grid grid-cols-7 items-end gap-2 rounded-lg bg-muted p-3" style={{ minHeight: 112 }}>
                  {dashboardDays.map((day, index) => (
                    <div key={day.key} className="flex h-24 flex-col items-center justify-end gap-1">
                      <div
                        className="tanabrew-dashboard-bar w-full rounded-t-md bg-emerald-500/80 transition-all"
                        style={{ height: `${Math.max(8, (day.count / maxInvoiceCount) * 72)}px`, animationDelay: `${100 + index * 80}ms` }}
                        title={`${day.count} invoice`}
                      />
                      <span className="text-[10px] text-muted-foreground">{day.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="tanabrew-dashboard-stat rounded-lg bg-primary/10 px-3 py-2" style={{ animationDelay: "100ms" }}>
                  <p className="text-muted-foreground">Invoice Lunas</p>
                  <p className="font-bold text-primary">{dashboardStatus.lunas}</p>
                </div>
                <div className="tanabrew-dashboard-stat rounded-lg bg-destructive/10 px-3 py-2" style={{ animationDelay: "180ms" }}>
                  <p className="text-muted-foreground">Belum Lunas</p>
                  <p className="font-bold text-destructive">{dashboardStatus.belumLunas}</p>
                </div>
                <div className="tanabrew-dashboard-stat rounded-lg bg-primary/10 px-3 py-2" style={{ animationDelay: "260ms" }}>
                  <p className="text-muted-foreground">Stok Aman</p>
                  <p className="font-bold text-primary">{safeStockProducts.length}</p>
                </div>
                <div className="tanabrew-dashboard-stat rounded-lg bg-yellow-100/80 px-3 py-2" style={{ animationDelay: "340ms" }}>
                  <p className="text-muted-foreground">Stok Menipis</p>
                  <p className="font-bold text-yellow-800">{lowStockProducts.length}</p>
                </div>
                <div className="tanabrew-dashboard-stat rounded-lg bg-destructive/10 px-3 py-2" style={{ animationDelay: "420ms" }}>
                  <p className="text-muted-foreground">Stok Habis</p>
                  <p className="font-bold text-destructive">{emptyStockProducts.length}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-primary">Produk Sering Masuk Invoice</p>
                {topInvoiceProducts.length === 0 ? (
                  <p className="rounded-lg bg-muted px-3 py-3 text-center text-xs text-muted-foreground">Belum ada produk di invoice.</p>
                ) : (
                  <div className="space-y-2">
                    {topInvoiceProducts.map((product, index) => (
                      <div
                        key={product.name}
                        className="tanabrew-dashboard-list-item flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-xs"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <span className="font-semibold text-foreground truncate">{product.name}</span>
                        <span className="font-bold text-primary">{product.count} pcs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
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
              onClick={() => c.clickable && c.key && setModal(c.key)}
              className={`tanabrew-card-enter rounded-xl bg-card border border-border p-4 text-center transition-shadow ${
                c.clickable ? "cursor-pointer active:shadow-md hover:border-primary/40" : "cursor-default"
              }`}
            >
              <p className="text-2xl font-bold text-primary">{loading ? "..." : c.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </button>
          ))}
        </div>

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

        {modal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40" onClick={() => setModal(null)}>
            <div className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[70vh] overflow-y-auto tanabrew-card-enter" onClick={(e) => e.stopPropagation()}>
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
    </>
  );
};

export default Beranda;
