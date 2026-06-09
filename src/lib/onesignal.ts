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
    addTags?: (tags: Record<string, string>) => void;
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

export const tagOneSignalUser = async (profile: { uid: string; name?: string; email?: string | null; role?: string }) => {
  if (!profile.uid) return;
  if (!supportsWebPush() || !getOneSignalAppId()) return;

  await initOneSignal();
  await withOneSignal((OneSignal) => {
    const tags: Record<string, string> = {
      uid: profile.uid,
      role: profile.role || "unknown",
      name: profile.name || "-",
    };

    if (profile.email) tags.email = profile.email;

    if (!OneSignal.User?.addTags) {
      console.warn("[Tanabrew OneSignal] addTags tidak tersedia");
      return;
    }

    OneSignal.User.addTags(tags);
    console.info("[Tanabrew OneSignal] user tags set", {
      role: tags.role,
      hasUid: Boolean(tags.uid),
      hasName: Boolean(profile.name),
      hasEmail: Boolean(profile.email),
    });
  });
};

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
