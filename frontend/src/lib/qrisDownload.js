import { rupiah } from "./format";
import { optimizedImageUrl } from "./cloudinaryUrl";

// ============================================================================
// UNDUH QRIS + NOMINAL SEBAGAI SATU GAMBAR
//
// QRIS yang dipakai di sini statis (satu gambar tetap, bukan digenerate per
// transaksi), jadi nominal TIDAK bisa "ditanam" ke dalam kode QR itu sendiri
// (baru bisa kalau pakai QRIS dinamis lewat payment gateway/PJSP).
//
// Sebagai solusi: gambar QR statis digambar ulang di <canvas> bersama teks
// nominal, nama toko, dan catatan "cek ulang nominal sebelum bayar", lalu
// hasil gabungannya diunduh sebagai satu file PNG. Jadi kalau pelanggan
// screenshot/simpan/kirim gambar ini ke orang lain (mis. titip beliin),
// nominal yang harus dibayar ikut terbawa di gambar yang sama — tidak
// terpisah dari QR-nya lagi.
//
// CATATAN CORS: gambar QRIS biasanya disimpan di Cloudinary yang secara
// default mengizinkan akses lintas origin (CORS) untuk URL pengiriman
// gambarnya, sehingga aman digambar ke <canvas> lalu diekspor jadi PNG.
// Kalau suatu saat qris_image_url diganti ke penyedia lain yang tidak
// mengizinkan CORS, browser akan menolak proses export (canvas "tainted")
// dan fungsi ini akan menolak dengan pesan yang jelas ke pemanggil.
// ============================================================================

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar QRIS."));
    img.src = url;
  });
}

// Fallback manual untuk rounded rect, karena ctx.roundRect() belum didukung
// di semua browser lama (mis. Safari < 16, sebagian WebView Android).
function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// storeName: nama toko untuk header gambar.
// total: nominal yang harus dibayar (angka).
// qrisImageUrl: URL gambar QR Code QRIS statis yang sudah diupload Admin.
// orderCode: nomor antrian (mis. "A004"). Opsional — kalau ada, dicetak di
// atas gambar supaya jelas struk/QR ini untuk pesanan yang mana. Berguna
// khususnya untuk kasus titip beli: gambar bisa dikirim ke orang lain yang
// bayarkan, dan mereka (atau kasir) tetap bisa mencocokkan ke nomor antrian
// yang benar walau tanpa membuka aplikasi.
// orderDateLabel: label tanggal & jam pemesanan yang SUDAH diformat (mis.
// "18 Jul 2026, 18:12"). Opsional, tampil berdampingan dengan nomor antrian.
// fileName: nama file hasil unduhan (tanpa ekstensi).
//
// Return: Promise<void> — melempar Error kalau gagal (mis. QR belum ada,
// gambar gagal dimuat, atau canvas tidak bisa diekspor karena CORS).
export async function downloadQrisWithAmount({
  qrisImageUrl,
  total,
  storeName,
  orderCode,
  orderDateLabel,
  fileName = "qris-pembayaran",
}) {
  if (!qrisImageUrl) throw new Error("QR Code QRIS belum tersedia.");

  // Gambar QR digambar ke kotak 480x480px di bawah (qrSize) — minta versi
  // Cloudinary 640px (bukan file aslinya yang bisa berupa screenshot HP
  // beresolusi jauh lebih besar) supaya tetap lebih dari cukup tajam untuk
  // di-scan, tanpa mengunduh byte yang tidak akan pernah kepakai.
  const img = await loadImage(optimizedImageUrl(qrisImageUrl, 640));

  const width = 640;
  const qrSize = 480;
  const padding = 32;
  const hasOrderInfo = Boolean(orderCode || orderDateLabel);
  const orderInfoHeight = hasOrderInfo ? 56 : 0;
  const headerHeight = 90 + orderInfoHeight;
  const qrTop = headerHeight;
  const footerHeight = 170;
  const height = qrTop + qrSize + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pembuatan gambar (canvas).");

  // Latar putih penuh
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header: nama toko
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(storeName || "QRIS Pembayaran", width / 2, 48);
  ctx.font = "600 15px sans-serif";
  ctx.fillStyle = "#666666";
  ctx.fillText("Scan untuk bayar", width / 2, 74);

  // Kartu info nomor antrian + tanggal pemesanan (kalau tersedia) — supaya
  // gambar ini tetap bisa dicocokkan ke pesanan yang benar walau dikirim
  // terpisah dari aplikasi (mis. lewat chat ke orang yang titip bayarkan).
  if (hasOrderInfo) {
    const cardTop = 88;
    const cardHeight = orderInfoHeight - 12;
    ctx.fillStyle = "#fdf3ec";
    roundedRectPath(ctx, padding, cardTop, width - padding * 2, cardHeight, 10);
    ctx.fill();

    const midY = cardTop + cardHeight / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#666666";
    ctx.font = "600 12px sans-serif";
    if (orderCode) {
      ctx.fillText("NO. ANTRIAN", padding + 18, midY - 6);
      ctx.fillStyle = "#c0392b";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(orderCode, padding + 18, midY + 16);
    }
    if (orderDateLabel) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#666666";
      ctx.font = "600 12px sans-serif";
      ctx.fillText("TANGGAL PESAN", width - padding - 18, midY - 6);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 15px sans-serif";
      ctx.fillText(orderDateLabel, width - padding - 18, midY + 16);
    }
    ctx.textAlign = "center";
  }

  // Kotak QR (dengan border tipis)
  //
  // PENTING untuk keterbacaan scanner: matikan smoothing/anti-aliasing
  // canvas SEBELUM menggambar QR. Secara default, browser menghaluskan
  // (blur) gambar saat diperbesar/diskalakan di canvas — untuk foto biasa
  // ini bagus, tapi untuk QR code blur ini justru merusak tepi kotak-kotak
  // hitam-putihnya sehingga sebagian besar scanner QR (termasuk scanner
  // QRIS bank/e-wallet) gagal membaca polanya. Ini penyebab sebenarnya
  // "gambar tidak bisa di-scan" — BUKAN karena format file PNG. PNG dipilih
  // secara sengaja karena losless (tanpa kompresi yang merusak detail),
  // beda dengan JPEG yang justru lebih buruk untuk QR karena kompresinya
  // menghaluskan/mendistorsi tepi kotak lewat chroma subsampling.
  const qrX = (width - qrSize) / 2;
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 2;
  ctx.strokeRect(qrX - 1, qrTop - 1, qrSize + 2, qrSize + 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, qrX, qrTop, qrSize, qrSize);
  ctx.imageSmoothingEnabled = true; // balikin lagi untuk elemen teks/lengkung lain di bawah

  // Garis pemisah
  const dividerY = qrTop + qrSize + 24;
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(padding, dividerY);
  ctx.lineTo(width - padding, dividerY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label nominal
  ctx.fillStyle = "#666666";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("NOMINAL YANG HARUS DIBAYAR", width / 2, dividerY + 34);

  // Nominal besar
  ctx.fillStyle = "#c0392b";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(rupiah(total), width / 2, dividerY + 78);

  // Catatan kecil
  ctx.fillStyle = "#999999";
  ctx.font = "13px sans-serif";
  ctx.fillText("Pastikan nominal di atas sama dengan yang kamu ketik saat bayar.", width / 2, dividerY + 108);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Gagal mengekspor gambar (kemungkinan dibatasi CORS)."));
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
