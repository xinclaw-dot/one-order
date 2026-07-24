import { useMemo, useState } from "react";
import { Minus, Plus, Phone, User, Receipt, Trash2 } from "lucide-react";
import { rupiah } from "../../lib/format";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "qris", label: "QRIS" },
];

// Bandingkan 2 daftar id add-on (urutan diabaikan) untuk menentukan apakah
// sebuah baris keranjang mewakili kombinasi add-on yang sama.
function sameAddonCombo(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((id, i) => id === sortedB[i]);
}

export default function CashierOrderForm({ menu, tenantsById = {}, onSubmit, submitting, error }) {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [activeTenant, setActiveTenant] = useState("Semua"); // "Semua" | tenant_slug
  // Keranjang berbasis BARIS (line item), bukan lagi 1 angka qty per menu.
  // Ini supaya "5x Nasi Goreng, 3 pakai Extra Telur & 2 tanpa tambahan" bisa
  // jadi 2 baris terpisah yang masing-masing punya qty & add-on sendiri.
  // Baris: { lineId, menu_id, name, price, addonIds: [], addonNames: [], addonsPrice, qty, tenantSlug, tenantName }
  const [cartLines, setCartLines] = useState([]);
  // Kombinasi add-on yang sedang "dipilih" per menu (belum tentu sudah ada di keranjang) —
  // ini yang dipakai saat tombol + / - pada kartu menu ditekan.
  const [draftAddons, setDraftAddons] = useState({}); // { [menuId]: Set(addonId) }
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [markPaid, setMarkPaid] = useState(true);
  const [note, setNote] = useState("");

  // Daftar stan yang punya menu, dipakai untuk chip filter "Semua Stan" — supaya
  // kasir bisa fokus ke 1 stan dulu kalau daftar menu gabungan terlalu panjang.
  // Satu transaksi TETAP boleh berisi item dari beberapa stan; filter ini cuma
  // menyaring TAMPILAN, bukan membatasi keranjang.
  const tenantOptions = useMemo(() => {
    const seen = new Map();
    for (const m of menu) {
      if (m.tenant_slug && !seen.has(m.tenant_slug)) seen.set(m.tenant_slug, m.tenant_name || m.tenant_slug);
    }
    return [...seen.entries()]; // [ [slug, name], ... ]
  }, [menu]);

  const categories = useMemo(() => {
    const set = new Set(menu.map((m) => m.category));
    return ["Semua", ...set];
  }, [menu]);

  let filteredMenu = activeCategory === "Semua" ? menu : menu.filter((m) => m.category === activeCategory);
  if (activeTenant !== "Semua") filteredMenu = filteredMenu.filter((m) => m.tenant_slug === activeTenant);

  function toggleDraftAddon(menuId, addonId) {
    setDraftAddons((prev) => {
      const current = new Set(prev[menuId] || []);
      if (current.has(addonId)) current.delete(addonId);
      else current.add(addonId);
      return { ...prev, [menuId]: current };
    });
  }

  // Tambah 1 unit sesuai kombinasi add-on yang sedang dipilih (draft) untuk menu ini.
  // Kalau baris dengan kombinasi yang sama sudah ada di keranjang, qty-nya tinggal +1.
  // Kalau belum ada (kombinasi baru / pertama kali), baris baru dibuat.
  function addUnit(m) {
    const addonIds = [...(draftAddons[m.id] || [])].sort((a, b) => a - b);
    const addonObjs = (m.addons || []).filter((a) => addonIds.includes(a.id));
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.menu_id === m.id && sameAddonCombo(l.addonIds, addonIds));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          lineId: `${m.id}-${addonIds.join("_")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          menu_id: m.id,
          name: m.name,
          price: m.price,
          addonIds,
          addonNames: addonObjs.map((a) => a.name),
          addonsPrice: addonObjs.reduce((s, a) => s + a.extra_price, 0),
          qty: 1,
          tenantSlug: m.tenant_slug || null,
          tenantName: m.tenant_name || null,
        },
      ];
    });
  }

  // Kurangi 1 unit dari baris yang cocok dengan kombinasi add-on yang sedang dipilih (draft).
  // Kalau qty baris itu jadi 0, barisnya dihapus. Tidak berpengaruh ke baris kombinasi lain.
  function removeUnit(m) {
    const addonIds = [...(draftAddons[m.id] || [])].sort((a, b) => a - b);
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.menu_id === m.id && sameAddonCombo(l.addonIds, addonIds));
      if (idx < 0) return prev;
      const next = [...prev];
      const newQty = next[idx].qty - 1;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: newQty };
      }
      return next;
    });
  }

  // Ubah qty langsung pada 1 baris tertentu (dipakai dari daftar rincian per-menu
  // maupun dari Ringkasan Pesanan) — tidak bergantung pada draft addon yang aktif.
  function changeLineQty(lineId, delta) {
    setCartLines((prev) => {
      const idx = prev.findIndex((l) => l.lineId === lineId);
      if (idx < 0) return prev;
      const next = [...prev];
      const newQty = next[idx].qty + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: newQty };
      }
      return next;
    });
  }

  function removeLine(lineId) {
    setCartLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  const cartItems = useMemo(() => {
    return cartLines.map((l) => ({
      lineId: l.lineId,
      menu_id: l.menu_id,
      name: l.name,
      qty: l.qty,
      addon_ids: l.addonIds,
      addonNames: l.addonNames,
      subtotal: (l.price + l.addonsPrice) * l.qty,
      tenant_slug: l.tenantSlug,
      tenant_name: l.tenantName,
    }));
  }, [cartLines]);

  // Berapa stan berbeda yang ada di keranjang saat ini — dipakai untuk
  // menampilkan peringatan "transaksi gabungan" di Ringkasan Pesanan.
  const distinctTenantsInCart = useMemo(() => {
    const set = new Set(cartItems.map((i) => i.tenant_slug).filter(Boolean));
    return set.size;
  }, [cartItems]);

  const total = cartItems.reduce((s, i) => s + i.subtotal, 0);

  // Total qty semua kombinasi untuk 1 menu — dipakai untuk badge di kartu menu.
  function totalQtyForMenu(menuId) {
    return cartLines.filter((l) => l.menu_id === menuId).reduce((s, l) => s + l.qty, 0);
  }

  // Qty baris yang cocok dengan kombinasi add-on yang sedang dipilih (draft) — ini
  // angka yang ditampilkan tepat di sebelah tombol +/- pada kartu menu.
  function draftQtyForMenu(m) {
    const addonIds = [...(draftAddons[m.id] || [])].sort((a, b) => a - b);
    const line = cartLines.find((l) => l.menu_id === m.id && sameAddonCombo(l.addonIds, addonIds));
    return line?.qty || 0;
  }

  function handleSubmit() {
    if (cartItems.length === 0) return;
    onSubmit({
      name: customerName.trim() || undefined,
      phone: customerPhone.trim() || undefined,
      payment_method: paymentMethod,
      mark_paid: markPaid,
      note: note.trim() || undefined,
      items: cartItems.map((i) => ({ menu_id: i.menu_id, qty: i.qty, addon_ids: i.addon_ids })),
      // Snapshot item (nama, qty, subtotal) untuk keperluan cetak nota di kasir.
      // Field ini dibuang lagi sebelum payload dikirim ke API (lihat Kasir.jsx).
      _receiptItems: cartItems,
    });
    setCartLines([]);
    setDraftAddons({});
    setCustomerName("");
    setCustomerPhone("");
    setNote("");
  }

  return (
    <div className="px-4 pb-6 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-5 lg:px-6">
      <div>
      {tenantOptions.length > 1 && (
        <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTenant("Semua")}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
              activeTenant === "Semua" ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"
            }`}
          >
            Semua Stan
          </button>
          {tenantOptions.map(([slug, name]) => (
            <button
              key={slug}
              onClick={() => setActiveTenant(slug)}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
                activeTenant === slug ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
              activeCategory === c ? "bg-ink text-cream" : "bg-white text-ink/60 ring-1 ring-ink/10"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredMenu.map((m) => {
          const hasAddons = m.addons?.length > 0;
          const draftQty = draftQtyForMenu(m);
          const totalQty = totalQtyForMenu(m.id);
          const linesForMenu = cartLines.filter((l) => l.menu_id === m.id);
          const stanClosed = m.tenant_is_open === false;
          const outOfStock = m.is_available === 0 || stanClosed;
          return (
            <div key={m.id} className={`rounded-2xl bg-white p-3 ring-1 ring-ink/5 ${outOfStock ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3">
                <img
                  src={m.image_url ? optimizedImageUrl(m.image_url, 96) : "https://placehold.co/52x52/e6f7ee/00b14f?text=%F0%9F%8D%9C"}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink">{m.name}</p>
                  {activeTenant === "Semua" && tenantOptions.length > 1 && m.tenant_name && (
                    <p className="truncate text-[10px] font-bold text-chili-dark">{m.tenant_name}</p>
                  )}
                  <p className="text-[11px] text-ink-soft">
                    {rupiah(m.price)}
                    {/* Badge total qty (semua kombinasi add-on digabung) — hanya perlu ditampilkan
                        kalau menu ini punya lebih dari 1 baris di keranjang, supaya kasir tetap
                        tahu totalnya walau sedang lihat kombinasi lain. */}
                    {hasAddons && totalQty > 0 && linesForMenu.length > 1 && (
                      <span className="ml-1.5 font-bold text-chili-dark">· total {totalQty}</span>
                    )}
                  </p>
                </div>
                {outOfStock ? (
                  <span className="shrink-0 rounded-lg bg-chili/10 px-2.5 py-1.5 text-[11px] font-bold text-chili-dark">
                    {stanClosed ? "Stan Tutup" : "Habis"}
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => removeUnit(m)}
                      disabled={draftQty === 0}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-ink/8 text-ink disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center text-[13px] font-bold text-ink">{draftQty}</span>
                    <button
                      onClick={() => addUnit(m)}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-r from-chili to-guava text-white"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
              </div>

              {hasAddons && !outOfStock && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-dashed border-ink/10 pt-2">
                  {m.addons.map((a) => {
                    const active = (draftAddons[m.id] || new Set()).has(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleDraftAddon(m.id, a.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          active ? "bg-chili text-white" : "bg-ink/6 text-ink-soft"
                        }`}
                      >
                        + {a.name}
                        {a.extra_price > 0 ? ` (${rupiah(a.extra_price)})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rincian per kombinasi add-on yang sudah masuk keranjang untuk menu ini —
                  masing-masing baris punya +/- & hapus sendiri, independen dari baris lain.
                  Contoh: "3× + Extra Telur" dan "2× Tanpa tambahan" tampil terpisah. */}
              {hasAddons && linesForMenu.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-dashed border-ink/10 pt-2">
                  {linesForMenu.map((l) => (
                    <div key={l.lineId} className="flex items-center justify-between gap-2 rounded-lg bg-cream px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink/80">
                        {l.addonNames.length > 0 ? `+ ${l.addonNames.join(", ")}` : "Tanpa tambahan"}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => changeLineQty(l.lineId, -1)}
                          className="grid h-6 w-6 place-items-center rounded-md bg-ink/8 text-ink"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-4 text-center text-[12px] font-bold text-ink">{l.qty}</span>
                        <button
                          onClick={() => changeLineQty(l.lineId, 1)}
                          className="grid h-6 w-6 place-items-center rounded-md bg-ink/8 text-ink"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => removeLine(l.lineId)}
                          aria-label="Hapus baris ini"
                          className="grid h-6 w-6 place-items-center rounded-md bg-chili/10 text-chili-dark"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {cartItems.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-ink/5 lg:mt-0 lg:sticky lg:top-4">
          <h3 className="mb-3 flex items-center gap-1.5 font-display text-[14px] font-extrabold text-ink">
            <Receipt size={15} className="text-chili-dark" /> Ringkasan Pesanan
          </h3>

          <div className="mb-3 space-y-1.5">
            {distinctTenantsInCart > 1 && (
              <p className="mb-1.5 rounded-lg bg-chili/10 px-2.5 py-1.5 text-[11px] font-semibold text-chili-dark">
                Transaksi gabungan {distinctTenantsInCart} stan — otomatis dipecah jadi pesanan terpisah per
                stan saat dikirim ke dapur.
              </p>
            )}
            {cartItems.map((i) => (
              <div key={i.lineId} className="flex items-center justify-between gap-2 text-[12.5px] text-ink/80">
                <span className="min-w-0 flex-1 truncate">
                  {i.name}
                  {distinctTenantsInCart > 1 && i.tenant_name && (
                    <span className="text-chili-dark"> · {i.tenant_name}</span>
                  )}
                  <span className="text-ink-soft"> ({i.addonNames.length > 0 ? `+${i.addonNames.join(", ")}` : "tanpa topping"})</span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => changeLineQty(i.lineId, -1)}
                    className="grid h-5.5 w-5.5 place-items-center rounded-md bg-ink/8 text-ink"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="w-4 text-center text-[12px] font-bold text-ink">{i.qty}</span>
                  <button
                    onClick={() => changeLineQty(i.lineId, 1)}
                    className="grid h-5.5 w-5.5 place-items-center rounded-md bg-ink/8 text-ink"
                  >
                    <Plus size={10} />
                  </button>
                  <span className="w-16 shrink-0 text-right font-ticket font-semibold">{rupiah(i.subtotal)}</span>
                  <button
                    onClick={() => removeLine(i.lineId)}
                    aria-label="Hapus item ini"
                    className="grid h-5.5 w-5.5 place-items-center rounded-md bg-chili/10 text-chili-dark"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between border-t border-dashed border-ink/15 pt-3">
            <span className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Total</span>
            <span className="font-ticket text-[16px] font-extrabold text-ink">{rupiah(total)}</span>
          </div>

          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            Nama Pelanggan (opsional)
          </label>
          <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-cream px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <User size={15} className="text-ink-soft" />
            <input
              type="text"
              placeholder="Pelanggan Kasir"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-transparent py-2.5 text-[14px] text-ink focus:outline-none"
            />
          </div>

          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            No. HP Pelanggan (opsional)
          </label>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-cream px-3.5 ring-1 ring-ink/10 focus-within:ring-chili">
            <Phone size={15} className="text-ink-soft" />
            <input
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-transparent py-2.5 text-[14px] text-ink focus:outline-none"
            />
          </div>

          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            Metode Pembayaran
          </label>
          <div className="mb-3 flex gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPaymentMethod(pm.id)}
                className={`flex-1 rounded-xl py-2.5 text-[12.5px] font-bold transition ${
                  paymentMethod === pm.id ? "bg-ink text-cream" : "bg-cream text-ink-soft ring-1 ring-ink/10"
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>

          <label className="mb-4 flex items-center gap-2 rounded-xl bg-cream px-3.5 py-2.5 ring-1 ring-ink/10">
            <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="h-4 w-4 accent-chili" />
            <span className="text-[12.5px] font-semibold text-ink">Sudah dibayar sekarang (tandai lunas)</span>
          </label>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[14px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Buat Pesanan & Kirim ke Dapur"}
          </button>
          {error && <p className="mt-2 text-center text-[13px] font-semibold text-chili-dark">{error}</p>}
        </div>
      )}
    </div>
  );
}

