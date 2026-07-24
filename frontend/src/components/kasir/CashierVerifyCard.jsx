import { useState } from "react";
import { CheckCircle2, Loader2, Smartphone, Printer, ChevronDown } from "lucide-react";
import { rupiah } from "../../lib/format";

// Kartu verifikasi yang sengaja dibuat minimal: kasir cukup melihat nomor antrian
// (yang disebutkan pelanggan self-order saat datang ke kasir) lalu tekan verifikasi.
// Rincian item disembunyikan di balik dropdown (bukan langsung ditampilkan), supaya
// proses di depan kasir tetap cepat & simpel, tapi tetap bisa dicek kalau perlu.
export default function CashierVerifyCard({ order, onVerify, verifying, onReprint }) {
  const [expanded, setExpanded] = useState(false);
  const code = order.order_code || `#${order.daily_order_number}`;
  const items = order.items || [];

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-status-cancel/30">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mango/20 text-chili-dark">
            <Smartphone size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-ticket text-2xl font-extrabold leading-none text-ink">{code}</p>
            <p className="truncate text-[11.5px] text-ink-soft">{order.user_name}</p>
            {order.tenant_name && (
              <p className="truncate text-[10.5px] font-bold text-chili-dark">{order.tenant_name}</p>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Sembunyikan rincian pesanan" : "Lihat rincian pesanan"}
            aria-expanded={expanded}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink/8 text-ink active:scale-95"
          >
            <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        {onReprint && (
          <button
            onClick={() => onReprint(order)}
            aria-label="Cetak nota"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink/8 text-ink active:scale-95"
          >
            <Printer size={15} />
          </button>
        )}

        <button
          onClick={() => onVerify(order)}
          disabled={verifying}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-matcha px-4 py-2.5 text-[12.5px] font-bold text-white active:scale-95 disabled:opacity-50"
        >
          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Verifikasi
        </button>
      </div>

      {expanded && items.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-dashed border-ink/10 pt-3">
          {items.map((item) => {
            const addonsTotal = (item.addons || []).reduce((s, a) => s + (a.addon_price || 0), 0);
            const subtotal = (item.menu_price + addonsTotal) * item.qty;
            return (
              <div key={item.id} className="text-[12.5px] text-ink">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">
                    {item.qty}× {item.menu_name}
                  </span>
                  <span className="font-ticket font-semibold">{rupiah(subtotal)}</span>
                </div>
                <div className="text-[11px] font-medium text-ink-soft">
                  {item.addons?.length > 0 ? `+ ${item.addons.map((a) => a.addon_name).join(", ")}` : "(tanpa topping)"}
                </div>
                {item.note && <div className="text-[11px] italic text-ink-soft">"{item.note}"</div>}
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t border-dashed border-ink/10 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Total Pembayaran</span>
            <span className="font-ticket text-[15px] font-extrabold text-ink">{rupiah(order.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
