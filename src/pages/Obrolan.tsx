import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { sendTanabrewNotification } from "@/lib/notificationSender";
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
} from "lucide-react";
import type { UserProfile } from "@/context/AuthContext";

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
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Realtime listener for Team Members
  useEffect(() => {
    const qUsers = collection(db, "users");
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const members: UserProfile[] = [];
      snap.forEach((doc) => {
        members.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      // Sort: current user first, then by role (owner -> admin -> webdev -> staff)
      const roleWeight: Record<string, number> = { owner: 4, webdev: 3, admin: 2, staff: 1 };
      members.sort((a, b) => (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0));
      setTeamMembers(members);
    });

    return () => unsubUsers();
  }, []);

  // 2. Realtime listener for Group Messages
  useEffect(() => {
    const qMessages = query(
      collection(db, "team_messages"),
      orderBy("created_at", "asc"),
      limit(150)
    );

    const unsubMessages = onSnapshot(
      qMessages,
      (snap) => {
        const msgs: TeamMessage[] = [];
        snap.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() } as TeamMessage);
        });
        setMessages(msgs);
        setLoadingMessages(false);
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        console.error("Gagal memuat pesan obrolan", error);
        setLoadingMessages(false);
      }
    );

    return () => unsubMessages();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !currentUser || sending) return;

    setSending(true);
    triggerHaptic(15);

    const senderName = userProfile?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Staf";
    const senderRole = userProfile?.role || "staff";
    const senderPhoto = userProfile?.photo_url || "";

    try {
      // 1. Simpan pesan ke Firestore
      await addDoc(collection(db, "team_messages"), {
        sender_uid: currentUser.uid,
        sender_name: senderName,
        sender_role: senderRole,
        sender_photo: senderPhoto,
        message: text,
        created_at: serverTimestamp(),
      });

      setInputText("");
      triggerHaptic(25);

      // 2. Kirim Web Push Notification ke seluruh perangkat anggota tim
      void sendTanabrewNotification(
        {
          type: "TEAM_CHAT_MESSAGE",
          actorName: senderName,
          actorRole: senderRole,
          title: `[Pesan Tim] ${senderName} (${senderRole.toUpperCase()})`,
          message: text.length > 90 ? `${text.slice(0, 90)}...` : text,
        },
        currentUser
      ).catch((err) => {
        console.warn("Gagal broadcast push notification pesan", err);
      });
    } catch (err: any) {
      toast({
        title: "Gagal Mengirim Pesan",
        description: err.message || "Periksa koneksi internet Anda.",
        variant: "destructive",
      });
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
    if (!timestamp) return "Baru saja";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-4 pb-36 pt-4 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* HEADER OBROLAN */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold border border-primary/20">
              <MessageSquare size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Obrolan Tim Tanabrew</h1>
              <p className="text-[11px] text-muted-foreground">Ruang koordinasi & bertukar pesan real-time</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {teamMembers.length} Anggota
          </span>
        </div>

        {/* DAFTAR ANGGOTA TIM HORIZONTAL SCROLL */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Users size={11} /> Tim Terdaftar
          </p>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
            {teamMembers.map((member) => {
              const isMe = member.uid === currentUser?.uid;
              const roleBadge = getRoleBadge(member.role);
              return (
                <div
                  key={member.uid}
                  className="flex flex-col items-center gap-1 shrink-0 w-14 text-center group"
                >
                  <div className="relative">
                    <div className="h-11 w-11 rounded-full bg-primary/10 border-2 border-primary/20 overflow-hidden flex items-center justify-center font-bold text-xs text-primary shadow-xs">
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
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card"
                      title="Aktif"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-foreground truncate w-full leading-tight">
                    {isMe ? "Saya" : member.name.split(" ")[0]}
                  </span>
                  <span className={`text-[8px] font-bold px-1 rounded uppercase ${roleBadge.class}`}>
                    {member.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AREA BALON PESAN (CHAT MESSAGES) */}
      <div className="flex-1 space-y-3 py-2">
        {loadingMessages ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-xs font-semibold">Memuat riwayat obrolan...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2 my-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles size={22} />
            </div>
            <h3 className="text-xs font-bold text-foreground">Belum Ada Pesan</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Mulai obrolan bersama tim Tanabrew. Pesan yang Anda kirim akan memunculkan notifikasi di HP rekan kerja.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_uid === currentUser?.uid;
            const roleBadge = getRoleBadge(msg.sender_role);

            return (
              <div
                key={msg.id}
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

                <div className={`max-w-[78%] space-y-1 ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                  {!isMe && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                      <span className="font-bold text-foreground truncate max-w-[120px]">{msg.sender_name}</span>
                      <span className={`px-1 rounded-full text-[8px] font-bold border uppercase ${roleBadge.class}`}>
                        {roleBadge.label}
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-xs font-medium"
                        : "bg-card border border-border text-foreground rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <span
                      className={`block text-[9px] mt-1 ${
                        isMe ? "text-primary-foreground/75 text-right" : "text-muted-foreground text-right"
                      }`}
                    >
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT FORM (STICKY DI ATAS BOTTOM NAV) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border p-3">
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
            className="flex-1 rounded-xl border border-input bg-card px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            title="Kirim Pesan"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Obrolan;
