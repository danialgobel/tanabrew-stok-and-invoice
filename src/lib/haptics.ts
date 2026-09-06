import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const isHapticEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("tanabrew_haptic_enabled") !== "false";
};

export const setHapticEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("tanabrew_haptic_enabled", enabled ? "true" : "false");
};

export const triggerHaptic = (duration = 15) => {
  if (typeof window !== "undefined" && localStorage.getItem("tanabrew_haptic_enabled") === "false") {
    return;
  }

  // 1. Taptic Engine Fisik Apple (iPhone Native) & Haptics Native
  if (Capacitor.isNativePlatform()) {
    try {
      void Haptics.impact({ style: ImpactStyle.Light });
      return;
    } catch {
      // Fallback if plugin throws
    }
  }

  // 2. Web API / Android WebView Navigator Vibrate Fallback
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore unsupported devices
    }
  }
};

export const triggerSuccessHaptic = () => {
  if (typeof window !== "undefined" && localStorage.getItem("tanabrew_haptic_enabled") === "false") {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      void Haptics.notification({ type: NotificationType.Success });
      return;
    } catch {}
  }

  triggerHaptic(30);
};
