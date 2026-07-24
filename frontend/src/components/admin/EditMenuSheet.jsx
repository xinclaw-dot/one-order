import { useEffect, useState } from "react";
import { ImagePlus, PlusCircle, Trash2 } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { rupiah } from "../../lib/format";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

const CATEGORIES = ["Makanan", "Minuman", "Topping"];

// Placeholder gambar lokal, disajikan sebagai file statis di /public (bukan data URI).
// Sebelumnya pakai https://placehold.co/... yang gagal dimuat di sebagian jaringan,
// lalu diganti data:image/svg+xml;utf8,... — tapi data URI SVG dengan charset "utf8"
// ternyata juga gagal dimuat di sebagian browser/WebView Android dan malah
// menampilkan ikon "broken image" bawaan. File statis biasa aman di semua browser.
const MENU_IMAGE_PLACEHOLDER = "/menu-placeholder.svg";

export default function EditMenuSheet({
  menu,
  onClose,
  onSave,
  saving,
  uploading,
  error,
  onFileSelect,
  onAddAddon,
  onDeleteAddon,
  addonSaving,
  addonError,
}) {
  const [form, setForm] = useState(null);
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("");

  useEffect(() => {
    if (menu) {
      setForm({
        name: menu.name,
        price: menu.price,
        category: menu.category,
        description: menu.description || "",
        image_url: menu.image_url || "",
      });
      setAddonName("");
      setAddonPrice("");
    }
  }, [menu]);

  if (!menu || !form) return null;

  function submitAddon() {
    if (!addonName.trim()) return;
    onAddAddon(menu.id, { name: addonName.trim(), extra_price: Number(addonPrice) || 0 });
    setAddonName("");
    setAddonPrice("");
  }

  return (
    <BottomSheet open={!!menu} onClose={onClose}>
      <h3 className="font-display text-lg font-extrabold">Edit Menu</h3>

      <input
        type="text"
        placeholder="Nama menu"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="mb-2.5 mt-3 w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />
      <input
        type="number"
        placeholder="Harga (Rp)"
        value={form.price ?? ""}
        onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
        className="mb-2.5 w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />
      <select
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        className="mb-2.5 w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        placeholder="Deskripsi (opsional)"
        rows={2}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="mb-2.5 w-full rounded-xl bg-white px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Gambar Menu</label>
      <img
        src={form.image_url ? optimizedImageUrl(form.image_url, 160) : MENU_IMAGE_PLACEHOLDER}
        alt=""
        className="mb-2.5 h-20 w-20 rounded-xl object-cover"
      />
      <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-ink/15 px-3.5 py-3 text-[13px] font-semibold text-ink-soft hover:border-chili/40 hover:text-chili-dark">
        <ImagePlus size={16} />
        Ganti gambar
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e, form, setForm)} />
      </label>
      {uploading && <p className="mb-2 text-[12px] text-ink-soft">Mengunggah gambar...</p>}

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        <button onClick={onClose} className="flex-1 rounded-xl bg-ink/8 py-3 font-display text-[14px] font-extrabold text-ink">
          Batal
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-chili-dark">{error}</p>}

      {/* ---- Opsi Tambahan (Add-on) ---- */}
      <div className="mt-5 border-t border-dashed border-ink/15 pt-4">
        <h4 className="mb-2.5 font-display text-[14px] font-extrabold">Opsi Tambahan (Add-on)</h4>

        {menu.addons?.length > 0 ? (
          <div className="mb-3 space-y-1.5">
            {menu.addons.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-ink/10">
                <div>
                  <p className="text-[13px] font-semibold text-ink">{a.name}</p>
                  <p className="text-[11px] text-ink-soft">{a.extra_price > 0 ? `+${rupiah(a.extra_price)}` : "Gratis"}</p>
                </div>
                <button
                  onClick={() => onDeleteAddon(menu.id, a.id)}
                  aria-label={`Hapus opsi ${a.name}`}
                  className="rounded-lg bg-chili/10 p-1.5 text-chili-dark active:scale-95"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-ink-soft">Belum ada opsi tambahan untuk menu ini.</p>
        )}

        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Nama add-on, mis. Extra Keju"
            value={addonName}
            onChange={(e) => setAddonName(e.target.value)}
            className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 text-[13px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
          />
          <input
            type="number"
            placeholder="Rp"
            value={addonPrice}
            onChange={(e) => setAddonPrice(e.target.value)}
            className="w-20 shrink-0 rounded-xl bg-white px-2.5 py-2.5 text-[13px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
          />
          <button
            onClick={submitAddon}
            disabled={addonSaving}
            aria-label="Tambah opsi"
            className="shrink-0 rounded-xl bg-ink px-3 text-cream active:scale-95 disabled:opacity-50"
          >
            <PlusCircle size={18} />
          </button>
        </div>
        {addonError && <p className="mt-2 text-[12.5px] text-chili-dark">{addonError}</p>}
      </div>
    </BottomSheet>
  );
}
