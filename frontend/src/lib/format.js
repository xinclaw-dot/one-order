export function rupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

export function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h >= 11 && h < 15) return "Selamat siang";
  if (h >= 15 && h < 19) return "Selamat sore";
  return "Selamat malam";
}

export function formatDateLabel(dateStr) {
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${bulan[m - 1]}`;
}

export function maxOf(arr, key) {
  if (!arr || arr.length === 0) return 1;
  return Math.max(...arr.map((item) => item[key] || 0), 1);
}

// Ubah datetime UTC dari server (format SQLite "YYYY-MM-DD HH:MM:SS", tanpa timezone marker)
// menjadi jam WIB "HH:MM". Dipakai untuk menampilkan jam pengambilan (pickup_time) yang dijadwalkan.
export function formatWIBTime(utcDatetimeStr) {
  if (!utcDatetimeStr) return "";
  const iso = utcDatetimeStr.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Format datetime yang SUDAH dalam WIB (format "YYYY-MM-DD HH:MM:SS", tanpa timezone marker)
// menjadi label "18 Jul 2026, 14:30". Dipakai untuk data seperti tanggal daftar customer.
export function formatDateTimeLabelWIB(wibDatetimeStr) {
  if (!wibDatetimeStr) return "-";
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [datePart, timePart] = wibDatetimeStr.split(" ");
  if (!datePart) return "-";
  const [y, m, d] = datePart.split("-").map(Number);
  const hm = (timePart || "").slice(0, 5);
  return `${d} ${bulan[m - 1]} ${y}${hm ? `, ${hm}` : ""}`;
}
