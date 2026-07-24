import { Download, Share, SquarePlus, X } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

// liftPx: geser banner ini ke atas sejauh N piksel, dipakai di halaman Customer supaya
// tidak numpuk dengan tombol "Lihat Keranjang" yang sama-sama fixed di bawah layar.
export default function InstallPrompt({ liftPx = 0 }) {
  const { shouldShow, canPromptNative, showIosHint, promptInstall, dismiss } = useInstallPrompt();

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-x-0 z-[70] flex justify-center px-3 animate-sheet-up sm:px-0"
      style={{ bottom: liftPx, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-ink text-cream shadow-[0_12px_40px_rgba(21,15,30,0.45)]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-chili via-guava to-ink-3 opacity-90" />
        <button
          onClick={dismiss}
          aria-label="Tutup"
          className="absolute right-2 top-2 rounded-full bg-black/20 p-1.5 text-cream/90 transition hover:bg-black/35"
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 p-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black p-1 shadow-lg shadow-black/30 ring-2 ring-white animate-floaty">
            <img src="/icons/icon-192.png" alt="" className="h-full w-full rounded-xl object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-bold leading-tight">Pasang Order One</p>
            <p className="text-[12px] leading-snug text-cream/80">
              {showIosHint && !canPromptNative
                ? "Biar bisa buka langsung dari layar utama, tanpa buka browser."
                : "Akses lebih cepat, langsung dari layar utama HP-mu."}
            </p>
          </div>
        </div>

        {canPromptNative ? (
          <button
            onClick={promptInstall}
            className="flex w-full items-center justify-center gap-2 bg-cream py-3 font-display text-sm font-extrabold text-ink transition active:scale-[0.98]"
          >
            <Download size={16} strokeWidth={2.5} />
            Install Sekarang
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-cream px-4 py-3 text-[12px] font-semibold text-ink">
            <span className="inline-flex items-center gap-1">
              Ketuk <Share size={14} className="inline" />
            </span>
            <span>lalu pilih</span>
            <span className="inline-flex items-center gap-1">
              "Tambah ke Layar Utama" <SquarePlus size={14} className="inline" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
