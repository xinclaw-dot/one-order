import { Clock, MapPinOff } from "lucide-react";

export default function StoreClosedScreen({ status }) {
  const isManual = status?.reason === "manual";
  const isDayOff = status?.reason === "day_off";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white text-ink">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-chili/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-32 h-64 w-64 rounded-full bg-guava/15 blur-3xl" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <span className="mb-5 grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-black p-1.5 shadow-lg shadow-ink/10 ring-1 ring-ink/10">
          <img src="/logo.png" alt="Orderin Aja" className="h-full w-full object-contain" />
        </span>

        <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-ink/5">
          {isManual || isDayOff ? <MapPinOff size={26} className="text-chili-dark" /> : <Clock size={26} className="text-chili-dark" />}
        </span>

        <h1 className="font-display text-[22px] font-extrabold leading-tight text-ink">Orderin Aja sedang tutup</h1>

        <p className="mt-2 max-w-xs text-sm text-ink-soft">
          {isManual
            ? status?.manual_closed_note
              ? status.manual_closed_note
              : "Toko sedang tutup sementara. Silakan coba lagi nanti."
            : isDayOff
            ? "Toko libur hari ini. Yuk mampir lagi besok ya 🙏"
            : `Kami buka hari ini pukul ${status?.open_time} - ${status?.close_time} WIB. Yuk mampir lagi nanti ya 🙏`}
        </p>

        {!isManual && !isDayOff && (
          <div className="mt-6 rounded-2xl bg-ink/5 px-5 py-3 ring-1 ring-ink/10">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft/70">Jam Operasional Hari Ini</p>
            <p className="mt-1 font-ticket text-[16px] font-bold text-ink">
              {status?.open_time} - {status?.close_time} WIB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
