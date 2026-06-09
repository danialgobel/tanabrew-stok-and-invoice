import type { User } from "firebase/auth";

type OneSignalPermissionState = "unsupported" | "default" | "granted" | "denied" | "missing_app_id";

type OneSignalSDK = {
  init: (options: {
    appId: string;
    serviceWorkerPath?: string;
    serviceWorkerParam?: { scope: string };
    welcomeNotification?: { disable: boolean };
    notifyButton?: { enable: boolean };
    allowLocalhostAsSecureOrigin?: boolean;
  }) => Promise<void>;
  login?: (externalId: string) => Promise<void>;
  logout?: () => Promise<void>;
  User?: {
    addTags?: (tags: Record<string, string>) => Promise<void> | void;
    getTags?: () => Promise<Record<string, string>> | Record<string, string>;
    PushSubscription?: {
      optIn?: () => Promise<void>;
    };
  };
  Notifications?: {
    isPushSupported?: () => boolean;
    requestPermission?: () => Promise<boolean | void>;
    permission?: boolean;
  };
};

type OneSignalDeferredCallback = (OneSignal: OneSignalSDK) => void | Promise<void>;
type OneSignalUserTagInput = {
  uid: string;
  role?: string | null;
  name?: string | null;
  email?: string | null;
};

declare global {
  interface Window {
    OneSignalDeferred?: OneSignalDeferredCallback[];
  }
}

export type { OneSignalPermissionState };

const ONESIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
const FALLBACK_ONESIGNAL_APP_ID = "49921bb8-d718-4d8b-8bd5-4f2f00378661";

let initPromise: Promise<void> | null = null;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const getOneSignalAppId = () => {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID || FALLBACK_ONESIGNAL_APP_ID;
  return String(appId || "").trim();
};

const supportsWebPush = () => {
  if (!isBrowser()) return false;

  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
};

const toTagValue = (value: string | null | undefined) => String(value || "").trim();

const normalizeRoleTag = (role: string | null | undefined) => {
  const value = toTagValue(role).toLowerCase();
  if (value === "admin" || value === "staff") return value;
  throw new Error("Role notifikasi belum valid.");
};

const buildOneSignalTags = (profile: OneSignalUserTagInput) => {
  const uid = toTagValue(profile.uid);

  if (!uid) {
    throw new Error("UID notifikasi belum valid.");
  }

  return {
    uid,
    role: normalizeRoleTag(profile.role),
    name: toTagValue(profile.name),
    email: toTagValue(profile.email),
  };
};

