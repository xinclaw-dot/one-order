import { CheckCircle2, Smartphone, UserRound, Loader2 } from "lucide-react";
import { rupiah } from "../../lib/format";

const SOURCE_STYLE = {
  self: { label: "Self Order", icon: Smartphone, text: "text-chili-dark", bg: "bg-mango/20" },
  kasir: { label: "Kasir", icon: UserRound, text: "text-sky", bg: "bg-sky/15" },
};

export default function CashierOrderCard({ order, onVerify, verifying, readOnly = false }) {
  const src = SOURCE_STYLE[order.order_source] || SOURCE_STYLE.self;
  const SrcIcon = src.icon;
  const isPaid = order.payment_status === "paid";
  const code = order.order_code || `#${order.daily_order_number}`;

  return (
    <div className={`rounded-2xl bg-white p-4 ring-1 ${isPaid ? "ring-matcha/30" : "ring-status-cancel/30"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-ticket text-lg font-extrabold text-ink">{code}</span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${src.text} ${src.bg}`}>
            <SrcIcon size={10} /> {src.label}
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            isPaid ? "bg-matcha/15 text-matcha" : "bg-status-cancel/15 text-status-cancel"
          }`}
        >
          {isPaid ? "Lunas" : "Belum Bayar"}
        </span>
      </div>

      <p className="mt-1.5 text-[13px] font-bold text-ink">{order.user_name}</p>
      <p className="text-[11px] text-ink-soft">
        {order.user_phone} · {order.payment_method?.toUpperCase()}
      </p>

      <div className="mt-2 space-y-1 border-t border-dashed border-ink/10 pt-2">
        {order.items?.map((item) => (
          <p key={item.id} className="text-[12px] text-ink/80">
            {item.qty}× {item.menu_name}
          </p>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-dashed border-ink/10 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Total</span>
        <span className="font-ticket text-[14px] font-extrabold text-ink">{rupiah(order.total)}</span>
      </div>

      {!isPaid && !readOnly && (
        <button
          onClick={() => onVerify(order)}
          disabled={verifying}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-matcha py-2.5 text-[12.5px] font-bold text-white active:scale-95 disabled:opacity-50"
        >
          {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Verifikasi Pembayaran
        </button>
      )}
    </div>
  );
}
