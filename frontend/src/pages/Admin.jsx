import { useEffect, useState } from "react";
import { ShieldCheck, LogOut, UtensilsCrossed, LineChart, Clock, Palette, QrCode, Volume2, KeyRound } from "lucide-react";
import LoginGate from "../components/LoginGate";
import MenuForm from "../components/admin/MenuForm";
import MenuListAdmin from "../components/admin/MenuListAdmin";
import EditMenuSheet from "../components/admin/EditMenuSheet";
import ReportsPanel from "../components/admin/ReportsPanel";
import OperationalSettings from "../components/admin/OperationalSettings";
import ThemeSettings from "../components/admin/ThemeSettings";
import QrisSettings from "../components/admin/QrisSettings";
import NotificationSoundSettings from "../components/admin/NotificationSoundSettings";
import TokenSettings from "../components/admin/TokenSettings";
import InstallPrompt from "../components/InstallPrompt";
import Footer from "../components/Footer";
import { useThemeSync } from "../hooks/useThemeSync";
import { useRoleManifest } from "../hooks/useRoleManifest";
import { api } from "../lib/api";
import { compressImage } from "../lib/imageCompress";

const EMPTY_FORM = { name: "", price: null, category: "Makanan", description: "", image_url: "" };
// CATATAN: tab "Kasir" (kelola akun kasir per-tenant) sudah DIHAPUS dari sini —
// akun kasir sekarang GLOBAL (1 akun untuk semua stan), dikelola dari panel
// Superadmin -> "Kasir Global" (/superman), bukan lagi dari Admin tiap stan.
const TABS = [
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "laporan", label: "Laporan", icon: LineChart },
  { id: "jam", label: "Jam Buka", icon: Clock },
  { id: "tema", label: "Tema Warna", icon: Palette },
  { id: "qris", label: "QRIS", icon: QrCode },
  { id: "notif", label: "Suara Notif", icon: Volume2 },
  { id: "keamanan", label: "Keamanan", icon: KeyRound },
];

