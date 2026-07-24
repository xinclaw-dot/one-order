import { ShoppingBag } from "lucide-react";
import { rupiah } from "../../lib/format";

export default function CartBar({ count, total, onOpen }) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
      <button
        onClick={onOpen}
        className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-4 text-cream shadow-[0_10px_30px_rgba(21,15,30,0.4)] transition active:scale-[0.98]"
      >
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-chili to-guava">
            <ShoppingBag size={15} />
            <span className="absolute -right-1.5 -top-1.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-mango px-1 text-[10px] font-extrabold text-ink">
              {count}
            </span>
          </span>
          Lihat Keranjang
        </span>
        <span className="font-ticket text-[14px] font-bold text-mango">{rupiah(total)}</span>
      </button>
    </div>
  );
}
