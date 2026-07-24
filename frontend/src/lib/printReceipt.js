import { rupiah } from "./format";

// ============================================================================
// CETAK STRUK — disamakan dengan pendekatan yang dipakai di Bengkelmu.
//
// KENAPA DIUBAH TOTAL (bukan cuma ditambal): versi sebelumnya mencetak dengan
// membuka TAB BARU (window.open) lalu menulis dokumen struk ke tab itu lewat
// document.write()/Blob URL, baru memanggil window.print() di dalam tab
// tersebut. Pendekatan itu terbukti rapuh khusus di Safari (iPhone/iPad/Mac):
//   - Safari kerap mendiamkan window.open() begitu ada jeda async sebelum
//     dipanggil (kehilangan "user activation" dari tap/klik asli).
//   - Beberapa versi Safari/WebKit gagal menampilkan dokumen hasil navigasi ke
//     blob: URL pada window baru (tab kosong/putih), atau window.print() di
//     dalamnya diam saja tanpa error.
//   - In-app browser (WhatsApp/Instagram) memblokir window.open() sama sekali.
//   - Ditemukan juga kasus Chrome Android salah mencetak halaman Dashboard
//     Kasir (bukan struk) karena iframe/tab tersembunyi tidak dianggap sebagai
//     target print oleh browser.
//
// SOLUSI (persis pola Bengkelmu, web/js/receipt.js + @media print di
// style.css): TIDAK ADA tab baru / window.open / document.write sama sekali.
// Struk dirender langsung ke dalam DOM halaman yang sedang aktif (di sebuah
// div tersembunyi lewat posisi off-screen), lalu window.print() dipanggil
// pada window yang sama itu juga. CSS @media print menyembunyikan seluruh
// konten lain di halaman dan hanya menampilkan elemen struk. Karena tidak ada
// window/tab lain yang terlibat, tidak ada lagi popup blocker, tidak ada lagi
// "user activation" yang hilang karena await, dan tidak ada lagi risiko salah
// cetak dokumen lain — inilah yang dites langsung terbukti stabil di Safari
// (iPhone/iPad) pada implementasi Bengkelmu.
// ============================================================================

// Lebar kertas yang didukung. "58" untuk printer thermal mini (paling umum dipakai
// utk kasir kecil/UMKM), "80" untuk printer thermal ukuran struk kasir standar.
const PAPER_PROFILES = {
  58: { mm: 58, fontSize: 11, titleSize: 13, totalSize: 13, subFontSize: 10, padding: "6px 8px 16px" },
  80: { mm: 80, fontSize: 13, titleSize: 15, totalSize: 15, subFontSize: 11, padding: "8px 10px 18px" },
};

function getPaperProfile(paperWidth) {
  const key = String(paperWidth) === "80" ? "80" : "58";
  return PAPER_PROFILES[key];
}

// ----------------------------------------------------------------------------
// UKURAN KERTAS DI DIALOG CETAK (mengatasi dialog print yang menampilkan
// pilihan kertas dokumen biasa seperti A4/A5/Letter, bukan lebar kertas
// thermal 58mm/80mm yang sebenarnya dipakai kasir).
//
// Sebelumnya CSS hanya berisi `@page { margin: 0; }` tanpa `size`, sehingga
// browser memakai ukuran kertas terakhir yang dipilih user secara manual di
// dialog cetak (mis. A5 di screenshot) — bukan lebar printer thermal yang
// sesungguhnya. Di sinilah ukuran kertas diatur secara DINAMIS: setiap kali
// cetak dipanggil, sebuah <style> di <head> ditulis ulang dengan
// `@page { size: <lebar>mm auto; }` sesuai `paperWidth` yang aktif (58 atau
// 80, diambil dari Pengaturan Admin > Struk). "auto" pada tinggi artinya
// kertas dianggap kertas roll/continuous — printer thermal memotong sesuai
// panjang struk, bukan dipotong per halaman seperti kertas biasa.
//
// Efeknya: di Chrome/Edge (desktop & Android) dialog cetak otomatis memakai
// ukuran kertas custom sesuai lebar ini (tidak perlu lagi pilih manual A4/A5/
// dll di dropdown "Ukuran kertas"). Safari/iOS mengabaikan `size` kustom ini
// (keterbatasan WebKit), jadi di situ ukuran kertas dialog cetak masih perlu
// dipilih manual sekali oleh kasir, dan biasanya browser akan mengingatnya
// untuk pencetakan berikutnya.
// ----------------------------------------------------------------------------
const PAGE_SIZE_STYLE_ID = "receipt-print-page-size";

