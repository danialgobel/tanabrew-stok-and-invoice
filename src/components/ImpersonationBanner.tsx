import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeftRight, UserCheck, Loader2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";

export const ImpersonationBanner = () => {
  const { currentUser, userProfile, switchUserAccount } = useAuth();
  const { toast } = useToast();
  const [originalDevUid, setOriginalDevUid] = useState<string | null>(null);
  const [originalDevName, setOriginalDevName] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const devUid = localStorage.getItem("tanabrew_original_dev_uid");
    const devName = localStorage.getItem("tanabrew_original_dev_name") || "Developer";
    if (devUid && currentUser && currentUser.uid !== devUid) {
      setOriginalDevUid(devUid);
      setOriginalDevName(devName);
    } else {
      setOriginalDevUid(null);
      setOriginalDevName(null);
    }
  }, [currentUser]);

  if (!originalDevUid || !currentUser) return null;

  const handleSwitchBack = async () => {
    setSwitching(true);
    triggerHaptic(20);
    try {
      await switchUserAccount(originalDevUid);
      localStorage.removeItem("tanabrew_original_dev_uid");
      localStorage.removeItem("tanabrew_original_dev_name");
      setOriginalDevUid(null);
      toast({
        title: "Kembali ke Akun Utama",
        description: `Anda telah kembali ke akun ${originalDevName}.`,
      });
    } catch (err: any) {
      toast({
        title: "Gagal Kembali",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <aside
      aria-label="Mode Akses Staf"
      className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-purple-900/90 text-white px-4 py-2 text-xs backdrop-blur-md border-b border-purple-500/30 shadow-md animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2 min-w-0">
        <UserCheck size={14} className="text-purple-300 shrink-0" />
        <p className="truncate font-semibold text-[11px] sm:text-xs">
          Login Staf: <span className="underline font-bold text-yellow-300">{userProfile?.name || currentUser.email}</span> ({userProfile?.role?.toUpperCase() || "STAFF"})
        </p>
      </div>

      <button
        onClick={handleSwitchBack}
        disabled={switching}
        className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black px-2.5 py-1 font-bold text-[10px] sm:text-xs shadow-xs shrink-0 transition-all active:scale-95 disabled:opacity-50"
      >
        {switching ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <ArrowLeftRight size={12} />
        )}
        <span>Kembali ke Developer</span>
      </button>
    </aside>
  );
};
