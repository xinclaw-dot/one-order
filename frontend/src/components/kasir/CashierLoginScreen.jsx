import { useState } from "react";
import { UserRound, KeyRound, ArrowRight } from "lucide-react";

export default function CashierLoginScreen({ onLogin, loading, error }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    onLogin(username.trim(), password);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-5 py-10 text-ink">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-chili/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-guava/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 ring-1 ring-ink/10 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-chili to-guava p-1.5 text-white shadow-md shadow-chili/20">
            <img src="/logo.png" alt="Order One" className="h-full w-full rounded-xl bg-black object-contain p-1" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[16px] font-extrabold leading-tight text-ink">Order One</p>
            <p className="text-[11px] font-semibold text-chili-dark">Dashboard Kasir</p>
          </div>
        </div>

        <h1 className="font-display text-[22px] font-extrabold leading-[1.2] text-ink">
          Login kasir,<br />
          <span className="bg-gradient-to-r from-chili to-guava bg-clip-text text-transparent">bukan token bersama.</span>
        </h1>

        <form onSubmit={submit} className="mt-6">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Username</label>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-ink/5 px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <UserRound size={16} className="text-ink-soft" />
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="username kasir"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
            />
          </div>

          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Password</label>
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-ink/5 px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <KeyRound size={16} className="text-ink-soft" />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[15px] font-extrabold text-white shadow-lg shadow-chili/20 transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk Dashboard Kasir"}
            {!loading && <ArrowRight size={17} strokeWidth={2.5} />}
          </button>
          {error && <p className="mt-3 text-center text-[13px] font-medium text-chili-dark">{error}</p>}
        </form>
      </div>
    </div>
  );
}
