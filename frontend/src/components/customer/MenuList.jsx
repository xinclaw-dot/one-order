import { Plus } from "lucide-react";
import { rupiah } from "../../lib/format";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

function MenuCard({ item, onAdd }) {
  const outOfStock = item.is_available === 0;
  const tenantClosed = item.tenant_is_open === false;
  const disabled = outOfStock || tenantClosed;

  return (
    <div className={`flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink/5 transition ${disabled ? "" : "hover:ring-chili/30"}`}>
      <div className="relative shrink-0">
        <img
          src={item.image_url ? optimizedImageUrl(item.image_url, 160) : "https://placehold.co/96x96/e6f7ee/00b14f?text=%F0%9F%8D%9C"}
          alt={item.name}
          className={`h-[76px] w-[76px] rounded-xl bg-cream object-cover ${disabled ? "grayscale opacity-60" : ""}`}
        />
        {disabled && (
          <span className="absolute inset-0 grid place-items-center rounded-xl bg-ink/50 text-[10px] font-bold uppercase tracking-wide text-white">
            {outOfStock ? "Habis" : "Tutup"}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {item.tenant_name && (
          <p className="mb-0.5 truncate text-[10.5px] font-bold uppercase tracking-wide text-chili-dark">{item.tenant_name}</p>
        )}
        <h3 className="truncate font-display text-[15px] font-bold leading-tight">{item.name}</h3>
        {item.description && <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">{item.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-ticket text-[13px] font-bold text-chili-dark">{rupiah(item.price)}</span>
          {disabled ? (
            <span className="rounded-lg bg-ink/8 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
              {outOfStock ? "Stok habis" : "Warung tutup"}
            </span>
          ) : (
            <button
              onClick={() => onAdd(item)}
              aria-label={`Tambah ${item.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-chili to-guava text-white shadow-sm transition active:scale-90"
            >
              <Plus size={17} strokeWidth={2.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuList({ items, onAdd }) {
  if (items.length === 0) {
    return (
      <p className="mt-16 text-center text-sm text-ink-soft">
        Belum ada menu yang cocok ditampilkan di sini 🍽️
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 px-4 pb-4 pt-1 sm:grid-cols-2 sm:gap-4">
      {items.map((item) => (
        <MenuCard key={item.id} item={item} onAdd={onAdd} />
      ))}
    </div>
  );
}
