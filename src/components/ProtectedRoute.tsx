import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-sm text-muted-foreground">
        Memuat...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
