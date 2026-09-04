import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "tanabrew_last_read_chat_time";

// Shared module-level state: Mencegah request ganda dari BottomNav dan DesktopSidebar
let globalHasUnread = false;
let globalLastCheckTime = 0;
const subscribers = new Set<(hasUnread: boolean) => void>();

const notifySubscribers = (hasUnread: boolean) => {
  globalHasUnread = hasUnread;
  subscribers.forEach((cb) => cb(hasUnread));
};

export const useUnreadChat = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [hasUnreadChat, setHasUnreadChat] = useState(globalHasUnread);

  useEffect(() => {
    subscribers.add(setHasUnreadChat);
    return () => {
      subscribers.delete(setHasUnreadChat);
    };
  }, []);

  const markChatAsRead = useCallback(() => {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, String(now));
      notifySubscribers(false);
      window.dispatchEvent(new CustomEvent("tanabrew:chat_read", { detail: now }));
    } catch {}
  }, []);

  const checkUnreadStatus = useCallback(async () => {
    if (!currentUser) return;
    if (location.pathname === "/obrolan") {
      markChatAsRead();
      return;
    }

    // Hindari request duplikat jika baru saja di-check dalam 30 detik terakhir
    const now = Date.now();
    if (now - globalLastCheckTime < 30000) {
      return;
    }
    globalLastCheckTime = now;

    try {
      const storedTimeStr = localStorage.getItem(STORAGE_KEY);
      const lastReadTime = storedTimeStr ? Number(storedTimeStr) : 0;

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/team-chat", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        // Cari pesan terbaru yang bukan dari user saat ini
        const otherMessages = data.messages.filter((m: any) => m.sender_uid !== currentUser.uid);
        if (otherMessages.length > 0) {
          const latestMsg = otherMessages[otherMessages.length - 1];
          let msgTime = 0;
          if (latestMsg.created_at) {
            if (latestMsg.created_at._seconds) {
              msgTime = latestMsg.created_at._seconds * 1000;
            } else if (latestMsg.created_at.toDate) {
              msgTime = latestMsg.created_at.toDate().getTime();
            } else {
              msgTime = new Date(latestMsg.created_at).getTime();
            }
          }

          notifySubscribers(msgTime > lastReadTime);
        }
      }
    } catch {
      // Silently ignore network hiccup during background unread check
    }
  }, [currentUser, location.pathname, markChatAsRead]);

  // Tandai terbaca saat membuka halaman /obrolan
  useEffect(() => {
    if (location.pathname === "/obrolan") {
      markChatAsRead();
    }
  }, [location.pathname, markChatAsRead]);

  // Visibility-Aware Polling (60s interval dan hanya saat tab aktif):
  // Menghemat hingga 90% panggilan API dan pembacaan Firestore
  useEffect(() => {
    if (!currentUser) return;
    void checkUnreadStatus();

    const interval = setInterval(() => {
      // Jangan poll jika tab diminimize / background
      if (document.visibilityState === "visible") {
        void checkUnreadStatus();
      }
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkUnreadStatus();
      }
    };

    const handleChatReadEvent = () => {
      notifySubscribers(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("tanabrew:chat_read", handleChatReadEvent);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("tanabrew:chat_read", handleChatReadEvent);
    };
  }, [currentUser, checkUnreadStatus]);

  return { hasUnreadChat, markChatAsRead };
};
