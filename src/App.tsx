import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import BottomNav from "@/components/BottomNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import Beranda from "@/pages/Beranda";
import UpdateStok from "@/pages/UpdateStok";
import CetakInvoice from "@/pages/CetakInvoice";
import Riwayat from "@/pages/Riwayat";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import Akun from "@/pages/Akun";
import GodMode from "@/pages/GodMode";
import Obrolan from "@/pages/Obrolan";
import PriceListPublic from "@/pages/PriceListPublic";
import { logoutOneSignalUser, syncOneSignalUserIdentity } from "@/lib/onesignal";

const queryClient = new QueryClient();

import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { AppUpdateAnnouncementModal } from "@/components/AppUpdateAnnouncementModal";

import { DesktopSidebar } from "@/components/DesktopSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ProtectedPage = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const AppRoutes = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  const previousOneSignalUid = useRef<string | null>(null);
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isPublicMenu = location.pathname === "/pricelist" || location.pathname === "/menu";
  const showNav = Boolean(currentUser) && !loading && !isAuthPage && !isPublicMenu;
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return typeof window !== "undefined" && localStorage.getItem("tanabrew_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    const handleSidebarChange = (e: CustomEvent<{ collapsed: boolean }>) => {
      setSidebarCollapsed(e.detail.collapsed);
    };
    window.addEventListener("tanabrew:sidebar-state-change" as any, handleSidebarChange);
    return () => window.removeEventListener("tanabrew:sidebar-state-change" as any, handleSidebarChange);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (currentUser && userProfile) {
      previousOneSignalUid.current = currentUser.uid;
      void syncOneSignalUserIdentity({
        uid: currentUser.uid,
        name: userProfile.name || currentUser.displayName || currentUser.email || "",
        email: userProfile.email || currentUser.email || "",
        role: userProfile.role,
      }).catch((error) => {
        console.warn("Gagal menyinkronkan identitas user OneSignal", error);
      });
      return;
    }

    if (!currentUser && previousOneSignalUid.current) {
      previousOneSignalUid.current = null;
      void logoutOneSignalUser().catch((error) => {
        console.warn("Gagal logout OneSignal", error);
      });
    }
  }, [
    currentUser,
    currentUser?.displayName,
    currentUser?.email,
    loading,
    userProfile?.email,
    userProfile?.name,
    userProfile?.role,
  ]);

  return (
    <>
      <ImpersonationBanner />
      {showNav && <DesktopSidebar />}
      <div className={`min-h-screen transition-all duration-300 ${showNav ? (sidebarCollapsed ? "lg:pl-20" : "lg:pl-64") : ""}`}>
        <div key={location.pathname} className="tanabrew-route-enter">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricelist" element={<PriceListPublic />} />
            <Route path="/menu" element={<PriceListPublic />} />
            <Route path="/" element={<ProtectedPage><Beranda /></ProtectedPage>} />
            <Route path="/update-stok" element={<ProtectedPage><UpdateStok /></ProtectedPage>} />
            <Route path="/cetak-invoice" element={<ProtectedPage><CetakInvoice /></ProtectedPage>} />
            <Route path="/riwayat" element={<ProtectedPage><Riwayat /></ProtectedPage>} />
            <Route path="/obrolan" element={<ProtectedPage><Obrolan /></ProtectedPage>} />
            <Route path="/akun" element={<ProtectedPage><Akun /></ProtectedPage>} />
            <Route path="/god-mode" element={<ProtectedPage><GodMode /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
      {showNav && <BottomNav />}
      {!isPublicMenu && <PWAInstallPrompt />}
      <AppUpdateAnnouncementModal />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
