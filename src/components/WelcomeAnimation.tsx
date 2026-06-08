import { useEffect, useState } from "react";

interface WelcomeAnimationProps {
  name: string;
  role?: string;
  onFinish: () => void;
}

const formatRole = (role?: string) => {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "User";
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

  return (
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
};

export default WelcomeAnimation;
