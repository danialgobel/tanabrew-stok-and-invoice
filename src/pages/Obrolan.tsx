import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs } from "firebase/firestore";
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
  CheckCheck,
  RefreshCw,
  X,
  UserCheck,
} from "lucide-react";
import type { UserProfile } from "@/context/AuthContext";

interface TeamMember extends UserProfile {
  is_online?: boolean;
  last_active_at?: any;
}

interface TeamMessage {
  id?: string;
  sender_uid: string;
  sender_name: string;
  sender_role: string;
  sender_photo?: string;
  message: string;
  recipient_uid?: string;
  recipient_name?: string;
  recipient_role?: string;
  conversation_id?: string;
  created_at?: any;
}

export const Obrolan = () => {
  const { currentUser, userProfile } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("tanabrew_cached_team_members");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMembersModal, setShowAllMembersModal] = useState(false);
  const [activeRecipient, setActiveRecipient] = useState<TeamMember | null>(null);
  const [chatTab, setChatTab] = useState<"team" | "direct">("team");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const sortTeamMembers = useCallback((users: TeamMember[]) => {
    const roleOrder: Record<string, number> = { owner: 4, webdev: 3, admin: 2, staff: 1 };
    return [...users].sort((a: TeamMember, b: TeamMember) => {
      // 1. Akun sendiri selalu paling atas
      if (currentUser && a.uid === currentUser.uid) return -1;
      if (currentUser && b.uid === currentUser.uid) return 1;

      // 2. Utamakan yang sedang online
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;

      // 3. Utamakan yang punya foto profil
      const hasPhotoA = Boolean(a.photo_url && a.photo_url.trim().length > 0);
      const hasPhotoB = Boolean(b.photo_url && b.photo_url.trim().length > 0);
      if (hasPhotoA && !hasPhotoB) return -1;
      if (!hasPhotoA && hasPhotoB) return 1;

      // 4. Urutkan berdasarkan role
      return (roleOrder[b.role] || 0) - (roleOrder[a.role] || 0);
    });
  }, [currentUser]);

  // Fallback discovery to fetch members from Admin API or activity logs/invoices
  const discoverFallbackMembers = useCallback(async () => {
    const memberMap = new Map<string, TeamMember>();

    // Add current user first
    if (currentUser) {
      memberMap.set(currentUser.uid, {
        uid: currentUser.uid,
        name: userProfile?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Saya",
        email: userProfile?.email || currentUser.email || "",
        role: userProfile?.role || "staff",
        photo_url: userProfile?.photo_url || "",
        is_online: true,
      });
    }

    // Tier 1: Try /api/admin-users (Admin SDK)
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch("/api/admin-users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.users) && data.users.length > 0) {
            data.users.forEach((u: any) => {
              const uid = u.id || u.uid;
              if (uid) {
                memberMap.set(uid, {
                  uid,
                  name: u.name || u.email?.split("@")[0] || "Anggota Tim",
                  email: u.email || "",
                  role: u.role || "staff",
                  photo_url: u.photo_url || "",
                  last_active_at: u.last_active_at || null,
                  is_online: uid === currentUser.uid || Boolean(u.is_online),
                });
              }
            });
          }
        }
      } catch {}
    }

    // Tier 2: Aggregate from recent activity_logs & invoices if memberMap is still small
    if (memberMap.size <= 1) {
      try {
        const [logsSnap, invSnap] = await Promise.allSettled([
          getDocs(query(collection(db, "activity_logs"), orderBy("created_at", "desc"), limit(40))),
          getDocs(query(collection(db, "invoices"), orderBy("created_at", "desc"), limit(40))),
        ]);

        if (logsSnap.status === "fulfilled") {
          logsSnap.value.docs.forEach((d) => {
            const data = d.data();
            const uid = data.user?.uid || data.user_id;
            const name = data.user?.name || data.user_name;
            const role = data.user?.role || data.user_role || "staff";
            if (uid && !memberMap.has(uid)) {
              memberMap.set(uid, {
                uid,
                name: name || "Anggota Tim",
                email: "",
                role,
                photo_url: "",
                is_online: false,
              });
            }
          });
        }

        if (invSnap.status === "fulfilled") {
          invSnap.value.docs.forEach((d) => {
            const data = d.data();
            const uid = data.dibuat_oleh_uid;
            const name = data.dibuat_oleh;
            const role = data.dibuat_oleh_role || "staff";
            if (uid && !memberMap.has(uid)) {
              memberMap.set(uid, {
                uid,
                name: name || "Staff Kasir",
                email: "",
                role,
                photo_url: "",
                is_online: false,
              });
            }
          });
        }
      } catch {}
    }

    const list = Array.from(memberMap.values());
    if (list.length > 0) {
      const sorted = sortTeamMembers(list);
      setTeamMembers(sorted);
      try {
        sessionStorage.setItem("tanabrew_cached_team_members", JSON.stringify(sorted));
      } catch {}
    }
  }, [currentUser, sortTeamMembers, userProfile]);

  // Stable references to prevent listener churn and rapid unwatch/watch cycling
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  const sortTeamMembersRef = useRef(sortTeamMembers);
  sortTeamMembersRef.current = sortTeamMembers;

  const discoverFallbackMembersRef = useRef(discoverFallbackMembers);
  discoverFallbackMembersRef.current = discoverFallbackMembers;

  // Sync active presence once per session safely without triggering effect loops
  const hasSyncedPresence = useRef(false);
  useEffect(() => {
    if (!currentUser?.uid || hasSyncedPresence.current) return;
    hasSyncedPresence.current = true;
    void updateDoc(doc(db, "users", currentUser.uid), {
      last_active_at: serverTimestamp(),
    }).catch(() => {});
  }, [currentUser?.uid]);

  // Direct realtime listeners for Firestore - stable lifecycle tied only to currentUser.uid
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);

    // Seed self immediately so UI is never blank
    setTeamMembers((prev) => {
      if (prev.some((m) => m.uid === currentUser.uid)) return prev;
      return [
        {
          uid: currentUser.uid,
          name: userProfileRef.current?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Saya",
          email: userProfileRef.current?.email || currentUser.email || "",
          role: userProfileRef.current?.role || "staff",
          photo_url: userProfileRef.current?.photo_url || "",
          is_online: true,
        },
        ...prev,
      ];
    });

    // Realtime users / team members subscription
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        if (snap.empty) {
          void discoverFallbackMembersRef.current();
          setLoading(false);
          return;
        }

        const members: TeamMember[] = snap.docs.map((d) => {
          const data = d.data();
          const lastActive = data.last_active_at?.toDate
            ? data.last_active_at.toDate()
            : data.last_active_at
            ? new Date(data.last_active_at)
            : null;
          const isOnline = lastActive ? Date.now() - lastActive.getTime() < 10 * 60 * 1000 : false;

          return {
            uid: d.id,
            name: data.name || data.email?.split("@")[0] || "Anggota Tim",
            email: data.email || "",
            role: data.role || "staff",
            photo_url: data.photo_url || "",
            last_active_at: data.last_active_at,
            is_online: isOnline || (currentUserRef.current && d.id === currentUserRef.current.uid),
          } as TeamMember;
        });

        const sorted = sortTeamMembersRef.current(members);
        setTeamMembers(sorted);
        try {
          sessionStorage.setItem("tanabrew_cached_team_members", JSON.stringify(sorted));
        } catch {}
        setLoading(false);
      },
      (err) => {
        console.warn("Users realtime listener notice (using resilient fallback):", err);
        void discoverFallbackMembersRef.current();
        setLoading(false);
      }
    );

    // Realtime group chat messages subscription
    const q = query(collection(db, "team_messages"), orderBy("created_at", "asc"), limit(150));
    const unsubMessages = onSnapshot(
      q,
      (snapshot) => {
        const msgs: TeamMessage[] = [];
        snapshot.forEach((d) => {
          msgs.push({ id: d.id, ...d.data() } as TeamMessage);
        });

        // Ensure safe sort by created_at even during pending server timestamp
        msgs.sort((a, b) => {
          const timeA = a.created_at?.toDate
            ? a.created_at.toDate().getTime()
            : a.created_at
            ? new Date(a.created_at).getTime()
            : Date.now();
          const timeB = b.created_at?.toDate
            ? b.created_at.toDate().getTime()
            : b.created_at
            ? new Date(b.created_at).getTime()
            : Date.now();
          return timeA - timeB;
        });

        setMessages(msgs);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      },
      (err) => {
        console.warn("Messages realtime listener notice:", err);
      }
    );

    return () => {
      unsubUsers();
      unsubMessages();
    };
  }, [currentUser?.uid]);

  // Fetch team chat data from Admin SDK backend (bypasses Firestore client permissions)
  const fetchChatData = useCallback(async (isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) setRefreshing(true);

    try {
      const token = await currentUser.getIdToken();
      let res: Response | null = await fetch("/api/team-chat", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("https://tanabrew-stok-and-invoice.vercel.app/api/team-chat", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => null);
      }

      if (!res || !res.ok) throw new Error(`HTTP ${res?.status || "Offline"}`);

      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.users) && data.users.length > 0) {
          const sorted = sortTeamMembersRef.current(data.users);
          setTeamMembers(sorted);
        }
        if (Array.isArray(data.messages)) {
          setMessages((prev) => {
            const serverIds = new Set(data.messages.map((m: any) => m.id));
            const pendingOptimistic = prev.filter((m) => m.id?.startsWith("temp-") && !serverIds.has(m.id));
            const combined = [...data.messages, ...pendingOptimistic];
            combined.sort((a, b) => {
              const timeA = a.created_at?.toDate
                ? a.created_at.toDate().getTime()
                : a.created_at?._seconds
                ? a.created_at._seconds * 1000
                : a.created_at
                ? new Date(a.created_at).getTime()
                : Date.now();
              const timeB = b.created_at?.toDate
                ? b.created_at.toDate().getTime()
                : b.created_at?._seconds
                ? b.created_at._seconds * 1000
                : b.created_at
                ? new Date(b.created_at).getTime()
                : Date.now();
              return timeA - timeB;
            });
            return combined;
          });
        }
      }
    } catch (err) {
      console.warn("fetchChatData notice:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  // Initial sync and gentle background sync (every 60s when visible to preserve Firestore quota)
  useEffect(() => {
    if (!currentUser) return;
    void fetchChatData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchChatData(true);
      }
    }, 60000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchChatData(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [currentUser, fetchChatData]);

  // Scroll to bottom when message arrives
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleRefresh = async () => {
    triggerHaptic(10);
    await fetchChatData(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !currentUser || sending) return;

    setSending(true);
    triggerHaptic(15);

    const isDirect = Boolean(activeRecipient);
    const conversationId = isDirect && activeRecipient
      ? [currentUser.uid, activeRecipient.uid].sort().join("_")
      : undefined;

    // Optimistic message addition for instant UI appearance (0ms delay)
    const optimisticMsg: TeamMessage = {
      id: `temp-${Date.now()}`,
      sender_uid: currentUser.uid,
      sender_name: userProfile?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Saya",
      sender_role: userProfile?.role || "staff",
      sender_photo: userProfile?.photo_url || "",
      message: text,
      created_at: new Date(),
      recipient_uid: activeRecipient?.uid,
      recipient_name: activeRecipient?.name,
      recipient_role: activeRecipient?.role,
      conversation_id: conversationId,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    const messageData: Record<string, any> = {
      sender_uid: currentUser.uid,
      sender_name: userProfile?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Saya",
      sender_role: userProfile?.role || "staff",
      sender_photo: userProfile?.photo_url || "",
      message: text,
      created_at: serverTimestamp(),
    };

    if (isDirect && activeRecipient) {
      messageData.recipient_uid = activeRecipient.uid;
      messageData.recipient_name = activeRecipient.name;
      messageData.recipient_role = activeRecipient.role;
      messageData.conversation_id = conversationId;
    }

    try {
      // 1. Try writing directly to Firestore client
      let clientDocId: string | null = null;
      try {
        const docRef = await addDoc(collection(db, "team_messages"), messageData);
        clientDocId = docRef.id;
      } catch (clientWriteErr) {
        console.warn("Direct Firestore write notice (falling back to Serverless API):", clientWriteErr);
      }

      // 2. Dispatch push notification or perform fallback write via API
      let apiSucceeded = false;
      try {
        const token = await currentUser.getIdToken();
        const payload = JSON.stringify({
          message: text,
          notifyOnly: Boolean(clientDocId),
          existingMessageId: clientDocId,
          recipientUid: activeRecipient?.uid,
          recipientName: activeRecipient?.name,
          conversationId,
        });

        let apiRes: Response | null = await fetch("/api/team-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: payload,
        }).catch(() => null);

        if (!apiRes || !apiRes.ok) {
          apiRes = await fetch("https://tanabrew-stok-and-invoice.vercel.app/api/team-chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: payload,
          }).catch(() => null);
        }

        if (apiRes && apiRes.ok) {
          apiSucceeded = true;
          void fetchChatData(true);
        } else if (!clientDocId) {
          const errJson = apiRes ? await apiRes.json().catch(() => ({})) : {};
          throw new Error(errJson.error || "Gagal menyimpan pesan ke server.");
        }
      } catch (apiErr: any) {
        if (!clientDocId && !apiSucceeded) {
          throw apiErr;
        }
        console.warn("Push notification dispatch warning:", apiErr);
      }

      triggerHaptic(20);
    } catch (err: any) {
      const rawMsg = String(err?.message || "");
      const isQuotaError = rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("Quota");
      toast({
        title: isQuotaError ? "Batas Kuota Firebase Tercapai" : "Gagal Mengirim Pesan",
        description: isQuotaError
          ? "Batas kuota harian Firebase (Free Tier) sedang penuh. Hubungi Owner/Webdev untuk upgrade ke paket Blaze (pay-as-you-go) atau tunggu reset harian."
          : (err.message || "Periksa koneksi internet Anda."),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const displayedMessages = useMemo(() => {
    if (!activeRecipient) {
      // Mode grup: tampilkan pesan publik (tanpa recipient_uid)
      return messages.filter((m) => !m.recipient_uid);
    }
    // Mode pesan pribadi (DM): tampilkan pesan antara currentUser dan activeRecipient
    return messages.filter((m) => {
      if (m.conversation_id) {
        const targetConvId = [currentUser?.uid, activeRecipient.uid].sort().join("_");
        return m.conversation_id === targetConvId;
      }
      return (
        (m.sender_uid === currentUser?.uid && m.recipient_uid === activeRecipient.uid) ||
        (m.sender_uid === activeRecipient.uid && m.recipient_uid === currentUser?.uid)
      );
    });
  }, [activeRecipient, currentUser?.uid, messages]);

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
      case "webdev":
        return { label: "Dev", class: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20" };
      case "admin":
        return { label: "Admin", class: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" };
      default:
        return { label: "Staff", class: "bg-muted text-muted-foreground border-border" };
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
    if (!timestamp) return "Offline";
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
      if (diffMinutes < 5) return "Aktif sekarang";
      if (diffMinutes < 60) return `${diffMinutes}m lalu`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}j lalu`;
      return `${Math.floor(diffHours / 24)}h lalu`;
    } catch {
      return "Offline";
    }
  };

  const onlineCount = teamMembers.filter((m) => m.is_online).length;

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-6xl h-[calc(100dvh-4.25rem)] lg:h-[calc(100vh-2rem)] flex flex-col overflow-hidden px-3 sm:px-6 lg:px-8 pt-2.5 pb-[4.25rem] lg:pb-2.5">
      {/* 1. HEADER & STATUS TIM */}
      <div className="shrink-0 rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2.5 mb-2 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold border border-primary/20 shrink-0">
              <MessageSquare size={18} />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-foreground">Obrolan Tim Tanabrew</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {onlineCount} Online
                </span>
                <span>•</span>
                <span>{teamMembers.length} Anggota</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Perbarui Anggota Tim"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-primary" : ""} />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setShowAllMembersModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/60 px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Users size={12} />
              <span>Daftar Tim</span>
            </button>
          </div>
        </div>

        {/* TAB SWITCHER: GRUP TIM VS PESAN PRIBADI */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60 gap-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setChatTab("team");
              setActiveRecipient(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              chatTab === "team" && !activeRecipient
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users size={14} />
            <span>Grup Tim</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setChatTab("direct");
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              chatTab === "direct" || activeRecipient
                ? "bg-card text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare size={14} />
            <span>Pesan Pribadi</span>
            {onlineCount > 0 && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* 2. ANGGOTA TIM CAROUSEL (DITAMPILKAN DI MODE GRUP UNTUK QUICK TAP KE DM) */}
        {chatTab === "team" && (
          <div className="pt-1.5 border-t border-border/50">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {/* Grup Tim Utama Tile */}
              <div
                onClick={() => {
                  triggerHaptic(10);
                  setActiveRecipient(null);
                }}
                className="flex flex-col items-center gap-0.5 shrink-0 w-13 text-center cursor-pointer group"
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shadow-xs transition-transform group-active:scale-95 ${
                    !activeRecipient
                      ? "ring-2 ring-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "ring-1 ring-border bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Users size={17} />
                </div>
                <span className="text-[9px] font-bold text-foreground truncate w-full leading-tight mt-0.5">
                  Grup Tim
                </span>
                <span className="text-[7px] font-bold px-1 py-0.1 rounded-full border uppercase bg-muted text-muted-foreground border-border">
                  Umum
                </span>
              </div>

              {teamMembers.map((member) => {
                const isMe = member.uid === currentUser?.uid;
                const roleBadge = getRoleBadge(member.role);
                const isOnline = Boolean(member.is_online || isMe);
                const isSelected = activeRecipient?.uid === member.uid;

                return (
                  <div
                    key={member.uid}
                    onClick={() => {
                      triggerHaptic(10);
                      if (isMe) {
                        setActiveRecipient(null);
                        setChatTab("team");
                      } else {
                        setActiveRecipient(member);
                        setChatTab("direct");
                      }
                    }}
                    className="flex flex-col items-center gap-0.5 shrink-0 w-13 text-center cursor-pointer group"
                  >
                    <div className="relative">
                      <div
                        className={`h-10 w-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-xs transition-transform group-active:scale-95 ${
                          isSelected
                            ? "ring-2 ring-primary bg-primary/10 text-primary shadow-md shadow-primary/25 scale-105"
                            : isOnline
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
                      <span
                        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
                          isOnline ? "bg-emerald-500 ring-1 ring-emerald-500/30 animate-pulse" : "bg-muted-foreground/40"
                        }`}
                        title={isOnline ? "Online" : "Offline"}
                      />
                    </div>

                    <span className={`text-[9px] truncate w-full leading-tight mt-0.5 ${
                      isSelected ? "font-black text-primary" : "font-bold text-foreground"
                    }`}>
                      {isMe ? "Saya" : member.name.split(" ")[0]}
                    </span>
                    <span className={`text-[7px] font-bold px-1 py-0.1 rounded-full border uppercase ${roleBadge.class}`}>
                      {roleBadge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RECIPIENT MODE BANNER (IF DIRECT CONVERSATION ACTIVE) */}
      {activeRecipient && (
        <div className="shrink-0 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 mb-2 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <p className="truncate text-foreground font-semibold text-[11px] sm:text-xs">
              Koordinasi Pribadi: <span className="font-bold text-primary">{activeRecipient.name}</span>{" "}
              <span className="text-[10px] text-muted-foreground">({getRoleBadge(activeRecipient.role).label})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setActiveRecipient(null);
            }}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
          >
            ← Kembali ke Kontak
          </button>
        </div>
      )}

      {/* 3. GROUP / DIRECT CHAT FEED CONTAINER OR CONTACT DIRECTORY */}
      <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex flex-col overflow-hidden shadow-sm">
        {chatTab === "direct" && !activeRecipient ? (
          /* DAFTAR KONTAK PESAN PRIBADI */
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/60">
              <div>
                <h3 className="text-xs font-bold text-foreground">Daftar Rekan Tim Tanabrew</h3>
                <p className="text-[11px] text-muted-foreground">Pilih rekan untuk koordinasi langsung (1-on-1)</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {teamMembers.filter((m) => m.uid !== currentUser?.uid).length} Kontak
              </span>
            </div>

            <div className="space-y-2">
              {teamMembers
                .filter((m) => m.uid !== currentUser?.uid)
                .map((member) => {
                  const roleBadge = getRoleBadge(member.role);
                  const isOnline = Boolean(member.is_online);
                  const dmCount = messages.filter(
                    (m) =>
                      (m.sender_uid === member.uid && m.recipient_uid === currentUser?.uid) ||
                      (m.sender_uid === currentUser?.uid && m.recipient_uid === member.uid)
                  ).length;

                  return (
                    <div
                      key={member.uid}
                      onClick={() => {
                        triggerHaptic(10);
                        setActiveRecipient(member);
                      }}
                      className="rounded-2xl border border-border bg-card p-3 flex items-center justify-between gap-3 shadow-xs hover:border-primary/40 hover:bg-muted/30 active:scale-[0.99] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="h-11 w-11 rounded-full overflow-hidden bg-primary/10 text-primary font-bold text-sm border border-primary/20 flex items-center justify-center">
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
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
                              isOnline ? "bg-emerald-500 ring-1 ring-emerald-500/30 animate-pulse" : "bg-muted-foreground/40"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {member.name}
                            </h4>
                            <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold border uppercase ${roleBadge.class}`}>
                              {roleBadge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className={isOnline ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}>
                              {isOnline ? "Online sekarang" : formatLastActive(member.last_active_at)}
                            </span>
                            {dmCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{dmCount} pesan</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-xl bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary px-3 py-1.5 text-xs font-bold transition-all shrink-0"
                      >
                        <MessageSquare size={13} />
                        <span>Chat</span>
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <>
            {/* Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 p-3.5 sm:p-4 scroll-smooth">
          {displayedMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/80 p-8 text-center space-y-2 my-auto shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {activeRecipient ? <MessageSquare size={22} /> : <Sparkles size={22} />}
              </div>
              <h3 className="text-sm font-bold text-foreground">
                {activeRecipient
                  ? `Koordinasi dengan ${activeRecipient.name}`
                  : "Ruang Koordinasi Tim Tanabrew"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {activeRecipient
                  ? `Belum ada pesan obrolan langsung dengan ${activeRecipient.name.split(" ")[0]}. Tulis pesan di bawah untuk memulai koordinasi.`
                  : "Ketik pesan di bawah untuk memulai koordinasi antar staf, barista, admin, dan owner."}
              </p>
            </div>
          ) : (
            displayedMessages.map((msg, index) => {
              const isMe =
                msg.sender_uid === currentUser?.uid ||
                (msg.sender_name && userProfile?.name && msg.sender_name === userProfile.name);
              const roleBadge = getRoleBadge(msg.sender_role);

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 overflow-hidden flex items-center justify-center font-bold text-[10px] text-primary shrink-0 mb-1">
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

                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                    {!isMe && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                        <span className="font-bold text-foreground truncate max-w-[140px]">{msg.sender_name}</span>
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

        {/* 4. PINNED BOTTOM INPUT BOX (Docks flush to the bottom) */}
        <div className="shrink-0 border-t border-border bg-card p-2 sm:p-2.5">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeRecipient
                  ? `Pesan pribadi untuk ${activeRecipient.name.split(" ")[0]}...`
                  : "Tulis pesan untuk tim..."
              }
              disabled={sending}
              style={{ fontSize: "16px" }}
              className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-xs"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              title="Kirim Pesan"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </>
    )}
  </div>

      {/* 5. MODAL DAFTAR LENGKAP ANGGOTA TIM */}
      {showAllMembersModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
          onClick={() => setShowAllMembersModal(false)}
        >
          <div
            className="bg-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 border border-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-foreground"
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
                  <h3 className="text-sm font-bold text-foreground">Anggota Tim Tanabrew</h3>
                  <p className="text-[11px] text-muted-foreground">Pilih anggota untuk koordinasi langsung</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllMembersModal(false)}
                className="p-1 rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Opsi Kembali ke Grup */}
            <div
              onClick={() => {
                triggerHaptic(10);
                setActiveRecipient(null);
                setShowAllMembersModal(false);
              }}
              className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Semua Tim (Grup Koordinasi)</p>
                  <p className="text-[10px] text-muted-foreground">Obrolan terbuka untuk semua staf</p>
                </div>
              </div>
              {!activeRecipient && (
                <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">Aktif</span>
              )}
            </div>

            <div className="divide-y divide-border/60">
              {teamMembers.map((member) => {
                const isMe = member.uid === currentUser?.uid;
                const roleBadge = getRoleBadge(member.role);
                const isOnline = Boolean(member.is_online || isMe);
                const isSelected = activeRecipient?.uid === member.uid;

                return (
                  <div
                    key={member.uid}
                    onClick={() => {
                      triggerHaptic(10);
                      if (isMe) {
                        setActiveRecipient(null);
                      } else {
                        setActiveRecipient(member);
                      }
                      setShowAllMembersModal(false);
                    }}
                    className={`flex items-center justify-between py-2.5 px-1 rounded-lg transition-colors cursor-pointer ${
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`h-10 w-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs ${
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
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${
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
                        <p className="text-[10px] text-muted-foreground truncate">{member.email || "Anggota Tanabrew"}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-bold ${
                          isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        }`}
                      >
                        {isOnline ? "Online" : formatLastActive(member.last_active_at)}
                      </span>
                      {!isMe && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          {isSelected ? "Aktif" : "Chat"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAllMembersModal(false)}
              className="w-full rounded-xl bg-muted py-2.5 text-xs font-bold text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
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
