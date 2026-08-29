export const triggerHaptic = (duration = 15) => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore devices that don't support or block vibration
    }
  }
};
