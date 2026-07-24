import { useEffect, useState } from "react";
import { Phone, User, ArrowRight, ArrowLeft } from "lucide-react";
import BottomSheet from "../BottomSheet";

// Setiap warung punya data pelanggan sendiri-sendiri (lihat multi-tenant), jadi
// login dilakukan per warung, tepat saat checkout — bukan di depan sebelum
// menjelajah menu gabungan semua warung.
export default function CheckoutLoginSheet({ open, tenantName, onLogin, loading, error, needsName, onBackToPhone, onClose }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const step = needsName ? "name" : "phone";

  useEffect(() => {
    if (!open) {
      setPhone("");
      setName("");
    }
  }, [open]);

  function submitPhone(e) {
    e.preventDefault();
    onLogin(phone.trim());
  }

  function submitName(e) {
    e.preventDefault();
    onLogin(phone.trim(), name.trim());
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className="font-display text-lg font-extrabold">Masuk untuk pesan di {tenantName}</h3>
      <p className="mt-1 text-[12px] text-ink-soft">
        Tiap warung punya data pelanggan sendiri, jadi kamu perlu masuk sekali per warung pakai nomor HP kamu.
      </p>

      {step === "phone" ? (
        <form onSubmit={submitPhone} className="mt-4">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Nomor HP</label>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-cream px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <Phone size={16} className="text-ink-soft" />
            <input
              type="tel"
              required
              autoFocus
              placeholder="08xxxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[15px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Lanjut"}
            {!loading && <ArrowRight size={17} strokeWidth={2.5} />}
          </button>
          {error && <p className="mt-3 text-center text-[13px] font-medium text-chili-dark">{error}</p>}
        </form>
      ) : (
        <form onSubmit={submitName} className="mt-4">
          <button type="button" onClick={onBackToPhone} className="mb-3 flex items-center gap-1 text-[12px] font-semibold text-ink-soft">
            <ArrowLeft size={13} /> {phone}
          </button>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Nama Kamu</label>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-cream px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <User size={16} className="text-ink-soft" />
            <input
              type="text"
              required
              autoFocus
              placeholder="Nama kamu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[15px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk & Lanjut Checkout"}
            {!loading && <ArrowRight size={17} strokeWidth={2.5} />}
          </button>
          {error && <p className="mt-3 text-center text-[13px] font-medium text-chili-dark">{error}</p>}
        </form>
      )}
    </BottomSheet>
  );
}
