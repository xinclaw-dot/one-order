import { useState } from "react";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { rupiah } from "../../lib/format";

// Pop up konfirmasi cetak struk. Ditampilkan setiap kali pesanan baru berhasil
// dibuat / pembayaran diverifikasi, supaya kasir SELALU dapat notifikasi visual
// yang jelas (bukan cuma berharap dialog print bawaan browser muncul, yang di
// sebagian HP/browser bisa gagal tampil tanpa pesan apa pun).
export default function ReceiptPrintModal({ orders, onPrint, onClose }) {
  const [printed, setPrinted] = useState(false);

  if (!orders || orders.length === 0) return null;

  const codeLine = orders.map((o) => o.order_code || `#${o.daily_order_number}`).join(", ");
  const grandTotal = orders.reduce((s, o) => s + (o.total || 0), 0);
  const multiStan = orders.length > 1;

  function handlePrintClick() {
    onPrint();
    setPrinted(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-0 backdrop-blur-sm sm:items-center sm:px-4"
    >
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-6 shadow-xl animate-pop-in sm:rounded-3xl">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-matcha/15 text-matcha">
            <CheckCircle2 size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[15px] font-extrabold leading-tight text-ink">
              Pesanan berhasil dibuat{multiStan ? ` (${orders.length} stan)` : ""}
            </p>
            <p className="truncate text-[12px] text-ink-soft">
              No. Antrian <b>{codeLine}</b> · {rupiah(grandTotal)}
            </p>
            {multiStan && (
              <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                {orders.map((o) => o.tenant_name).join(" · ")}
              </p>
            )}
          </div>
        </div>

        <p className="mb-4 text-[12.5px] leading-snug text-ink-soft">
          {printed
            ? "Kalau struk belum keluar dari printer, tekan Cetak Struk lagi. Tekan Selesai untuk lanjut."
            : "Tekan Cetak Struk untuk mencetak nota pelanggan."}
        </p>

        <button
          onClick={handlePrintClick}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3.5 font-display text-[14px] font-extrabold text-white active:scale-[0.98]"
        >
          <Printer size={16} /> {printed ? "Cetak Ulang" : "Cetak Struk"}
        </button>

        <button
          onClick={onClose}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink/8 py-3 text-[13px] font-bold text-ink-soft active:scale-[0.98]"
        >
          <X size={14} /> {printed ? "Selesai" : "Lewati, Tanpa Cetak"}
        </button>
      </div>
    </div>
  );
}
