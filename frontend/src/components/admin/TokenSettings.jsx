import { useState } from "react";
import { KeyRound, Eye, EyeOff, Save, AlertTriangle } from "lucide-react";

export default function TokenSettings({ onSubmit, onChanged }) {
  const [adminToken, setAdminToken] = useState("");
  const [kitchenToken, setKitchenToken] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [showKitchen, setShowKitchen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedTokens, setSavedTokens] = useState(null); // { admin_token?, kitchen_token? } yang baru saja disimpan

  async function handleSave() {
    const payload = {};
    if (adminToken.trim()) payload.admin_token = adminToken.trim();
    if (kitchenToken.trim()) payload.kitchen_token = kitchenToken.trim();

    if (Object.keys(payload).length === 0) {
      setError("Isi minimal salah satu token yang mau diganti.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onSubmit(payload);
      setSavedTokens(payload);
      setAdminToken("");
      setKitchenToken("");
    } catch (err) {
      setError(err.message || "Gagal menyimpan token.");
    } finally {
      setSaving(false);
    }
  }

  if (savedTokens) {
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold text-green-700">
          <Save size={16} /> Token berhasil diganti
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Simpan token baru ini di tempat aman sekarang — halaman ini tidak akan menampilkannya lagi.
        </p>

        <div className="space-y-2">
          {savedTokens.admin_token && (
            <div className="rounded-xl bg-cream p-3 ring-1 ring-ink/10">
              <p className="text-[11px] font-bold text-ink-soft">Token Admin baru</p>
              <p className="break-all font-mono text-[13px]">{savedTokens.admin_token}</p>
            </div>
          )}
          {savedTokens.kitchen_token && (
            <div className="rounded-xl bg-cream p-3 ring-1 ring-ink/10">
              <p className="text-[11px] font-bold text-ink-soft">Token Kitchen baru</p>
              <p className="break-all font-mono text-[13px]">{savedTokens.kitchen_token}</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-mango/10 px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-chili-dark">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Sesi Admin/Kitchen yang sedang login dengan token lama akan otomatis logout. Login ulang pakai token baru.
        </div>

        <button
          onClick={() => {
            setSavedTokens(null);
            onChanged?.();
          }}
          className="mt-3 w-full rounded-xl bg-ink/5 py-2.5 text-[13px] font-bold text-ink-soft"
        >
          Selesai, login ulang sekarang
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <KeyRound size={16} className="text-chili-dark" /> Ganti Token Login
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Ganti token yang dipakai untuk masuk ke halaman Admin dan Kitchen. Kosongkan salah satu kalau tidak mau
          diganti. Minimal 6 karakter, makin panjang & acak makin aman.
        </p>

        <label className="mb-1 block text-[12px] font-bold text-ink-soft">Token Admin baru</label>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-cream px-3.5 py-2.5 ring-1 ring-ink/10 focus-within:ring-chili">
          <input
            type={showAdmin ? "text" : "password"}
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="Kosongkan kalau tidak diganti"
            className="min-w-0 flex-1 bg-transparent text-[14px] focus:outline-none"
          />
          <button type="button" onClick={() => setShowAdmin((v) => !v)} className="shrink-0 text-ink-soft">
            {showAdmin ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label className="mb-1 block text-[12px] font-bold text-ink-soft">Token Kitchen baru</label>
        <div className="mb-1 flex items-center gap-2 rounded-xl bg-cream px-3.5 py-2.5 ring-1 ring-ink/10 focus-within:ring-chili">
          <input
            type={showKitchen ? "text" : "password"}
            value={kitchenToken}
            onChange={(e) => setKitchenToken(e.target.value)}
            placeholder="Kosongkan kalau tidak diganti"
            className="min-w-0 flex-1 bg-transparent text-[14px] focus:outline-none"
          />
          <button type="button" onClick={() => setShowKitchen((v) => !v)} className="shrink-0 text-ink-soft">
            {showKitchen ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p className="mb-2 mt-2 text-[13px] font-semibold text-status-cancel">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || (!adminToken.trim() && !kitchenToken.trim())}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
        >
          <Save size={16} /> {saving ? "Menyimpan..." : "Simpan Token Baru"}
        </button>
      </div>
    </div>
  );
}
