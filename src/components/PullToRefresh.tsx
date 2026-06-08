import { useEffect, useRef, useState } from "react";

type PullState = "idle" | "pulling" | "ready" | "refreshing";

interface PullToRefreshProps {
  disabled?: boolean;
  onRefresh: () => void | Promise<void>;
}

const isFormControlActive = () => {
  const active = document.activeElement;
  if (!active) return false;

  return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) || active.getAttribute("contenteditable") === "true";
};

const PullToRefresh = ({ disabled = false, onRefresh }: PullToRefreshProps) => {
  const startY = useRef<number | null>(null);
  const pullDistance = useRef(0);
  const [state, setState] = useState<PullState>("idle");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const threshold = 74;
    const maxOffset = 96;

    const reset = () => {
      startY.current = null;
      pullDistance.current = 0;
      setOffset(0);
      setState("idle");
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (disabled || window.scrollY > 0 || event.touches.length !== 1 || isFormControlActive()) return;

      startY.current = event.touches[0].clientY;
      pullDistance.current = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startY.current === null || disabled || window.scrollY > 0) return;

      const distance = Math.max(0, event.touches[0].clientY - startY.current);
      if (distance < 10) return;

      event.preventDefault();
      const dampedDistance = Math.min(maxOffset, distance * 0.48);
      pullDistance.current = dampedDistance;
      setOffset(dampedDistance);
      setState(dampedDistance >= threshold ? "ready" : "pulling");
    };

    const handleTouchEnd = () => {
      if (startY.current === null) return;

      const shouldRefresh = pullDistance.current >= threshold && !disabled;
      startY.current = null;
      pullDistance.current = 0;

      if (!shouldRefresh) {
        reset();
        return;
      }

      setOffset(54);
      setState("refreshing");
      Promise.resolve().then(onRefresh).finally(() => {
        window.setTimeout(reset, 420);
      });
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", reset);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [disabled, onRefresh]);

  if (state === "idle") return null;

  const label = state === "refreshing"
    ? "Memuat ulang data..."
    : state === "ready"
      ? "Lepas untuk refresh"
      : "Tarik untuk memuat ulang";

  return (
    <div
      className={`tanabrew-pull-refresh ${state === "refreshing" ? "tanabrew-pull-refresh-active" : ""}`}
      style={{ transform: `translate(-50%, ${offset}px)` }}
      aria-live="polite"
    >
      <span className="tanabrew-pull-refresh-dot" />
      <span>{label}</span>
    </div>
  );
};

export default PullToRefresh;
