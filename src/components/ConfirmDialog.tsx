import { triggerHaptic } from "@/lib/haptics";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 transition-all duration-300 animate-in fade-in"
      onClick={() => {
        if (!loading) {
          triggerHaptic(10);
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle for mobile */}
        <div className="flex justify-center sm:hidden pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              danger
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            {danger ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-base font-bold text-foreground leading-snug">{title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onCancel();
            }}
            disabled={loading}
            className="rounded-xl border border-border bg-muted/60 py-3 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(danger ? 25 : 15);
              onConfirm();
            }}
            disabled={loading}
            className={`rounded-xl py-3 text-xs font-bold text-white transition-all shadow-sm active:scale-98 disabled:opacity-50 ${
              danger
                ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20"
                : "bg-primary hover:bg-primary/90 shadow-primary/20"
            }`}
          >
            {loading ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
