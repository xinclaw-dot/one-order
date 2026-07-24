// Menyisipkan parameter transformasi Cloudinary ke URL gambar yang sudah
// tersimpan, supaya yang diunduh browser adalah versi kecil & format modern
// (WebP/AVIF otomatis) sesuai ukuran tampilnya — BUKAN file aslinya.
//
// Ini juga otomatis "menyembuhkan" foto-foto yang sudah pernah diupload
// sebelumnya (sebelum ada kompresi di sisi upload), karena transformasi
// dilakukan Cloudinary secara on-the-fly saat gambar diminta, tanpa perlu
// upload ulang.
//
// Contoh: https://res.cloudinary.com/demo/image/upload/v123/menu/foo.jpg
//      -> https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/v123/menu/foo.jpg
export function optimizedImageUrl(url, width = 200) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}
