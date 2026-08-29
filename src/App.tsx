import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
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
import Spreadsheet from "@/pages/Spreadsheet";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import GodMode from "@/pages/GodMode";
import { logoutOneSignalUser, syncOneSignalUserIdentity } from "@/lib/onesignal";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const AppRoutes = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  const previousOneSignalUid = useRef<string | null>(null);
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const showBottomNav = Boolean(currentUser) && !loading && !isAuthPage;

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
      <div key={location.pathname} className="tanabrew-route-enter">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedPage><Beranda /></ProtectedPage>} />
          <Route path="/update-stok" element={<ProtectedPage><UpdateStok /></ProtectedPage>} />
          <Route path="/cetak-invoice" element={<ProtectedPage><CetakInvoice /></ProtectedPage>} />
          <Route path="/riwayat" element={<ProtectedPage><Riwayat /></ProtectedPage>} />
          <Route path="/spreadsheet" element={<ProtectedPage><Spreadsheet /></ProtectedPage>} />
          <Route path="/god-mode" element={<ProtectedPage><GodMode /></ProtectedPage>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {showBottomNav && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
