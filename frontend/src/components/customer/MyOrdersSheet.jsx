import { RefreshCw, Zap, CalendarClock, ReceiptText } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { rupiah, formatWIBTime } from "../../lib/format";

const STATUS_STYLE = {
  pending: { dot: "bg-mango", label: "Menunggu Diproses" },
  diproses: { dot: "bg-sky", label: "Sedang Diproses" },
  selesai: { dot: "bg-status-done", label: "Selesai" },
  dibatalkan: { dot: "bg-status-cancel", label: "Dibatalkan" },
};

export default function MyOrdersSheet({ open, onClose, orders, loading, onRefresh }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-extrabold">Pesanan Saya</h3>
        <button
          onClick={onRefresh}
          aria-label="Segarkan"
          className="rounded-lg p-1.5 text-ink/60 transition hover:bg-ink/5 active:scale-95"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && orders.length === 0 && <p className="mt-6 text-center text-sm text-ink-soft">Memuat pesanan...</p>}

      {!loading && orders.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          <ReceiptText size={28} className="text-ink/25" />
          <p className="text-sm text-ink-soft">Belum ada riwayat pesanan.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-3 space-y-3">
          {orders.map((order) => {
            const s = STATUS_STYLE[order.status] || STATUS_STYLE.pending;
            const isScheduled = order.pickup_type === "scheduled" && order.pickup_time;
            return (
              <div key={`${order.tenant_slug || "t"}-${order.id}`} className="rounded-2xl bg-white p-3.5 ring-1 ring-ink/8">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-ticket text-[16px] font-extrabold text-chili-dark">
                    {order.order_code || `#${order.daily_order_number}`}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
                {order.tenant_name && (
                  <p className="mt-0.5 text-[11px] font-bold text-ink-soft">{order.tenant_name}</p>
                )}

                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                  {isScheduled ? <CalendarClock size={11} /> : <Zap size={11} />}
                  {isScheduled ? `Diambil jam ${formatWIBTime(order.pickup_time)} WIB` : "Diambil sekarang"}
                  <span>·</span>
                  <span>{order.payment_method?.toUpperCase()}</span>
                  <span>·</span>
                  <span>{order.payment_status === "paid" ? "Lunas" : "Belum Bayar"}</span>
                </div>

                <div className="mt-2.5 space-y-1 border-t border-dashed border-ink/10 pt-2.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="text-[12px] text-ink">
                      <span className="font-semibold">
                        {item.qty}× {item.menu_name}
                      </span>
                      <span className="text-ink-soft">
                        {" "}
                        ({item.addons?.length > 0 ? item.addons.map((a) => a.addon_name).join(", ") : "tanpa topping"})
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-ink/10 pt-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Total</span>
                  <span className="font-ticket text-[14px] font-extrabold text-ink">{rupiah(order.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
