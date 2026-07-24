import { useEffect, useRef, useState } from "react";
import { Volume2, FileAudio, Trash2, Save, Play } from "lucide-react";

export default function NotificationSoundSettings({ soundUrl, onSave, saving, uploading, error, onFileSelect }) {
  const [preview, setPreview] = useState(soundUrl || "");
  const audioRef = useRef(null);

  // Sinkronkan preview kalau soundUrl dari server berubah (mis. setelah upload/hapus selesai)
  useEffect(() => {
    setPreview(soundUrl || "");
  }, [soundUrl]);

  function handleRemove() {
    onSave({ notification_sound_url: "" });
  }

  function handleTestPlay() {
    audioRef.current?.play().catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <Volume2 size={16} className="text-chili-dark" /> Suara Notifikasi Order Masuk
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Upload file MP3 sendiri untuk dipakai sebagai suara notifikasi di Dashboard Kitchen setiap ada order baru
          masuk. Kalau belum upload apa-apa, sistem otomatis memakai suara default (beep + suara perintah "Woe, ada
          order masuk nih!"). Maksimal ukuran file 2MB.
        </p>

        {preview && (
          <div className="mb-3 flex flex-col items-center gap-2 rounded-xl bg-cream p-4 ring-1 ring-ink/10">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
              <FileAudio size={16} className="text-chili-dark" /> Suara kustom aktif
            </div>
            <audio ref={audioRef} src={preview} preload="none" />
            <div className="flex items-center gap-4">
              <button
                onClick={handleTestPlay}
                className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft hover:text-ink"
              >
                <Play size={13} /> Coba Putar
              </button>
              <button
                onClick={handleRemove}
                disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-bold text-chili-dark disabled:opacity-50"
              >
                <Trash2 size={13} /> Hapus & Pakai Default
              </button>
            </div>
          </div>
        )}

        <label className="mb-2.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 px-3.5 py-3 text-[13px] font-semibold text-ink-soft hover:border-chili/40 hover:text-chili-dark">
          <FileAudio size={16} />
          {preview ? "Ganti File MP3" : "Upload File MP3"}
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,.mp3"
            className="hidden"
            onChange={(e) => {
              onFileSelect(e, (url) => {
                setPreview(url);
                onSave({ notification_sound_url: url });
              });
            }}
          />
        </label>
        {uploading && <p className="mb-1 text-[12px] text-ink-soft">Mengunggah suara...</p>}

        <div className="mt-2 flex items-center gap-2 rounded-xl bg-mango/10 px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-chili-dark">
          <Save size={14} className="shrink-0" /> Tersimpan otomatis begitu upload selesai, dan langsung berlaku di
          semua layar Kitchen yang sedang terbuka.
        </div>
      </div>

      {error && <p className="text-center text-[13px] font-semibold text-status-cancel">{error}</p>}
    </div>
  );
}
