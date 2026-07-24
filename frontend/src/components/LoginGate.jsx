import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";

export default function LoginGate({ title, icon: Icon = Lock, onSubmit }) {
  const [tokenInput, setTokenInput] = useState("");

  function submit(e) {
    e.preventDefault();
    if (tokenInput.trim()) onSubmit(tokenInput.trim());
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 text-ink">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-chili/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-guava/15 blur-3xl" />

      <form onSubmit={submit} className="relative z-10 w-full max-w-xs rounded-3xl bg-white p-6 text-center ring-1 ring-ink/10 shadow-sm">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-chili to-guava text-white">
          <Icon size={22} />
        </span>
        <h1 className="font-display text-lg font-extrabold text-ink">{title}</h1>
        <p className="mt-1 text-[12px] text-ink-soft">Masukkan token akses untuk masuk</p>

        <input
          type="password"
          placeholder="Token akses"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          className="mt-4 w-full rounded-xl bg-ink/5 px-3.5 py-3 text-center text-[15px] text-ink ring-1 ring-ink/10 placeholder:text-ink-soft/70 focus:outline-none focus:ring-chili"
        />
        <button
          type="submit"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98]"
        >
          Masuk <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
