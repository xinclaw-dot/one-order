import { useState } from "react";
import { PartyPopper, Zap, CalendarClock, Download } from "lucide-react";
import { rupiah, formatWIBTime } from "../../lib/format";
import { downloadQrisWithAmount } from "../../lib/qrisDownload";

const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function SuccessSheet({ order, onReset, qrisImageUrl }) {
  const [downloadingQris, setDownloadingQris] = useState(false);
  const [qrisDownloadError, setQrisDownloadError] = useState("");

  if (!order) return null;
  const isScheduled = order.pickup_type === "scheduled" && order.pickup_time;
  const orderCode = order.order_code || `#${order.daily_order_number}`;

  // Label tanggal + jam pemesanan, mis. "18 Jul 2026, 18:12" — dipakai supaya
  // gambar QRIS yang diunduh bisa dicocokkan ke pesanan yang benar walau
  // dibuka terpisah dari aplikasi (kasus titip beli, dikirim ke orang lain).
  let orderDateLabel = "";
  if (order.order_date) {
    const [y, m, d] = order.order_date.split("-").map(Number);
    orderDateLabel = `${d} ${BULAN_ID[m - 1]} ${y}${order.created_at ? `, ${formatWIBTime(order.created_at)}` : ""}`;
  }

  async function handleDownloadQris() {
    setQrisDownloadError("");
    setDownloadingQris(true);
    try {
      await downloadQrisWithAmount({
        qrisImageUrl,
        total: order.total,
        storeName: order.tenant_name || "Order One",
        orderCode,
        orderDateLabel,
        fileName: `qris-${orderCode}`,
      });
    } catch (err) {
      setQrisDownloadError(err.message || "Gagal mengunduh QR. Coba screenshot layar ini saja.");
    } finally {
      setDownloadingQris(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xs animate-pop-in overflow-hidden rounded-3xl bg-paper shadow-2xl">
        <div className="ticket-edge-bottom bg-gradient-to-br from-chili to-guava px-6 pb-6 pt-7 text-center text-white">
          <PartyPopper className="mx-auto mb-2 animate-floaty" size={32} />
          <p className="font-display text-lg font-extrabold">Pesanan Diterima!</p>
          {order.tenant_name && <p className="text-[12px] font-semibold text-white/85">{order.tenant_name}</p>}
        </div>
        <div className="px-6 pb-6 pt-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft">Nomor Antrian</p>
          <p className="font-ticket text-5xl font-extrabold text-chili-dark">{orderCode}</p>
          <p className="mt-2 text-[13px] text-ink-soft">
            Total: <span className="font-bold text-ink">{rupiah(order.total)}</span>
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-1.5 text-[12px] font-bold text-ink ring-1 ring-ink/10">
            {isScheduled ? <CalendarClock size={14} /> : <Zap size={14} />}
            {isScheduled ? `Diambil jam ${formatWIBTime(order.pickup_time)} WIB` : "Diambil sekarang"}
          </div>

          {order.payment_method === "qris" && qrisImageUrl && (
            <>
              <button
                type="button"
                onClick={handleDownloadQris}
                disabled={downloadingQris}
                className="mx-auto mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-ink/8 px-3.5 py-2 text-[12px] font-bold text-ink-soft active:scale-[0.98] disabled:opacity-50"
              >
                <Download size={13} /> {downloadingQris ? "Menyiapkan..." : "Unduh QRIS + Nominal"}
              </button>
              {qrisDownloadError && <p className="mt-1.5 text-[11px] text-chili-dark">{qrisDownloadError}</p>}
              <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">
                Gambar sudah lengkap dengan nominal, nomor antrian & tanggal — aman dikirim ke orang lain kalau titip
                bayarkan.
              </p>
            </>
          )}

          <div className="mt-4 rounded-xl bg-chili/10 px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-chili-dark">
            Tunjukkan nomor antrian ini ke kasir. Cukup sebutkan nomornya saja, tidak perlu detail pesanan lain.
          </div>

          <button
            onClick={onReset}
            className="mt-5 w-full rounded-xl bg-ink py-3 font-display text-[14px] font-extrabold text-cream active:scale-[0.98]"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    </div>
  );
}
