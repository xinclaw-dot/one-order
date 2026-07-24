import { MessageCircle, Flame, CheckCheck, Ban, Smartphone, UserRound, Zap, CalendarClock } from "lucide-react";
import { rupiah, formatWIBTime } from "../../lib/format";

const STATUS_STYLE = {
  pending: { dot: "bg-mango", label: "Pending" },
  diproses: { dot: "bg-sky", label: "Diproses" },
  selesai: { dot: "bg-status-done", label: "Selesai" },
  dibatalkan: { dot: "bg-status-cancel", label: "Dibatalkan" },
};

const SOURCE_STYLE = {
  self: { label: "Self Order", icon: Smartphone, dot: "bg-mango" },
  kasir: { label: "Kasir", icon: UserRound, dot: "bg-sky" },
};

// Rotating color palette for the ticket header — every queue/order card gets a
// different color, mirroring a classic Kitchen Display System board.
const CARD_PALETTE = [
  { header: "#ef4444", soft: "#fef2f2" }, // red
  { header: "#f97316", soft: "#fff7ed" }, // orange
  { header: "#f59e0b", soft: "#fffbeb" }, // amber
  { header: "#22c55e", soft: "#f0fdf4" }, // green
  { header: "#14b8a6", soft: "#f0fdfa" }, // teal
  { header: "#3b82f6", soft: "#eff6ff" }, // blue
  { header: "#8b5cf6", soft: "#f5f3ff" }, // violet
  { header: "#ec4899", soft: "#fdf2f8" }, // pink
];

export default function OrderTicket({ order, index = 0, onUpdateStatus, onSendWA }) {
  const s = STATUS_STYLE[order.status] || STATUS_STYLE.pending;
  const src = SOURCE_STYLE[order.order_source] || SOURCE_STYLE.self;
  const SrcIcon = src.icon;
  const faded = order.status === "selesai" || order.status === "dibatalkan";
  const code = order.order_code || `#${order.daily_order_number}`;
  const isOpenOrder = order.status === "pending" || order.status === "diproses";
  const palette = CARD_PALETTE[index % CARD_PALETTE.length];

  // Selesaikan pesanan tanpa kirim notif apa pun — cukup ubah status, tidak ada embel-embel lain.
  function handleSelesai() {
    onUpdateStatus(order, "selesai");
  }

  // Selesaikan pesanan SEKALIGUS langsung buka WhatsApp untuk infokan ke pelanggan.
  function handleSelesaiWA() {
    onUpdateStatus(order, "selesai");
    onSendWA({ ...order, status: "selesai" });
  }

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${
        faded ? "grayscale-[0.55] opacity-80" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 px-3.5 py-3" style={{ backgroundColor: palette.header }}>
        <div className="flex items-baseline gap-1.5">
          <span className="font-ticket text-xl font-extrabold text-white">{code}</span>
          {order.status === "pending" && <Flame size={13} className="text-white" />}
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ color: palette.header }}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${order.status === "pending" ? "animate-pulse-dot" : ""}`} />
          {s.label}
        </span>
      </div>

      <div className="px-3.5 pt-2.5" style={{ backgroundColor: palette.soft }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[13px] font-bold text-ink">{order.user_name}</p>
          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink">
            <span className={`h-1.5 w-1.5 rounded-full ${src.dot}`} />
            <SrcIcon size={10} /> {src.label}
          </span>
          {order.payment_status && (
            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink">
              <span className={`h-1.5 w-1.5 rounded-full ${order.payment_status === "paid" ? "bg-status-done" : "bg-status-cancel"}`} />
              {order.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium text-ink/70">
          {order.user_phone} · {order.payment_method.toUpperCase()}
        </p>
        {order.pickup_type === "scheduled" && order.pickup_time && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-bold" style={{ color: palette.header }}>
            <CalendarClock size={11} /> Diambil jam {formatWIBTime(order.pickup_time)} WIB
          </p>
        )}
        {order.pickup_type !== "scheduled" && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink/50">
            <Zap size={11} /> Diambil sekarang
          </p>
        )}
      </div>

      <div
        className="mx-3.5 mt-3 flex-1 space-y-1.5 border-t border-dashed pt-3"
        style={{ borderColor: palette.header + "40" }}
      >
        {order.items.map((item) => (
          <div key={item.id} className="text-[12.5px] text-ink">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">
                {item.qty}× {item.menu_name}
              </span>
            </div>
            <div className="text-[11px] font-medium text-ink/70">
              {item.addons?.length > 0 ? `+ ${item.addons.map((a) => a.addon_name).join(", ")}` : "(tanpa topping)"}
            </div>
            {item.note && <div className="text-[11px] italic" style={{ color: palette.header }}>"{item.note}"</div>}
          </div>
        ))}
      </div>

      <div
        className="mx-3.5 mt-3 flex items-center justify-between border-t border-dashed pt-3"
        style={{ borderColor: palette.header + "40" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink/60">Total</span>
        <span className="font-ticket text-[15px] font-extrabold text-ink">{rupiah(order.total)}</span>
      </div>

      <div className="mx-3.5 mb-2 mt-3 flex gap-2">
        {isOpenOrder && (
          <button
            onClick={handleSelesai}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-guava py-2 text-[12px] font-bold text-ink active:scale-95"
          >
            <CheckCheck size={13} /> Selesai
          </button>
        )}
        {isOpenOrder && (
          <button
            onClick={() => onUpdateStatus(order, "dibatalkan")}
            className="flex items-center justify-center gap-1 rounded-lg bg-ink/5 px-3 py-2 text-[12px] font-bold text-chili-dark active:scale-95"
          >
            <Ban size={13} />
          </button>
        )}
      </div>
      {isOpenOrder && order.order_source !== "kasir" && (
        <div className="mx-3.5 mb-3.5">
          <button
            onClick={handleSelesaiWA}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25d366] py-2 text-[12px] font-bold text-white active:scale-95"
          >
            <MessageCircle size={13} />
            Selesai &amp; Kirim WA
          </button>
        </div>
      )}
    </div>
  );
}
