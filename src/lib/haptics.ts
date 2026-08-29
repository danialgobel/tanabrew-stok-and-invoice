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
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore unsupported devices
    }
  }
};