const ensureOneSignalScript = () =>
  new Promise<void>((resolve, reject) => {
    if (!isBrowser()) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${ONESIGNAL_SDK_URL}"]`);

    if (existingScript?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existingScript || document.createElement("script");

    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };

    const handleError = () => reject(new Error("Gagal memuat OneSignal SDK."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.id = "onesignal-sdk";
      script.src = ONESIGNAL_SDK_URL;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

const withOneSignal = <T>(callback: (OneSignal: OneSignalSDK) => T | Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("OneSignal hanya tersedia di browser."));
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    void ensureOneSignalScript().catch(reject);

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await callback(OneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });

export const getNotificationPermissionState = (): OneSignalPermissionState => {
  if (!supportsWebPush()) return "unsupported";
  if (!getOneSignalAppId()) return "missing_app_id";

  return Notification.permission as OneSignalPermissionState;
};

export const initOneSignal = async () => {
  if (!supportsWebPush()) return;

  const appId = getOneSignalAppId();
  if (!appId) return;

  if (!initPromise) {
    initPromise = withOneSignal(async (OneSignal) => {
      await OneSignal.init({
        appId,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
        allowLocalhostAsSecureOrigin: true,
      });
    }).catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
};

export const loginOneSignalUser = async (uid: string) => {
  if (!uid) return;
  if (!supportsWebPush() || !getOneSignalAppId()) return;

  await initOneSignal();
  await withOneSignal(async (OneSignal) => {
    await OneSignal.login?.(uid);
  });
};

export const syncOneSignalUserTagsSdk = async (profile: OneSignalUserTagInput) => {
  const tags = buildOneSignalTags(profile);
  if (!supportsWebPush() || !getOneSignalAppId()) return;

  await initOneSignal();
  return withOneSignal(async (OneSignal) => {
    if (!OneSignal.login) {
      throw new Error("OneSignal login tidak tersedia.");
    }

    await OneSignal.login(tags.uid);

    if (Notification.permission === "granted") {
      await OneSignal.User?.PushSubscription?.optIn?.();
    }

    if (!OneSignal.User?.addTags) {
      throw new Error("OneSignal addTags tidak tersedia.");
    }

    await OneSignal.User.addTags(tags);

    let syncedTags: Record<string, string> | undefined;
    try {
      syncedTags = await OneSignal.User.getTags?.();
    } catch (error) {
      console.warn("[Tanabrew OneSignal] getTags gagal", error);
    }

    console.info("[Tanabrew OneSignal] user tags synced", {
      role: tags.role,
      hasUid: Boolean(tags.uid),
      hasEmail: Boolean(tags.email),
      roleVerified: syncedTags ? syncedTags.role === tags.role : undefined,
    });

    return syncedTags || tags;
  });
};

export const syncOneSignalUserTagsServer = async (
  profile: OneSignalUserTagInput,
  currentUser: User | null | undefined,
) => {
  const tags = buildOneSignalTags(profile);

  if (!currentUser) {
    throw new Error("User belum login.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/sync-onesignal-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tags),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success !== true) {
    const statusInfo = `HTTP ${response.status}${result.oneSignalStatus ? `, OneSignal ${result.oneSignalStatus}` : ""}`;
    const message = result.message || result.error || "Gagal menyinkronkan tag notifikasi.";
    const details = result.details ? ` Detail: ${result.details}` : "";
    console.warn("[Tanabrew OneSignal Sync] server sync failed", {
      status: response.status,
      oneSignalStatus: result.oneSignalStatus,
      error: result.error,
      details: result.details,
    });
    throw new Error(`${statusInfo}. ${message}${details}`.slice(0, 260));
  }

  return result as { success: true; message: string; oneSignalStatus?: number };
};

export const syncOneSignalUserTags = async (
  profile: OneSignalUserTagInput,
  currentUser?: User | null,
) => {
  let sdkError: unknown;

  try {
    await syncOneSignalUserTagsSdk(profile);
  } catch (error) {
    sdkError = error;
    console.warn("[Tanabrew OneSignal] SDK tag sync failed", error);
  }

  if (currentUser) {
    return syncOneSignalUserTagsServer(profile, currentUser);
  }

  if (sdkError) throw sdkError;
  return { success: true, message: "Tag OneSignal berhasil disinkronkan dari SDK." };
};

export const tagOneSignalUser = syncOneSignalUserTagsSdk;

export const requestNotificationPermission = async (): Promise<OneSignalPermissionState> => {
  const currentState = getNotificationPermissionState();
  if (currentState === "unsupported" || currentState === "missing_app_id" || currentState === "denied") {
    return currentState;
  }

  await initOneSignal();
  await withOneSignal(async (OneSignal) => {
    if (OneSignal.Notifications?.isPushSupported && !OneSignal.Notifications.isPushSupported()) return;

    await OneSignal.Notifications?.requestPermission?.();

    if (Notification.permission === "granted") {
      await OneSignal.User?.PushSubscription?.optIn?.();
    }
  });

  return getNotificationPermissionState();
};

export const logoutOneSignalUser = async () => {
  if (!supportsWebPush() || !getOneSignalAppId()) return;

  await initOneSignal();
  await withOneSignal(async (OneSignal) => {
    await OneSignal.logout?.();
  });
};
