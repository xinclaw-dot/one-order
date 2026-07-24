import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Activity,
  DatabaseBackup,
  Trash2,
  LogOut,
  RefreshCcw,
  LayoutGrid,
  UtensilsCrossed,
  ChefHat,
  Wallet,
  ShoppingBag,
  Store,
  Plus,
  KeyRound,
  Power,
  ArrowLeft,
  Users,
} from "lucide-react";
import SecretTapGate from "../components/SecretTapGate";
import LoginGate from "../components/LoginGate";
import { superadminApi, setTenantSlug } from "../lib/api";

// Panel superadmin GLOBAL (bukan milik 1 tenant): kelola SEMUA warung dari sini.
// Alur: pilih/buat tenant di tab "Tenant" -> klik "Kelola" -> panel detail tenant
// (aktivitas, backup, reset, masuk sebagai role) muncul di bawahnya.
//
// SEJAK RESTRUKTUR "SINGLE KASIR": akun kasir sudah GLOBAL (bukan per-tenant
// lagi), jadi dikelola dari tab terpisah "Kasir Global" di panel ini (bukan
// dari dalam detail 1 tenant) — lihat KasirGlobalPanel di bawah.

export default function Superadmin() {
  return (
    <SecretTapGate requiredTaps={5} windowMs={3000}>
      <SuperadminPanel />
    </SecretTapGate>
  );
}

function SuperadminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem("superadmin_token"));
  const [section, setSection] = useState("tenant"); // 'tenant' | 'kasir'
  const [globalStats, setGlobalStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null); // full tenant row (dengan token)

  function handleLogin(secretKey) {
    sessionStorage.setItem("superadmin_token", secretKey);
    setToken(secretKey);
  }

  function logout() {
    sessionStorage.removeItem("superadmin_token");
    setToken(null);
  }

  useEffect(() => {
    if (!token) return;
    loadGlobalStats();
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadGlobalStats() {
    try {
      const data = await superadminApi.getGlobalStats(token);
      setGlobalStats(data);
    } catch {
      logout(); // token salah -> kembali ke form login
    }
  }

  async function loadTenants() {
    setTenantsLoading(true);
    try {
      const data = await superadminApi.listTenants(token);
      setTenants(data.tenants);
    } catch {
      // diamkan, loadGlobalStats sudah menangani token invalid
    } finally {
      setTenantsLoading(false);
    }
  }

  async function openTenant(id) {
    try {
      const data = await superadminApi.getTenantStats(token, id);
      setSelectedTenant(data.tenant);
    } catch (err) {
      alert(err.message || "Gagal membuka tenant.");
    }
  }

  if (!token) {
    return <LoginGate title="Superadmin" icon={ShieldAlert} onSubmit={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-cream pb-24 text-ink">
      <header className="flex items-center justify-between bg-white px-5 py-4 ring-1 ring-ink/5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava text-white">
            <ShieldAlert size={18} />
          </span>
          <div>
            <h1 className="font-display text-[15px] font-extrabold leading-tight">Superadmin</h1>
            <p className="text-[11px] text-ink-soft">Panel developer — kelola semua warung</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1 rounded-lg bg-ink/5 px-3 py-1.5 text-[12px] font-bold text-ink-soft">
          <LogOut size={13} /> Keluar
        </button>
      </header>

      {globalStats && (
        <div className="grid grid-cols-2 gap-2 px-5 pt-4 sm:grid-cols-4">
          <StatCard label="Warung aktif" value={globalStats.active_tenants} />
          <StatCard label="Total customer" value={globalStats.total_customers_all_tenants} />
          <StatCard label="Total order" value={globalStats.total_orders_all_tenants} />
          <StatCard label="Total omzet" value={formatRupiah(globalStats.total_revenue_all_tenants)} />
        </div>
      )}

      <div className="px-5 pt-4">
        <nav className="mb-4 flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink/5">
          <button
            onClick={() => setSection("tenant")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold ${
              section === "tenant" ? "bg-gradient-to-r from-chili to-guava text-white" : "text-ink-soft"
            }`}
          >
            <Store size={14} /> Tenant
          </button>
          <button
            onClick={() => {
              setSection("kasir");
              setSelectedTenant(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold ${
              section === "kasir" ? "bg-gradient-to-r from-chili to-guava text-white" : "text-ink-soft"
            }`}
          >
            <Users size={14} /> Kasir Global
          </button>
        </nav>

        {section === "kasir" ? (
          <KasirGlobalPanel token={token} />
        ) : !selectedTenant ? (
          <TenantListPanel
            token={token}
            tenants={tenants}
            loading={tenantsLoading}
            onRefresh={loadTenants}
            onOpen={openTenant}
          />
        ) : (
          <TenantDetailPanel
            token={token}
            tenant={selectedTenant}
            onBack={() => setSelectedTenant(null)}
            onChanged={(updated) => {
              setSelectedTenant(updated);
              loadTenants();
            }}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-ink/5">
      <p className="text-[16px] font-extrabold">{value ?? "-"}</p>
      <p className="text-[11px] text-ink-soft">{label}</p>
    </div>
  );
}

function formatRupiah(n) {
  if (n === undefined || n === null) return "-";
  return "Rp" + Number(n).toLocaleString("id-ID");
}

// ============================================
// TAB: daftar tenant + form buat tenant baru
// ============================================
function TenantListPanel({ token, tenants, loading, onRefresh, onOpen }) {
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState(null); // { tenant } dengan token, ditampilkan sekali

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const data = await superadminApi.createTenant(token, { slug: slug.trim(), name: name.trim() });
      setCreated(data.tenant);
      setSlug("");
      setName("");
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setCreateError(err.message || "Gagal membuat tenant.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      {created && (
        <div className="rounded-2xl bg-white p-4 ring-2 ring-chili/40">
          <p className="mb-2 flex items-center gap-1.5 font-display text-[14px] font-extrabold text-chili-dark">
            <KeyRound size={15} /> Warung "{created.name}" dibuat
          </p>
          <p className="mb-2 text-[12px] text-ink-soft">
            Simpan token di bawah ini sekarang — tidak ditampilkan lagi setelah ini (bisa di-generate ulang lewat
            tombol "Regenerate Token" kapan saja, tapi token lama langsung tidak berlaku).
          </p>
          <TokenRow label="Link warung" value={`/${created.slug}/order`} />
          <TokenRow label="Admin token" value={created.admin_token} />
          <TokenRow label="Kitchen token" value={created.kitchen_token} />
          <button onClick={() => setCreated(null)} className="mt-2 w-full rounded-lg bg-ink/5 py-2 text-[12px] font-bold text-ink-soft">
            Tutup
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-extrabold">Daftar Warung ({tenants.length})</h3>
        <div className="flex gap-1.5">
          <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
            <RefreshCcw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-chili to-guava px-2.5 py-1.5 text-[11px] font-bold text-white"
          >
            <Plus size={12} /> Warung Baru
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink-soft">Nama warung</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Warung Kita Cabang 2"
              required
              className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink-soft">Slug URL (huruf kecil, angka, strip)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="warung-kita-2"
              required
              pattern="[a-z0-9-]+"
              className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
            />
            <p className="mt-1 text-[11px] text-ink-soft">Warung akan diakses di /{slug || "..."}/order</p>
          </div>
          {createError && <p className="text-[12px] text-chili-dark">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-gradient-to-r from-chili to-guava py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {creating ? "Membuat..." : "Buat Warung"}
          </button>
        </form>
      )}

      {loading && <p className="text-[13px] text-ink-soft">Memuat...</p>}
      {!loading && tenants.length === 0 && <p className="text-[13px] text-ink-soft">Belum ada warung.</p>}

      <div className="space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink/5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${t.is_active ? "bg-gradient-to-br from-chili to-guava" : "bg-ink/30"}`}>
              <Store size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[13px] font-extrabold">{t.name}</p>
              <p className="truncate text-[11px] text-ink-soft">
                /{t.slug} · {t.is_active ? "Aktif" : "Nonaktif"}
              </p>
            </div>
            <button onClick={() => onOpen(t.id)} className="shrink-0 rounded-lg bg-ink/5 px-3 py-2 text-[12px] font-bold text-ink-soft">
              Kelola
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenRow({ label, value }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-cream px-2.5 py-2 text-[12px]">
      <span className="text-ink-soft">{label}</span>
      <code className="truncate font-mono font-bold">{value}</code>
    </div>
  );
}

// ============================================
// TAB: "Kasir Global" — kelola akun kasir yang bisa dipakai untuk SEMUA stan
// sekaligus (bukan per-tenant lagi, lihat catatan restruktur di atas file ini).
// ============================================
function KasirGlobalPanel({ token }) {
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [resetTarget, setResetTarget] = useState(null); // { id, username } | null
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    superadminApi
      .listKasir(token)
      .then((data) => setCashiers(data.cashiers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password || !form.name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await superadminApi.createKasir(token, form);
      setForm({ username: "", password: "", name: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setCreateError(err.message || "Gagal membuat akun kasir.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(c) {
    await superadminApi.toggleKasirActive(token, c.id);
    load();
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    if (resetPassword.length < 6) {
      setResetError("Password minimal 6 karakter");
      return;
    }
    setResetSaving(true);
    setResetError("");
    try {
      await superadminApi.resetKasirPassword(token, resetTarget.id, resetPassword);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      setResetError(err.message || "Gagal reset password.");
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <p className="mb-1 text-[12.5px] leading-snug text-ink-soft">
          Satu akun kasir di sini bisa login di halaman <code className="rounded bg-cream px-1 py-0.5 font-mono">/kasir</code> dan
          langsung memproses pesanan untuk <b>SEMUA stan sekaligus</b> — tidak perlu akun terpisah per warung lagi.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-extrabold">Akun Kasir ({cashiers.length})</h3>
        <div className="flex gap-1.5">
          <button onClick={load} className="flex items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
            <RefreshCcw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-chili to-guava px-2.5 py-1.5 text-[11px] font-bold text-white"
          >
            <Plus size={12} /> Kasir Baru
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink-soft">Nama kasir</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Budi"
              required
              className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink-soft">Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoCapitalize="none"
              placeholder="budi"
              required
              className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-ink-soft">Password (min. 6 karakter)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
            />
          </div>
          {createError && <p className="text-[12px] text-chili-dark">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-gradient-to-r from-chili to-guava py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {creating ? "Menyimpan..." : "Buat Akun Kasir"}
          </button>
        </form>
      )}

      {resetTarget && (
        <form onSubmit={handleResetSubmit} className="space-y-2 rounded-2xl bg-white p-4 ring-2 ring-chili/40">
          <p className="text-[12.5px] font-bold">Reset password untuk @{resetTarget.username}</p>
          <input
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="Password baru (min. 6 karakter)"
            required
            minLength={6}
            className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
          />
          {resetError && <p className="text-[12px] text-chili-dark">{resetError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={resetSaving}
              className="flex-1 rounded-xl bg-gradient-to-r from-chili to-guava py-2.5 font-display text-[13px] font-extrabold text-white disabled:opacity-50"
            >
              {resetSaving ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetTarget(null);
                setResetPassword("");
                setResetError("");
              }}
              className="rounded-xl bg-ink/5 px-4 py-2.5 text-[13px] font-bold text-ink-soft"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-[13px] text-ink-soft">Memuat...</p>}
      {!loading && cashiers.length === 0 && <p className="text-[13px] text-ink-soft">Belum ada akun kasir.</p>}

      <div className="space-y-2">
        {cashiers.map((c) => (
          <div key={c.id} className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink/5 ${!c.is_active ? "opacity-50" : ""}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava text-white">
              <Wallet size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[13px] font-extrabold">{c.name}</p>
              <p className="truncate text-[11px] text-ink-soft">
                @{c.username} · {c.is_active ? "Aktif" : "Nonaktif"}
              </p>
            </div>
            <button
              onClick={() => setResetTarget({ id: c.id, username: c.username })}
              className="shrink-0 rounded-lg bg-ink/5 px-2.5 py-2 text-[11px] font-bold text-ink-soft"
            >
              <KeyRound size={13} />
            </button>
            <button
              onClick={() => handleToggle(c)}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-2 text-[11px] font-bold text-ink-soft"
            >
              <Power size={12} /> {c.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PANEL DETAIL: 1 tenant terpilih — masuk sebagai role, aktivitas, backup, reset
// ============================================
const DETAIL_TABS = [
  { id: "role", label: "Masuk Sebagai", icon: LayoutGrid },
  { id: "aktivitas", label: "Aktivitas", icon: Activity },
  { id: "backup", label: "Backup", icon: DatabaseBackup },
  { id: "reset", label: "Reset", icon: Trash2 },
];

function TenantDetailPanel({ token, tenant, onBack, onChanged }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("role");
  const [cashierNavLoading, setCashierNavLoading] = useState(false);
  const [cashierNavError, setCashierNavError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState(null);

  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [actorFilter, setActorFilter] = useState("");

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState("");

  const [resetConfirmText, setResetConfirmText] = useState("");
  const [seedSample, setSeedSample] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (tab === "aktivitas") loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tenant.id]);

  async function loadActivity() {
    setActivityLoading(true);
    try {
      const data = await superadminApi.getTenantActivity(token, tenant.id, 200);
      setActivity(data.activity);
    } catch {
      // diamkan
    } finally {
      setActivityLoading(false);
    }
  }

  function goToAdmin() {
    setTenantSlug(tenant.slug);
    sessionStorage.setItem("admin_token", tenant.admin_token);
    navigate(`/${tenant.slug}/admin`);
  }

  function goToKitchen() {
    setTenantSlug(tenant.slug);
    sessionStorage.setItem("kitchen_token", tenant.kitchen_token);
    navigate(`/${tenant.slug}/kitchen`);
  }

  async function goToKasir() {
    setCashierNavLoading(true);
    setCashierNavError("");
    try {
      const data = await superadminApi.impersonateKasir(token);
      sessionStorage.setItem("kasir_token", data.token);
      sessionStorage.setItem("kasir_info", JSON.stringify(data.cashier));
      navigate(`/kasir`);
    } catch (err) {
      setCashierNavError(err.message || "Gagal masuk sebagai kasir.");
    } finally {
      setCashierNavLoading(false);
    }
  }

  function goToCustomer() {
    setTenantSlug(tenant.slug);
    navigate(`/${tenant.slug}/order`);
  }

  async function toggleActive() {
    setToggling(true);
    try {
      const data = await superadminApi.toggleTenantActive(token, tenant.id);
      onChanged({ ...tenant, is_active: data.tenant.is_active });
    } catch (err) {
      alert(err.message || "Gagal mengubah status tenant.");
    } finally {
      setToggling(false);
    }
  }

  async function regenerateTokens() {
    if (!confirm("Token admin & kitchen LAMA akan langsung tidak berlaku. Lanjutkan?")) return;
    setRegenerating(true);
    try {
      const data = await superadminApi.regenerateTenantTokens(token, tenant.id);
      setRegenerated(data.tenant);
      onChanged(data.tenant);
    } catch (err) {
      alert(err.message || "Gagal membuat ulang token.");
    } finally {
      setRegenerating(false);
    }
  }

  async function downloadBackup() {
    setBackupLoading(true);
    setBackupError("");
    try {
      const data = await superadminApi.getTenantBackup(token, tenant.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${tenant.slug}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBackupError(err.message || "Gagal membuat backup.");
    } finally {
      setBackupLoading(false);
    }
  }

  async function doReset() {
    setResetLoading(true);
    setResetError("");
    setResetDone(false);
    try {
      await superadminApi.resetTenant(token, tenant.id, resetConfirmText, seedSample);
      setResetDone(true);
      setResetConfirmText("");
    } catch (err) {
      setResetError(err.message || "Gagal reset database.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
          <ArrowLeft size={12} /> Semua Warung
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-[15px] font-extrabold">{tenant.name}</p>
            <p className="text-[11px] text-ink-soft">/{tenant.slug} · {tenant.is_active ? "Aktif" : "Nonaktif"}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={regenerateTokens}
              disabled={regenerating}
              className="flex items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft disabled:opacity-50"
            >
              <KeyRound size={12} /> Regenerate Token
            </button>
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 ${
                tenant.is_active ? "bg-chili-dark" : "bg-green-700"
              }`}
            >
              <Power size={12} /> {tenant.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        </div>
        {regenerated && (
          <div className="mt-3 rounded-xl bg-cream p-3">
            <TokenRow label="Admin token baru" value={regenerated.admin_token} />
            <TokenRow label="Kitchen token baru" value={regenerated.kitchen_token} />
          </div>
        )}
      </div>

      <nav className="flex gap-1 rounded-2xl bg-white p-1 ring-1 ring-ink/5">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold ${
              tab === t.id ? "bg-gradient-to-r from-chili to-guava text-white" : "text-ink-soft"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "role" && (
        <div className="space-y-3">
          <p className="text-[12px] text-ink-soft">
            Masuk ke tampilan tiap role untuk warung ini tanpa perlu tahu token/akun terpisah.
          </p>
          <RoleNavCard icon={UtensilsCrossed} title="Admin" desc="Kelola menu, laporan, jam buka, tema, kasir, dll." onClick={goToAdmin} />
          <RoleNavCard icon={ChefHat} title="Kitchen" desc="Layar dapur — lihat & proses antrian order." onClick={goToKitchen} />
          <RoleNavCard
            icon={Wallet}
            title="Kasir"
            desc="Input order walk-in & verifikasi pembayaran LINTAS SEMUA STAN (bukan cuma warung ini). Pakai akun 'Superadmin (Developer)' otomatis."
            onClick={goToKasir}
            loading={cashierNavLoading}
            error={cashierNavError}
          />
          <RoleNavCard icon={ShoppingBag} title="Customer" desc="Tampilan pemesanan pelanggan (publik)." onClick={goToCustomer} />
        </div>
      )}

      {tab === "aktivitas" && (
        <ActivityTab activity={activity} loading={activityLoading} actorFilter={actorFilter} setActorFilter={setActorFilter} onRefresh={loadActivity} />
      )}

      {tab === "backup" && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
          <h3 className="mb-1 font-display text-[15px] font-extrabold">Backup Data Warung</h3>
          <p className="mb-3 text-[12px] text-ink-soft">
            Mengunduh seluruh data warung ini (customer, menu, order, kasir, pengaturan, log aktivitas) sebagai satu
            file JSON. Simpan file ini di tempat aman — isinya termasuk data pribadi pelanggan & kredensial kasir.
          </p>
          <button
            onClick={downloadBackup}
            disabled={backupLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
          >
            <DatabaseBackup size={16} /> {backupLoading ? "Menyiapkan..." : "Download Backup (.json)"}
          </button>
          {backupError && <p className="mt-2 text-[13px] text-chili-dark">{backupError}</p>}
          <p className="mt-3 text-[11px] text-ink-soft">
            Untuk backup native SQLite seluruh database (semua tenant sekaligus), gunakan juga secara berkala:{" "}
            <code className="rounded bg-ink/5 px-1 py-0.5">wrangler d1 export kitchen_order_db --remote --output=backup.sql</code>
          </p>
        </div>
      )}

      {tab === "reset" && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
          <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold text-chili-dark">
            <Trash2 size={16} /> Reset Data Warung Ini
          </h3>
          <p className="mb-3 text-[12px] text-ink-soft">
            Ini akan <b>MENGHAPUS SEMUA DATA</b> warung "{tenant.name}" (customer, order, menu, kasir, pengaturan) —
            warung lain TIDAK terpengaruh, dan slug/token warung ini tetap sama. Tindakan ini{" "}
            <b>TIDAK BISA DIBATALKAN</b>. Sangat disarankan download backup dulu.
          </p>

          <label className="mb-3 flex items-center gap-2 text-[12px] text-ink-soft">
            <input type="checkbox" checked={seedSample} onChange={(e) => setSeedSample(e.target.checked)} />
            Isi ulang dengan menu contoh (Nasi Goreng, Mie Ayam, dst)
          </label>

          <p className="mb-1.5 text-[12px] font-bold">
            Ketik <span className="rounded bg-ink/5 px-1 py-0.5 font-mono">RESET DATABASE</span> untuk konfirmasi:
          </p>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET DATABASE"
            className="mb-3 w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
          />

          <button
            onClick={doReset}
            disabled={resetLoading || resetConfirmText !== "RESET DATABASE"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-chili-dark py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
          >
            <RefreshCcw size={16} /> {resetLoading ? "Mereset..." : "Reset Warung Ini Sekarang"}
          </button>

          {resetError && <p className="mt-2 text-[13px] text-chili-dark">{resetError}</p>}
          {resetDone && <p className="mt-2 text-[13px] font-bold text-green-700">Data warung berhasil direset.</p>}
        </div>
      )}
    </div>
  );
}

function RoleNavCard({ icon: Icon, title, desc, onClick, loading, error }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava text-white">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[14px] font-extrabold">{title}</p>
          <p className="truncate text-[11px] text-ink-soft">{desc}</p>
        </div>
        <button
          onClick={onClick}
          disabled={loading}
          className="shrink-0 rounded-lg bg-ink/5 px-3 py-2 text-[12px] font-bold text-ink-soft disabled:opacity-50"
        >
          {loading ? "..." : "Buka"}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-chili-dark">{error}</p>}
    </div>
  );
}

const ACTOR_LABELS = {
  customer: "Customer",
  cashier: "Kasir",
  admin: "Admin",
  kitchen_admin: "Kitchen/Admin",
  superadmin: "Superadmin",
};

function ActivityTab({ activity, loading, actorFilter, setActorFilter, onRefresh }) {
  const filtered = actorFilter ? activity.filter((a) => a.actor_type === actorFilter) : activity;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-extrabold">Log Aktivitas ({filtered.length})</h3>
        <button onClick={onRefresh} className="flex items-center gap-1 rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
          <RefreshCcw size={12} /> Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterChip label="Semua" active={!actorFilter} onClick={() => setActorFilter("")} />
        {Object.entries(ACTOR_LABELS).map(([key, label]) => (
          <FilterChip key={key} label={label} active={actorFilter === key} onClick={() => setActorFilter(key)} />
        ))}
      </div>

      {loading && <p className="text-[13px] text-ink-soft">Memuat...</p>}
      {!loading && filtered.length === 0 && <p className="text-[13px] text-ink-soft">Belum ada aktivitas.</p>}

      <div className="max-h-[60vh] divide-y divide-ink/8 overflow-y-auto">
        {filtered.map((a) => (
          <div key={a.id} className="py-2.5 text-[12px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">
                {ACTOR_LABELS[a.actor_type] || a.actor_type}
                {a.actor_name ? ` · ${a.actor_name}` : ""}
              </span>
              <span className="shrink-0 text-[10px] text-ink-soft">{formatTime(a.created_at)}</span>
            </div>
            <p className="text-ink-soft">
              {a.action}
              {a.detail ? ` — ${a.detail}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? "bg-ink text-white" : "bg-ink/5 text-ink-soft"}`}
    >
      {label}
    </button>
  );
}

function formatTime(utcString) {
  if (!utcString) return "-";
  const d = new Date(utcString.replace(" ", "T") + "Z");
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 16).replace("T", " ") + " WIB";
}
