import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const [showManualFallback, setShowManualFallback] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setShowManualFallback(true), 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-foreground">Menghubungkan ke Tanabrew...</p>
        <p className="text-xs text-muted-foreground mt-1">Memeriksa status sesi pengguna</p>
        {showManualFallback && (
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="mt-4 text-xs font-semibold text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
          >
            Lanjut ke Halaman Login &rarr;
          </button>
        )}
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

