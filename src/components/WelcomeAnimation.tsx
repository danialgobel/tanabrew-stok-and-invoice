import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface WelcomeAnimationProps {
  name: string;
  role?: string;
  onFinish: () => void;
}

const formatRole = (role?: string) => {
  if (!role) return "Pengguna";
  const r = role.toLowerCase().trim();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (r === "webdev" || r === "godmode") return "Developer";
  if (r === "staff") return "Staff";
  return role.charAt(0).toUpperCase() + role.slice(1);
};

const WelcomeAnimation = ({ name, role, onFinish }: WelcomeAnimationProps) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setExiting(true), 2300);
    const finishTimer = window.setTimeout(onFinish, 2850);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const overlay = (
    <div
      className={`tanabrew-welcome-overlay ${exiting ? "tanabrew-welcome-overlay-exit" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="tanabrew-welcome-panel">
        <div className="tanabrew-welcome-mark">
          <img
            src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
            alt="Tanabrew Logo"
            className="tanabrew-welcome-logo"
          />
        </div>
        <div>
          <p className="tanabrew-welcome-title">Selamat datang, {name}</p>
          <p className="tanabrew-welcome-subtitle">Anda login sebagai {formatRole(role)}</p>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;

  return createPortal(overlay, document.body);
};

export default WelcomeAnimation;
