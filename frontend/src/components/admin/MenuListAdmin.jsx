import { useState } from "react";
import { Trash2 } from "lucide-react";
import { rupiah } from "../../lib/format";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

// Placeholder gambar lokal (SVG inline, tidak butuh koneksi internet/domain luar).
// Sebelumnya pakai https://placehold.co/... yang ternyata gagal dimuat di sebagian
// jaringan pengguna, sehingga malah menampilkan ikon "broken image" bawaan browser.
const MENU_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="16" fill="#e6f7ee"/>
      <circle cx="30" cy="30" r="7" fill="#00b14f"/>
      <path d="M12 58 L30 38 L44 52 L54 42 L68 58 Z" fill="#00b14f"/>
    </svg>`
  );

export default function MenuListAdmin({ menus, onEdit, onToggleActive, onToggleAvailable, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);

  function handleDeleteClick(menu) {
    if (confirmId === menu.id) {
      onDelete(menu);
      setConfirmId(null);
    } else {
      setConfirmId(menu.id);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <h3 className="mb-2 font-display text-[15px] font-extrabold">Daftar Menu ({menus.length})</h3>
      {menus.length === 0 && <p className="text-[13px] text-ink-soft">Belum ada menu.</p>}
      <div className="divide-y divide-ink/8">
        {menus.map((m) => (
          <div key={m.id} className={`flex flex-col gap-2 py-3 ${!m.is_active ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-3">
              <img
                src={m.image_url ? optimizedImageUrl(m.image_url, 96) : MENU_IMAGE_PLACEHOLDER}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
              <button onClick={() => onEdit(m)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-bold">{m.name}</p>
                <p className="truncate text-[11px] text-ink-soft">
                  {m.category} · {rupiah(m.price)}
                  {m.addons?.length > 0 ? ` · ${m.addons.length} add-on` : ""}
                </p>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap rounded-md bg-cream px-2 py-1 text-[10px] font-bold text-ink-soft">
                  {m.is_active ? "Aktif" : "Nonaktif"}
                </span>
                {m.is_available === 0 && (
                  <span className="whitespace-nowrap rounded-md bg-chili/10 px-2 py-1 text-[10px] font-bold text-chili-dark">Habis</span>
                )}
              </div>
            </div>

            {confirmId === m.id ? (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="mr-auto text-[11px] font-bold text-chili-dark">Hapus menu ini?</span>
                <button
                  onClick={() => handleDeleteClick(m)}
                  className="rounded-lg bg-chili px-2.5 py-1.5 text-[11px] font-bold text-white"
                >
                  Ya, hapus
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-1.5">
                <button onClick={() => onEdit(m)} className="rounded-lg bg-sky/10 px-2.5 py-1.5 text-[11px] font-bold text-sky">
                  Edit
                </button>
                <button
                  onClick={() => onToggleAvailable(m)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                    m.is_available === 0 ? "bg-chili text-white" : "bg-ink/5 text-ink-soft"
                  }`}
                >
                  {m.is_available === 0 ? "Habis" : "Tersedia"}
                </button>
                <button onClick={() => onToggleActive(m)} className="rounded-lg bg-ink/5 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
                  {m.is_active ? "Off" : "On"}
                </button>
                <button
                  onClick={() => handleDeleteClick(m)}
                  aria-label={`Hapus ${m.name}`}
                  className="rounded-lg bg-chili/10 px-2.5 py-1.5 text-chili-dark active:scale-95"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
