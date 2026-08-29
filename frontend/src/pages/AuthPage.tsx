import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Signature mark: three overlapping bounded regions, each labeled
            with a workspace-scope-like fragment — a quiet visual echo of
            the isolation guarantee the product is actually built around,
            rather than a generic logo mark. */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <svg width="64" height="40" viewBox="0 0 64 40" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="26" height="26" rx="3" stroke="#3d463e" strokeWidth="1.5" />
            <rect x="19" y="13" width="26" height="26" rx="3" stroke="#3d463e" strokeWidth="1.5" />
            <rect x="37" y="1" width="26" height="26" rx="3" stroke="#6fa88a" strokeWidth="1.5" />
          </svg>
          <div className="text-center">
            <h1 className="font-display text-xl tracking-tight text-ink-100">STRATUM</h1>
            <p className="mt-1 text-sm text-ink-500">Isolated by construction, not convention.</p>
          </div>
        </div>

        <div className="bg-base-850 border border-base-700 rounded-lg p-6">
          <div className="flex gap-1 mb-6 bg-base-900 rounded-md p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                mode === "login" ? "bg-base-700 text-ink-100" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                mode === "register" ? "bg-base-700 text-ink-100" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-500 uppercase tracking-wide">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-base-900 border border-base-600 rounded-md px-3 py-2 text-sm text-ink-100 outline-none focus:border-verified-500 transition-colors"
                placeholder="you@company.com"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-500 uppercase tracking-wide">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-base-900 border border-base-600 rounded-md px-3 py-2 text-sm text-ink-100 outline-none focus:border-verified-500 transition-colors"
                placeholder="At least 8 characters"
              />
            </label>

            {error && (
              <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 bg-verified-500 hover:bg-verified-400 disabled:opacity-50 text-base-950 text-sm font-medium rounded-md py-2 transition-colors"
            >
              {isSubmitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
