import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "tanabrew_last_read_chat_time";

export const useUnreadChat = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const markChatAsRead = useCallback(() => {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, String(now));
      setHasUnreadChat(false);
      window.dispatchEvent(new CustomEvent("tanabrew:chat_read", { detail: now }));
    } catch {}
  }, []);

  const checkUnreadStatus = useCallback(async () => {
    if (!currentUser) return;
    if (location.pathname === "/obrolan") {
      markChatAsRead();
      return;
    }

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
        // Find latest message not sent by current user
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

          if (msgTime > lastReadTime) {
            setHasUnreadChat(true);
          } else {
            setHasUnreadChat(false);
          }
        }
      }
    } catch {
      // Silently ignore network hiccup during background unread check
    }
  }, [currentUser, location.pathname, markChatAsRead]);

  // If user opens /obrolan, mark read instantly
  useEffect(() => {
    if (location.pathname === "/obrolan") {
      markChatAsRead();
    }
  }, [location.pathname, markChatAsRead]);

  // Periodic unread check (initial + every 12s)
  useEffect(() => {
    if (!currentUser) return;
    void checkUnreadStatus();

    const interval = setInterval(() => {
      void checkUnreadStatus();
    }, 12000);

    const handleChatReadEvent = () => {
      setHasUnreadChat(false);
    };

    window.addEventListener("tanabrew:chat_read", handleChatReadEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener("tanabrew:chat_read", handleChatReadEvent);
    };
  }, [currentUser, checkUnreadStatus]);

  return { hasUnreadChat, markChatAsRead };
};