export default function Admin() {
  useThemeSync();
  useRoleManifest("admin");
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token"));
  const [tab, setTab] = useState("menu");

  // ---- Menu ----
  const [menus, setMenus] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingMenu, setEditingMenu] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonError, setAddonError] = useState("");
  const [menuActionError, setMenuActionError] = useState("");

  // ---- Laporan ----
  const [range, setRange] = useState("today");
  const [reports, setReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // CATATAN: state "Kasir" (daftar akun kasir per-tenant) sudah dihapus dari
  // sini — lihat catatan di atas TABS.

  // ---- Jam Operasional ----
  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // ---- QRIS ----
  const [qrisUploading, setQrisUploading] = useState(false);
  const [qrisError, setQrisError] = useState("");

  // ---- Suara Notifikasi ----
  const [notifSoundUploading, setNotifSoundUploading] = useState(false);
  const [notifSoundError, setNotifSoundError] = useState("");

  useEffect(() => {
    if (!token) return;
    loadMenus();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || tab !== "laporan") return;
    setReportsLoading(true);
    api
      .getReports(token, range)
      .then((data) => setReports(data.reports || data))
      .finally(() => setReportsLoading(false));
  }, [token, tab, range]);

  // Mengembalikan daftar menu terbaru (dipakai lagi supaya editingMenu bisa langsung disegarkan setelah ubah add-on)
  async function loadMenus() {
    try {
      const data = await api.getAdminMenu(token);
      const list = data.menu || [];
      setMenus(list);
      return list;
    } catch (e) {
      handleAuthError(e);
      return [];
    }
  }

  function loadSettings() {
    api
      .getSettings(token)
      .then(setSettings)
      .catch(handleAuthError);
  }

  async function handleSaveSettings(form) {
    setSettingsError("");
    setSettingsSaving(true);
    try {
      const data = await api.updateSettings(token, form);
      setSettings(data);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  function handleAuthError(e) {
    if (e.message?.toLowerCase().includes("unauthorized")) handleLogout();
  }

  function handleLoginSubmit(t) {
    sessionStorage.setItem("admin_token", t);
    setToken(t);
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_token");
    setToken(null);
  }

  async function handleCreateFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const data = await api.uploadImage(token, compressed);
      setForm((f) => ({ ...f, image_url: data.image_url }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleQrisFileSelect(e, onUploaded) {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrisError("");
    setQrisUploading(true);
    try {
      // format: "png" (BUKAN "jpeg" default) — QR Code wajib dikompres lossless,
      // supaya tepi kotak hitam-putihnya tetap tajam dan scanner QRIS tidak
      // gagal baca gara-gara artefak blur JPEG. Tetap mengecilkan resolusi
      // screenshot besar (mis. dari HP admin) supaya tidak ikut ter-upload
      // penuh ke Cloudinary.
      const compressed = await compressImage(file, { format: "png" });
      const data = await api.uploadImage(token, compressed);
      onUploaded(data.image_url);
    } catch (err) {
      setQrisError(err.message);
    } finally {
      setQrisUploading(false);
    }
  }

  async function handleNotifSoundFileSelect(e, onUploaded) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotifSoundError("");
    setNotifSoundUploading(true);
    try {
      const data = await api.uploadImage(token, file);
      onUploaded(data.sound_url || data.image_url);
    } catch (err) {
      setNotifSoundError(err.message);
    } finally {
      setNotifSoundUploading(false);
    }
  }

  async function handleEditFileSelect(e, editForm, setEditForm) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const data = await api.uploadImage(token, compressed);
      setEditForm({ ...editForm, image_url: data.image_url });
    } catch (err) {
      setEditError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateSubmit() {
    setFormError("");
    if (!form.name.trim() || !form.price) {
      setFormError("Nama dan harga wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const data = await api.createMenu(token, form);
      setForm(EMPTY_FORM);
      const list = await loadMenus();
      // Langsung buka form edit menu yang baru dibuat, supaya bisa langsung atur opsi tambahan
      setEditingMenu(list.find((m) => m.id === data.menu.id) || null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(editForm) {
    setEditError("");
    setEditSaving(true);
    try {
      await api.updateMenu(token, editingMenu.id, editForm);
      setEditingMenu(null);
      loadMenus();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive(menu) {
    await api.toggleMenuActive(token, menu.id);
    loadMenus();
  }

  async function handleToggleAvailable(menu) {
    await api.toggleMenuAvailable(token, menu.id);
    loadMenus();
  }

  async function handleDeleteMenu(menu) {
    setMenuActionError("");
    try {
      await api.deleteMenu(token, menu.id);
      loadMenus();
    } catch (err) {
      setMenuActionError(err.message);
      setTimeout(() => setMenuActionError(""), 5000);
    }
  }

  async function handleAddAddon(menuId, addonForm) {
    setAddonError("");
    setAddonSaving(true);
    try {
      await api.addAddon(token, menuId, addonForm);
      const list = await loadMenus();
      setEditingMenu(list.find((m) => m.id === menuId) || null);
    } catch (err) {
      setAddonError(err.message);
    } finally {
      setAddonSaving(false);
    }
  }

  async function handleDeleteAddon(menuId, addonId) {
    setAddonError("");
    try {
      await api.deleteAddon(token, menuId, addonId);
      const list = await loadMenus();
      setEditingMenu(list.find((m) => m.id === menuId) || null);
    } catch (err) {
      setAddonError(err.message);
    }
  }

  if (!token)
    return (
      <>
        <LoginGate title="Dashboard Admin" icon={ShieldCheck} onSubmit={handleLoginSubmit} />
        <Footer />
        <InstallPrompt />
      </>
    );

  return (
    <div className="min-h-screen bg-cream pb-10">
      <div className="mx-auto min-h-screen w-full max-w-6xl bg-white sm:shadow-[0_0_60px_-15px_rgba(0,122,61,0.25)]">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-5 py-4 text-cream">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava">
              <ShieldCheck size={17} />
            </span>
            <p className="font-display text-[16px] font-extrabold">Dashboard Admin</p>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Keluar"
            className="rounded-lg p-1.5 text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95"
          >
            <LogOut size={17} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:flex sm:flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition sm:flex-1 ${
                  tab === t.id ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink-soft ring-1 ring-ink/10"
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-5">
          {tab === "menu" && (
            <>
              {menuActionError && (
                <div className="mb-3 rounded-xl bg-chili/10 px-4 py-2.5 text-[12.5px] font-semibold text-chili-dark">
                  {menuActionError}
                </div>
              )}
              <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
                <MenuForm
                  form={form}
                  setForm={setForm}
                  onSubmit={handleCreateSubmit}
                  saving={saving}
                  uploading={uploading}
                  error={formError}
                  onFileSelect={handleCreateFileSelect}
                />
                <MenuListAdmin menus={menus} onEdit={setEditingMenu} onToggleActive={handleToggleActive} onToggleAvailable={handleToggleAvailable} onDelete={handleDeleteMenu} />
              </div>
            </>
          )}

          {tab === "laporan" && <ReportsPanel range={range} setRange={setRange} reports={reports} loading={reportsLoading} />}

          {tab === "jam" && (
            <OperationalSettings settings={settings} onSave={handleSaveSettings} saving={settingsSaving} error={settingsError} />
          )}

          {tab === "tema" && (
            <ThemeSettings currentPreset={settings?.theme_preset} onSave={handleSaveSettings} saving={settingsSaving} error={settingsError} />
          )}

          {tab === "qris" && (
            <QrisSettings
              qrisImageUrl={settings?.qris_image_url}
              onSave={handleSaveSettings}
              saving={settingsSaving}
              uploading={qrisUploading}
              error={qrisError || settingsError}
              onFileSelect={handleQrisFileSelect}
            />
          )}

          {tab === "notif" && (
            <NotificationSoundSettings
              soundUrl={settings?.notification_sound_url}
              onSave={handleSaveSettings}
              saving={settingsSaving}
              uploading={notifSoundUploading}
              error={notifSoundError || settingsError}
              onFileSelect={handleNotifSoundFileSelect}
            />
          )}

          {tab === "keamanan" && (
            <TokenSettings onSubmit={(payload) => api.updateTokens(token, payload)} onChanged={handleLogout} />
          )}
        </div>

        <Footer />
      </div>

      <EditMenuSheet
        menu={editingMenu}
        onClose={() => setEditingMenu(null)}
        onSave={handleEditSave}
        saving={editSaving}
        uploading={uploading}
        error={editError}
        onFileSelect={handleEditFileSelect}
        onAddAddon={handleAddAddon}
        onDeleteAddon={handleDeleteAddon}
        addonSaving={addonSaving}
        addonError={addonError}
      />

      <InstallPrompt />
    </div>
  );
}
