import { Trash2, Banknote, QrCode, Zap, CalendarClock, Minus, Plus } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { rupiah } from "../../lib/format";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

const PAYMENTS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "qris", label: "QRIS", icon: QrCode },
];

export default function CartSheet({
  open,
  onClose,
  cart,
  cartTenantName,
  onRemove,
  onChangeQty,
  total,
  paymentMethod,
  setPaymentMethod,
  pickupType,
  setPickupType,
  pickupTime,
  setPickupTime,
  pickupWindow,
  onSubmit,
  submitting,
  error,
  qrisImageUrl,
}) {
  const minTime = pickupWindow?.minTime;
  const maxTime = pickupWindow?.maxTime;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className="font-display text-lg font-extrabold">Keranjang Kamu</h3>
      {cartTenantName && cart.length > 0 && (
        <p className="mt-0.5 text-[12px] font-semibold text-chili-dark">Pesanan untuk {cartTenantName}</p>
      )}

      {cart.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-soft">Keranjang masih kosong 🛒</p>
      ) : (
        <div className="mt-3 divide-y divide-ink/8">
          {cart.map((ci) => (
            <div key={ci.lineId} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold">{ci.name}</p>
                <p className="text-[11px] text-ink-soft">
                  {ci.addonNames.length > 0 ? `+ ${ci.addonNames.join(", ")}` : "(tanpa topping)"}
                </p>
                {ci.note && <p className="text-[11px] italic text-ink-soft">"{ci.note}"</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-ticket text-[13px] font-bold">{rupiah(ci.subtotal)}</p>
                {/* Qty baris ini berdiri sendiri — mengubahnya tidak memengaruhi baris
                    kombinasi add-on lain dari menu yang sama. */}
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onChangeQty(ci.lineId, -1)}
                    aria-label="Kurangi qty"
                    className="grid h-6 w-6 place-items-center rounded-md bg-ink/8 text-ink active:scale-90"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-4 text-center text-[12px] font-bold text-ink">{ci.qty}</span>
                  <button
                    onClick={() => onChangeQty(ci.lineId, 1)}
                    aria-label="Tambah qty"
                    className="grid h-6 w-6 place-items-center rounded-md bg-ink/8 text-ink active:scale-90"
                  >
                    <Plus size={11} />
                  </button>
                  <button
                    onClick={() => onRemove(ci.lineId)}
                    aria-label="Hapus baris ini"
                    className="ml-1 grid h-6 w-6 place-items-center rounded-md bg-chili/10 text-chili-dark active:scale-90"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <>
          <div className="ticket-edge-bottom mt-2 flex items-center justify-between border-t-2 border-dashed border-ink/15 pt-3">
            <span className="text-[13px] font-bold">Total (estimasi)</span>
            <span className="font-ticket text-lg font-extrabold text-chili-dark">{rupiah(total)}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-soft">Total final dihitung ulang sistem saat pesanan dikirim.</p>

          <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Waktu Pengambilan</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPickupType("now")}
              className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[12px] font-bold ring-1 transition ${
                pickupType === "now" ? "bg-ink text-cream ring-ink" : "bg-white text-ink/60 ring-ink/10"
              }`}
            >
              <Zap size={16} />
              Ambil Sekarang
            </button>
            <button
              onClick={() => setPickupType("scheduled")}
              className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[12px] font-bold ring-1 transition ${
                pickupType === "scheduled" ? "bg-ink text-cream ring-ink" : "bg-white text-ink/60 ring-ink/10"
              }`}
            >
              <CalendarClock size={16} />
              Ambil Nanti
            </button>
          </div>

          {pickupType === "scheduled" && (
            <div className="mt-2.5">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                Jam pengambilan
              </label>
              <input
                type="time"
                value={pickupTime}
                min={minTime}
                max={maxTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[14px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
              />
              {minTime && maxTime && (
                <p className="mt-1 text-[11px] text-ink-soft">Bisa dipilih antara {minTime} - {maxTime} WIB.</p>
              )}
            </div>
          )}

          <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Metode Pembayaran</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENTS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[12px] font-bold ring-1 transition ${
                  paymentMethod === id ? "bg-ink text-cream ring-ink" : "bg-white text-ink/60 ring-ink/10"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {paymentMethod === "qris" && (
            <div className="mt-4 rounded-xl bg-cream p-4 text-center ring-1 ring-ink/10">
              {qrisImageUrl ? (
                <>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                    Scan QRIS untuk bayar
                  </p>
                  <img
                    src={optimizedImageUrl(qrisImageUrl, 400)}
                    alt="QR Code QRIS"
                    className="mx-auto h-48 w-48 rounded-lg bg-white object-contain p-2 ring-1 ring-ink/10"
                  />
                  <p className="mt-3 text-[11px] text-ink-soft">Nominal yang harus dibayar</p>
                  <p className="font-ticket text-xl font-extrabold text-chili-dark">{rupiah(total)}</p>
                  <p className="mt-2 text-[11px] leading-snug text-ink-soft">
                    Setelah kirim pesanan, tunjukkan bukti pembayaran ke kasir untuk diverifikasi.
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-ink-soft">
                  QR Code QRIS belum tersedia. Silakan bayar langsung di kasir.
                </p>
              )}
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[15px] font-extrabold text-white shadow-lg shadow-chili/25 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Kirim Pesanan"}
          </button>
          {error && <p className="mt-3 text-center text-[13px] font-medium text-chili-dark">{error}</p>}
        </>
      )}
    </BottomSheet>
  );
}