function applyPrintPageSize(paperWidth) {
  const profile = getPaperProfile(paperWidth);
  let styleEl = document.getElementById(PAGE_SIZE_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = PAGE_SIZE_STYLE_ID;
    document.head.appendChild(styleEl);
  } else {
    // Pindahkan ke posisi paling akhir di <head> supaya urutan cascade CSS
    // memenangkan aturan @page ini dibanding aturan @page lain (mis. yang
    // ada di index.css).
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media print { @page { size: ${profile.mm}mm auto; margin: 0; } }`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const PRINT_ROOT_ID = "print-receipt-root";

// Ambil (atau buat sekali) elemen tempat struk dirender. Elemen ini disisipkan
// langsung ke document.body halaman yang sedang aktif — bukan ke tab/window
// lain — supaya window.print() bisa dipanggil di konteks yang sama persis.
// Disembunyikan dari tampilan normal lewat posisi off-screen (bukan
// display:none) di lib/../index.css, supaya kontennya tetap punya layout yang
// bisa langsung dipakai browser begitu masuk mode cetak.
function getPrintRoot() {
  let el = document.getElementById(PRINT_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = PRINT_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

function buildReceiptMarkup({ order, items, cashierName, storeName, paperWidth }) {
  const profile = getPaperProfile(paperWidth);
  const code = order.order_code || `#${order.daily_order_number}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const rows = (items || [])
    .map((it) => {
      const name = it.name || it.menu_name || "-";
      const qty = it.qty || 1;
      const addonNames = it.addonNames || (it.addons || []).map((a) => a.addon_name || a.name);
      const subtotal = it.subtotal ?? (it.menu_price != null ? it.menu_price * qty : 0);
      return `
        <div class="rt-row">
          <span>${qty}x ${escapeHtml(name)}</span>
          <span>${escapeHtml(rupiah(subtotal))}</span>
        </div>
        <div class="rt-sub" style="font-size:${profile.subFontSize}px;">${addonNames && addonNames.length ? `+ ${escapeHtml(addonNames.join(", "))}` : "(tanpa topping)"}</div>
      `;
    })
    .join("");

  return `
    <div class="receipt-ticket" style="width:${profile.mm}mm;font-size:${profile.fontSize}px;padding:${profile.padding};">
      <div class="rt-center">
        <img src="/logo.png" alt="" class="rt-logo" />
        <h1 style="font-size:${profile.titleSize}px;">${escapeHtml(storeName || "Orderin Aja")}</h1>
        <div class="rt-meta" style="font-size:${profile.subFontSize}px;">Struk Pesanan</div>
      </div>
      <div class="rt-divider"></div>
      <div class="rt-meta">No. Antrian: <b>${escapeHtml(code)}</b></div>
      <div class="rt-meta">${dateStr} ${timeStr}</div>
      <div class="rt-meta">Pelanggan: ${escapeHtml(order.user_name || "-")}</div>
      ${order.user_phone && order.user_phone !== "-" ? `<div class="rt-meta">HP: ${escapeHtml(order.user_phone)}</div>` : ""}
      ${cashierName ? `<div class="rt-meta">Kasir: ${escapeHtml(cashierName)}</div>` : ""}
      <div class="rt-divider"></div>
      ${rows || `<div class="rt-meta">(rincian item tidak tersedia)</div>`}
      <div class="rt-divider"></div>
      <div class="rt-total-row" style="font-size:${profile.totalSize}px;">
        <span>TOTAL</span><span>${escapeHtml(rupiah(order.total))}</span>
      </div>
      <div class="rt-meta" style="margin-top:4px;">
        Bayar: ${escapeHtml((order.payment_method || "-").toUpperCase())} ·
        ${order.payment_status === "paid" ? "LUNAS" : "BELUM BAYAR"}
      </div>
    </div>
  `;
}

let isPrinting = false;

// Cetak nota lewat dialog print bawaan browser, di halaman/tab yang sedang
// aktif itu sendiri (TIDAK ada tab baru sama sekali). Kompatibel dengan
// printer thermal apa pun yang sudah tersambung sebagai printer default/Print
// Service di HP/laptop kasir (USB, Bluetooth, atau lewat app seperti RawBT di
// Android) — kasir tinggal pilih printernya di kotak dialog cetak bawaan
// browser.
//
// paperWidth: "58" atau "80" (mm) — ambil dari pengaturan Admin
// (settings.receipt_paper_width).
//
// Return value: true kalau proses cetak berhasil dipicu, false kalau gagal
// (mis. browser tidak mendukung window.print() sama sekali, sangat jarang
// terjadi) — pemanggil sebaiknya tampilkan pesan ke kasir kalau ini false.
export function printReceipt({ order, items, cashierName, storeName, paperWidth = "58" } = {}) {
  if (!order) return false;
  if (typeof window === "undefined" || typeof window.print !== "function") return false;
  if (isPrinting) return false; // cegah dialog print dobel kalau tombol kepencet berkali-kali cepat
  isPrinting = true;

  try {
    applyPrintPageSize(paperWidth);
    const root = getPrintRoot();
    root.innerHTML = buildReceiptMarkup({ order, items, cashierName, storeName, paperWidth });

    // Dua requestAnimationFrame supaya layout & style struk yang baru saja
    // disisipkan benar-benar sudah diterapkan browser sebelum dialog print
    // dibuka — penting di Safari & WebView Android low-end yang butuh sedikit
    // waktu lebih untuk selesai reflow.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.print();
        } finally {
          setTimeout(() => {
            isPrinting = false;
          }, 500);
        }
      });
    });
    return true;
  } catch {
    isPrinting = false;
    return false;
  }
}
