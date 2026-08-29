import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { triggerHaptic } from "@/lib/haptics";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Users,
  Shield,
  Clock,
  Sparkles,
  Loader2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Circle,
  X,
} from "lucide-react";
import type { UserProfile } from "@/context/AuthContext";

interface TeamMember extends UserProfile {
  is_online?: boolean;
}

interface TeamMessage {
  id?: string;
  sender_uid: string;
  sender_name: string;
  sender_role: string;
  sender_photo?: string;
  message: string;
  created_at?: any;
}

const Obrolan = () => {
  const { currentUser, userProfile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMembersModal, setShowAllMembersModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch team members with active presence (silent background fetch)
  const fetchTeamMembers = useCallback(async (isSilent = true) => {
    if (!currentUser) return;
    if (!isSilent) setRefreshing(true);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/team-chat", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && data.users) {
        const roleOrder: Record<string, number> = { owner: 4, webdev: 3, admin: 2, staff: 1 };
        const sortedMembers = data.users.sort((a: TeamMember, b: TeamMember) => {
          if (a.uid === currentUser.uid) return -1;
          if (b.uid === currentUser.uid) return 1;
          if (a.is_online && !b.is_online) return -1;
          if (!a.is_online && b.is_online) return 1;
          return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0);
        });
        setTeamMembers(sortedMembers);
        if (data.messages && data.messages.length > 0 && messages.length === 0) {
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.warn("Gagal memuat anggota tim:", err);
    } finally {
      setRefreshing(false);
    }
  }, [currentUser, messages.length]);

  // 2. Realtime listener for instant messages (0 lag, 0 delay) + presence sync
  useEffect(() => {
    // Initial fetch in background
    fetchTeamMembers(true);

    // Refresh presence every 30 seconds
    const presenceInterval = setInterval(() => {
      fetchTeamMembers(true);
    }, 30000);

    // Realtime Firestore listener for instant message delivery
    let unsubSnapshot: (() => void) | null = null;
    try {
      const q = query(collection(db, "team_messages"), orderBy("created_at", "asc"), limit(100));
      unsubSnapshot = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const msgs: TeamMessage[] = [];
            snapshot.forEach((doc) => {
              msgs.push({ id: doc.id, ...doc.data() } as TeamMessage);
            });
            setMessages(msgs);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 50);
          }
        },
        (err) => {
          console.warn("Snapshot fallback to API fetch:", err);
        }
      );
    } catch (err) {
      console.warn("Realtime listener init error:", err);
    }

    return () => {
      clearInterval(presenceInterval);
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [fetchTeamMembers]);

  // Scroll to bottom on initial message load
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !currentUser || sending) return;

    setSending(true);
    triggerHaptic(15);

    // Optimistic message addition for instant UI feedback
    const optimisticMsg: TeamMessage = {
      id: `temp-${Date.now()}`,
      sender_uid: currentUser.uid,
      sender_name: userProfile?.name || currentUser.displayName || "Saya",
      sender_role: userProfile?.role || "staff",
      sender_photo: userProfile?.photo_url || "",
      message: text,
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/team-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Gagal mengirim pesan");
      }

      triggerHaptic(25);
      // Refresh presence in background
      fetchTeamMembers(true);
    } catch (err: any) {
      toast({
        title: "Gagal Mengirim Pesan",
        description: err.message || "Periksa koneksi internet Anda.",
        variant: "destructive",
      });
      // Revert optimistic message if error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    const text = name || email || "U";
    return text
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "owner":
        return { label: "Owner", class: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
      case "admin":
        return { label: "Admin", class: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      case "webdev":
        return { label: "Developer", class: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      default:
        return { label: "Staff", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";
    try {
      let date: Date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  };

  const formatLastActive = (timestamp: any) => {
    if (!timestamp) return "Belum ada riwayat aktif";
    try {
      let date: Date;
      if (timestamp.toDate) {
        date = timestamp.toDate();
      } else if (timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 5) return "Aktif saat ini";
      if (diffMinutes < 60) return `Aktif ${diffMinutes} menit lalu`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Aktif ${diffHours} jam lalu`;
      return `Aktif ${Math.floor(diffHours / 24)} hari lalu`;
    } catch {
      return "Offline";
    }
  };

  const onlineCount = teamMembers.filter((m) => m.is_online).length;

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-36 pt-4 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* 1. HEADER OBROLAN TIM */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold border border-primary/20 shrink-0">
              <MessageSquare size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Obrolan Tim Tanabrew</h1>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {onlineCount} Online
                </span>
                <span>•</span>
                <span>{teamMembers.length} Anggota</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchTeamMembers(false)}
              disabled={refreshing}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Perbarui Pesan"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-primary" : ""} />
            </button>
            <button
              onClick={() => {
                triggerHaptic(10);
                setShowAllMembersModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted transition-colors"
            >
              <Users size={12} />
              Daftar Tim
            </button>
          </div>
        </div>

        {/* 2. ANGGOTA TIM CAROUSEL (DENGAN INDIKATOR STATUS ONLINE/OFFLINE) */}
        <div className="pt-2.5 border-t border-border/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Users size={11} /> Status Kehadiran Tim
            </p>
            <span className="text-[10px] text-muted-foreground">Geser &rarr;</span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-none">
            {teamMembers.map((member) => {
              const isMe = member.uid === currentUser?.uid;
              const roleBadge = getRoleBadge(member.role);
              const isOnline = Boolean(member.is_online || isMe);

              return (
                <div
                  key={member.uid}
                  onClick={() => {
                    triggerHaptic(10);
                    setShowAllMembersModal(true);
                  }}
                  className="flex flex-col items-center gap-1 shrink-0 w-16 text-center cursor-pointer group"
                >
                  <div className="relative">
                    <div
                      className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-active:scale-95 ${
                        isOnline
                          ? "ring-2 ring-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : "ring-1 ring-border bg-muted/60 text-muted-foreground opacity-75"
                      }`}
                    >
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(member.name, member.email)
                      )}
                    </div>

                    {/* Badge Online / Offline */}
                    <span
                      className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card ${
                        isOnline ? "bg-emerald-500 ring-1 ring-emerald-500/30 animate-pulse" : "bg-muted-foreground/40"
                      }`}
                      title={isOnline ? "Online" : "Offline"}
                    />
                  </div>

                  <span className="text-[10px] font-bold text-foreground truncate w-full leading-tight">
                    {isMe ? "Saya" : member.name.split(" ")[0]}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border uppercase ${roleBadge.class}`}>
                    {roleBadge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. AREA FEED PESAN GRUP (WHATSAPP / TELEGRAM STYLE) */}
      <div className="flex-1 space-y-3 py-2">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center space-y-2 my-8 shadow-xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles size={22} />
            </div>
            <h3 className="text-sm font-bold text-foreground">Belum Ada Percakapan</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Ketik pesan di bawah untuk memulai koordinasi. Pesan otomatis memicu notifikasi Web Push ke seluruh perangkat rekan kerja.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe =
              msg.sender_uid === currentUser?.uid ||
              (msg.sender_name && userProfile?.name && msg.sender_name === userProfile.name) ||
              (currentUser?.email && msg.sender_name === currentUser.email.split("@")[0]);
            const roleBadge = getRoleBadge(msg.sender_role);

            return (
              <div
                key={msg.id || index}
                className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center font-bold text-[10px] text-primary shrink-0 mb-1">
                    {msg.sender_photo ? (
                      <img
                        src={msg.sender_photo}
                        alt={msg.sender_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(msg.sender_name)
                    )}
                  </div>
                )}

                <div className={`max-w-[80%] space-y-1 ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                  {!isMe && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      <span className="font-bold text-foreground truncate max-w-[130px]">{msg.sender_name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold border uppercase ${roleBadge.class}`}>
                        {roleBadge.label}
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-xs font-medium"
                        : "bg-card border border-border text-foreground rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span
                        className={`text-[9px] ${
                          isMe ? "text-primary-foreground/75" : "text-muted-foreground"
                        }`}
                      >
                        {formatMessageTime(msg.created_at)}
                      </span>
                      {isMe && <CheckCheck size={12} className="text-primary-foreground/75" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. FORM INPUT PESAN (DENGAN PERLINDUNGAN ANTI-ZOOM FONT 16PX) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t border-border p-3">
        <form
          onSubmit={handleSendMessage}
          className="mx-auto max-w-lg flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tulis pesan untuk tim..."
            disabled={sending}
            style={{ fontSize: "16px" }}
            className="flex-1 rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            title="Kirim Pesan"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>

      {/* 5. MODAL DAFTAR LENGKAP ANGGOTA TIM (STATUS DETAIL ONLINE & TERAKHIR AKTIF) */}
      {showAllMembersModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowAllMembersModal(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 border border-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center sm:hidden pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Daftar Anggota Tim</h3>
                  <p className="text-[11px] text-muted-foreground">Status kehadiran seluruh staf Tanabrew</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllMembersModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="divide-y divide-border/60">
              {teamMembers.map((member) => {
                const isMe = member.uid === currentUser?.uid;
                const roleBadge = getRoleBadge(member.role);
                const isOnline = Boolean(member.is_online || isMe);

                return (
                  <div key={member.uid} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`h-11 w-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs ${
                            isOnline
                              ? "ring-2 ring-emerald-500 bg-emerald-500/10 text-emerald-600"
                              : "ring-1 ring-border bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {member.photo_url ? (
                            <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                          ) : (
                            getInitials(member.name, member.email)
                          )}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
                            isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">
                            {member.name} {isMe && "(Saya)"}
                          </p>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border uppercase ${roleBadge.class}`}>
                            {roleBadge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                          isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        }`}
                      >
                        {isOnline ? "Online" : formatLastActive(member.last_active_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAllMembersModal(false)}
              className="w-full rounded-2xl bg-muted py-3 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Obrolan;
