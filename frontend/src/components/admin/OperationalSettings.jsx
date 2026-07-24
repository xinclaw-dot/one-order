import { useEffect, useState } from "react";
import { Clock, MapPinOff, Save } from "lucide-react";
import { DAY_NAMES_ID } from "../../lib/format";

const DEFAULT_DAY = { is_open: true, open_time: "08:00", close_time: "22:00" };

function buildDaysState(hoursFromServer) {
  const byDay = {};
  for (const h of hoursFromServer || []) {
    byDay[h.day_of_week] = {
      is_open: !!h.is_open,
      open_time: h.open_time || "08:00",
      close_time: h.close_time || "22:00",
    };
  }
  // Pastikan tetap ada 7 baris (Minggu-Sabtu) walau data server belum lengkap
  return DAY_NAMES_ID.map((_, dow) => byDay[dow] || { ...DEFAULT_DAY });
}

export default function OperationalSettings({ settings, onSave, saving, error }) {
  const [days, setDays] = useState(() => buildDaysState([]));
  const [manualClosed, setManualClosed] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (settings) {
      setDays(buildDaysState(settings.hours));
      setManualClosed(!!settings.manual_closed);
      setNote(settings.manual_closed_note || "");
    }
  }, [settings]);

  function updateDay(dow, patch) {
    setDays((prev) => prev.map((d, i) => (i === dow ? { ...d, ...patch } : d)));
  }

  function handleSaveHours() {
    onSave({
      hours: days.map((d, dow) => ({
        day_of_week: dow,
        is_open: d.is_open,
        open_time: d.open_time,
        close_time: d.close_time,
      })),
    });
  }

  function handleSaveManual(nextClosed) {
    setManualClosed(nextClosed);
    onSave({ manual_closed: nextClosed, manual_closed_note: note });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <Clock size={16} className="text-chili-dark" /> Jam Operasional per Hari
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Atur jam buka-tutup untuk tiap hari. Matikan toggle kalau toko libur di hari itu — tidak perlu isi jam
          untuk hari yang libur.
        </p>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {DAY_NAMES_ID.map((label, dow) => {
            const d = days[dow] || DEFAULT_DAY;
            return (
              <div key={dow} className="rounded-xl bg-cream p-2.5 ring-1 ring-ink/10">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-ink">{label}</span>
                  <input
                    type="checkbox"
                    checked={d.is_open}
                    onChange={(e) => updateDay(dow, { is_open: e.target.checked })}
                    className="h-4.5 w-8 accent-chili"
                    aria-label={`Buka hari ${label}`}
                  />
                </div>
                {d.is_open ? (
                  <div className="mt-2 flex items-center gap-1">
                    <input
                      type="time"
                      value={d.open_time}
                      onChange={(e) => updateDay(dow, { open_time: e.target.value })}
                      className="w-full min-w-0 rounded-lg bg-white px-1.5 py-1.5 text-[11.5px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
                    />
                    <span className="shrink-0 text-[10px] text-ink-soft">–</span>
                    <input
                      type="time"
                      value={d.close_time}
                      onChange={(e) => updateDay(dow, { close_time: e.target.value })}
                      className="w-full min-w-0 rounded-lg bg-white px-1.5 py-1.5 text-[11.5px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] font-semibold text-status-cancel">Libur seharian</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSaveHours}
          disabled={saving}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-chili to-guava py-3 font-display text-[13.5px] font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
        >
          <Save size={15} /> {saving ? "Menyimpan..." : "Simpan Jam Operasional"}
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <MapPinOff size={16} className="text-chili-dark" /> Tutup Sementara (Manual)
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Aktifkan kalau ada keperluan mendadak (mis. luar kota) supaya toko langsung tertutup, di luar jam operasional biasa.
        </p>

        <label className="mb-3 flex items-center justify-between rounded-xl bg-cream px-3.5 py-3 ring-1 ring-ink/10">
          <span className="text-[13px] font-semibold text-ink">
            {manualClosed ? "Toko sedang ditutup manual" : "Toko beroperasi normal"}
          </span>
          <input
            type="checkbox"
            checked={manualClosed}
            onChange={(e) => handleSaveManual(e.target.checked)}
            className="h-5 w-9 accent-chili"
          />
        </label>

        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          Alasan / pesan untuk pelanggan (opsional)
        </label>
        <textarea
          rows={2}
          placeholder="Contoh: Order One libur, ada acara keluarga di luar kota. Buka lagi besok ya!"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => manualClosed && onSave({ manual_closed: true, manual_closed_note: note })}
          className="w-full rounded-xl bg-cream px-3.5 py-2.5 text-[13.5px] ring-1 ring-ink/10 focus:outline-none focus:ring-chili"
        />
      </div>

      {error && <p className="text-center text-[13px] font-semibold text-chili-dark">{error}</p>}
    </div>
  );
}
