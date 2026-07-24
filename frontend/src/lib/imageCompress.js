// Compress & resize gambar produk di browser SEBELUM diupload ke server,
// supaya foto besar dari kamera HP (bisa 3-8MB) tidak ikut tersimpan penuh
// di Cloudinary dan bikin halaman menu berat saat dimuat.
//
// Hanya memproses file bertipe image/* biasa (jpg, png, webp, dst).
// GIF sengaja dilewati apa adanya supaya animasinya tidak rusak (canvas
// hanya bisa menggambar 1 frame).

const MAX_DIMENSION = 1280; // px, cukup tajam untuk kartu menu & preview admin
const JPEG_QUALITY = 0.8;
const SKIP_IF_UNDER_BYTES = 300 * 1024; // file yang sudah <300KB tidak perlu dikompres lagi

// options.format: "jpeg" (default, dipakai untuk FOTO seperti menu — cocok
// dikompres lossy) atau "png" (LOSSLESS, wajib untuk gambar QR Code supaya
// tepi kotak hitam-putihnya tidak jadi blur/pecah kena artefak JPEG — blur
// sekecil apa pun bisa bikin scanner QRIS gagal baca).
export async function compressImage(file, options = {}) {
  const {
    format = "jpeg",
    maxDimension = MAX_DIMENSION,
    quality = JPEG_QUALITY,
    skipIfUnderBytes = SKIP_IF_UNDER_BYTES,
  } = options;

  if (!file || !file.type?.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.size <= skipIfUnderBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve) =>
      // PNG di canvas.toBlob() selalu lossless — parameter quality diabaikan browser untuk PNG.
      canvas.toBlob(resolve, mimeType, format === "png" ? undefined : quality)
    );

    // Kalau hasil kompresi ternyata malah lebih besar (jarang, tapi bisa
    // terjadi pada gambar yang sudah sangat teroptimasi), pakai file asli saja.
    if (!blob || blob.size >= file.size) return file;

    const ext = format === "png" ? ".png" : ".jpg";
    const newName = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([blob], newName, { type: mimeType });
  } catch {
    // Kalau proses kompresi gagal (browser lama, dsb), tetap lanjut upload file asli
    // daripada memblokir admin menambah menu.
    return file;
  }
}
