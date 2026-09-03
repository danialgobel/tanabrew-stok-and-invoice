import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = "/";
    }
  };

  private handleReset = () => {
    try {
      this.setState({ hasError: false, error: null });
    } catch {
      window.location.href = "/";
    }
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
              <AlertTriangle size={28} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Terjadi Kendala Memuat Halaman</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sistem mendeteksi adanya kendala rendering data sementara.
              </p>
            </div>
            {this.state.error && (
              <div className="rounded-xl bg-muted/60 p-2.5 text-left text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                >
                  <RotateCcw size={14} /> Muat Ulang Halaman
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center justify-center rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              >
                <Home size={13} /> Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
