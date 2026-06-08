import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const AppRoutes = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const showBottomNav = Boolean(currentUser) && !loading && !isAuthPage;

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedPage><Beranda /></ProtectedPage>} />
        <Route path="/update-stok" element={<ProtectedPage><UpdateStok /></ProtectedPage>} />
        <Route path="/cetak-invoice" element={<ProtectedPage><CetakInvoice /></ProtectedPage>} />
        <Route path="/riwayat" element={<ProtectedPage><Riwayat /></ProtectedPage>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
