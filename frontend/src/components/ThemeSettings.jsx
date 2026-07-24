import { Palette, Check } from "lucide-react";
import { THEME_PRESETS } from "../../lib/theme";

export default function ThemeSettings({ currentPreset, onSave, saving, error }) {
  const active = currentPreset || "hijau";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <Palette size={16} className="text-chili-dark" /> Warna Dasar Aplikasi
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Pilih warna tema untuk semua halaman (Customer, Kasir, Kitchen, Admin). Perubahan langsung berlaku
          real-time di semua layar yang sedang terbuka, tanpa perlu refresh.
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {Object.entries(THEME_PRESETS).map(([id, preset]) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                disabled={saving}
                onClick={() => onSave({ theme_preset: id })}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-3 ring-1 transition disabled:opacity-50 ${
                  isActive ? "ring-2 ring-ink bg-cream" : "ring-ink/10 bg-white active:scale-95"
                }`}
              >
                <span
                  className="relative grid h-9 w-9 place-items-center rounded-full"
                  style={{ backgroundColor: preset.swatch }}
                >
                  {isActive && <Check size={16} className="text-white" strokeWidth={3} />}
                </span>
                <span className="text-[11.5px] font-bold text-ink">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-center text-[13px] font-semibold text-status-cancel">{error}</p>}
    </div>
  );
}
