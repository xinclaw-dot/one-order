import { useEffect, useState } from "react";
import { Minus, Plus, Check } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { rupiah } from "../../lib/format";

export default function AddItemSheet({ item, onClose, onConfirm }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [addonIds, setAddonIds] = useState([]);

  useEffect(() => {
    setQty(1);
    setNote("");
    setAddonIds([]);
  }, [item]);

  if (!item) return null;

  function toggleAddon(id) {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  const addonObjs = (item.addons || []).filter((a) => addonIds.includes(a.id));
  const unitPrice = item.price + addonObjs.reduce((s, a) => s + a.extra_price, 0);

  function confirm() {
    onConfirm({
      menu_id: item.id,
      name: item.name,
      tenant_slug: item.tenant_slug,
      tenant_name: item.tenant_name,
      qty,
      note,
      addon_ids: addonObjs.map((a) => a.id),
      addonNames: addonObjs.map((a) => a.name),
      // unitPrice disimpan terpisah (bukan cuma subtotal) supaya kalau nanti qty baris ini
      // diubah langsung dari keranjang, subtotal-nya bisa dihitung ulang tanpa perlu
      // membongkar lagi harga menu + harga add-on satu-satu.
      unitPrice,
      subtotal: unitPrice * qty,
    });
  }

  return (
    <BottomSheet open={!!item} onClose={onClose}>
      <h3 className="font-display text-lg font-extrabold">{item.name}</h3>
      {item.description && <p className="mt-1 text-[13px] text-ink-soft">{item.description}</p>}

      {item.addons?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Opsi tambahan</p>
          <div className="space-y-2">
            {item.addons.map((addon) => {
              const checked = addonIds.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleAddon(addon.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left ring-1 transition ${
                    checked ? "bg-chili/10 ring-chili" : "bg-white ring-ink/10"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className={`grid h-4.5 w-4.5 place-items-center rounded-md ${checked ? "bg-chili text-white" : "bg-cream ring-1 ring-ink/15"}`}>
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    {addon.name}
                  </span>
                  <span className="font-ticket text-[12px] text-ink-soft">+{rupiah(addon.extra_price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">Catatan (opsional)</label>
      <input
        type="text"
        placeholder="Contoh: pedas sedikit, tanpa bawang..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-xl bg-white px-3.5 py-3 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
      />

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-ink/10 active:scale-90"
        >
          <Minus size={16} />
        </button>
        <span className="w-6 text-center font-ticket text-lg font-bold">{qty}</span>
        <button
          onClick={() => setQty((q) => q + 1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-ink/10 active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>

      <button
        onClick={confirm}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[15px] font-extrabold text-white shadow-lg shadow-chili/25 active:scale-[0.98]"
      >
        Tambah · {rupiah(unitPrice * qty)}
      </button>
    </BottomSheet>
  );
}
