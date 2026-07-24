import { useEffect, useState } from "react";
import { QrCode, ImagePlus, Trash2, Save } from "lucide-react";
import { optimizedImageUrl } from "../../lib/cloudinaryUrl";

export default function QrisSettings({ qrisImageUrl, onSave, saving, uploading, error, onFileSelect }) {
  const [preview, setPreview] = useState(qrisImageUrl || "");

  // Sinkronkan preview kalau qrisImageUrl dari server berubah (mis. setelah upload/hapus selesai)
  useEffect(() => {
    setPreview(qrisImageUrl || "");
  }, [qrisImageUrl]);

  function handleRemove() {
    onSave({ qris_image_url: "" });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
        <h3 className="mb-1 flex items-center gap-1.5 font-display text-[15px] font-extrabold">
          <QrCode size={16} className="text-chili-dark" /> QR Code QRIS
        </h3>
        <p className="mb-3 text-[12px] text-ink-soft">
          Upload gambar QR Code QRIS toko kamu. QR ini akan otomatis muncul di halaman Customer setiap kali
          pelanggan memilih metode pembayaran QRIS, lengkap dengan nominal yang harus dibayar.
        </p>

        {preview && (
          <div className="mb-3 flex flex-col items-center gap-2 rounded-xl bg-cream p-4 ring-1 ring-ink/10">
            <img src={optimizedImageUrl(preview, 400)} alt="QR Code QRIS" className="h-48 w-48 rounded-lg bg-white object-contain p-2 ring-1 ring-ink/10" />
            <button
              onClick={handleRemove}
              disabled={saving}
              className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-chili-dark disabled:opacity-50"
            >
              <Trash2 size={13} /> Hapus QR Code
            </button>
          </div>
        )}

        <label className="mb-2.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 px-3.5 py-3 text-[13px] font-semibold text-ink-soft hover:border-chili/40 hover:text-chili-dark">
          <ImagePlus size={16} />
          {preview ? "Ganti QR Code" : "Upload QR Code QRIS"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFileSelect(e, (url) => {
                setPreview(url);
                onSave({ qris_image_url: url });
              });
            }}
          />
        </label>
        {uploading && <p className="mb-1 text-[12px] text-ink-soft">Mengunggah gambar...</p>}

        <div className="mt-2 flex items-center gap-2 rounded-xl bg-mango/10 px-3.5 py-2.5 text-[12px] font-semibold leading-snug text-chili-dark">
          <Save size={14} className="shrink-0" /> Tersimpan otomatis begitu upload selesai.
        </div>
      </div>

      {error && <p className="text-center text-[13px] font-semibold text-status-cancel">{error}</p>}
    </div>
  );
}
