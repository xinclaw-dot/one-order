import { ImagePlus } from "lucide-react";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

const CATEGORIES = ["Makanan", "Minuman", "Topping"];

export default function MenuForm({ form, setForm, onSubmit, saving, uploading, error, onFileSelect }) {
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <h3 className="mb-3 font-display text-[15px] font-extrabold">Tambah Menu Baru</h3>

      <input
        type="text"
        placeholder="Nama menu"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="mb-2.5 w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />
      <input
        type="number"
        placeholder="Harga (Rp)"
        value={form.price ?? ""}
        onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })}
        className="mb-2.5 w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />
      <select
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        className="mb-2.5 w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
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
        className="mb-2.5 w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />

      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Gambar Menu</label>
      <label className="mb-2.5 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-ink/15 px-3.5 py-3 text-[13px] font-semibold text-ink-soft hover:border-chili/40 hover:text-chili-dark">
        <ImagePlus size={16} />
        {form.image_url ? "Ganti gambar" : "Pilih gambar"}
        <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
      </label>
      {uploading && <p className="mb-2 text-[12px] text-ink-soft">Mengunggah gambar...</p>}
      {form.image_url && <img src={optimizedImageUrl(form.image_url, 160)} alt="" className="mb-2.5 h-20 w-20 rounded-xl object-cover" />}

      <p className="mb-2.5 text-[11.5px] text-ink-soft">
        Opsi tambahan (add-on) bisa diatur setelah menu ini disimpan — form edit akan langsung terbuka.
      </p>

      <button
        onClick={onSubmit}
        disabled={saving}
        className="w-full rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Menyimpan..." : "Simpan Menu"}
      </button>
      {error && <p className="mt-2 text-[13px] text-chili-dark">{error}</p>}
    </div>
  );
}
