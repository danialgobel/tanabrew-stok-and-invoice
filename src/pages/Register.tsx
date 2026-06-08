import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password, accessCode);
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal daftar akun";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img
            src="https://i.ibb.co.com/6CgfRK5/TM-LOGO-PUTIH.png"
            alt="Tanabrew Logo"
            className="w-20 h-20 rounded-full object-cover border-2 border-primary bg-primary"
          />
          <h1 className="text-xl font-bold text-primary mt-3">Tanabrew</h1>
          <p className="text-sm text-muted-foreground">Daftar akun baru</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-4 space-y-3">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nama</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kode Akses</label>
            <input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
