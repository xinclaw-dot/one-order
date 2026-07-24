// ============================================
// Preset warna dasar aplikasi.
// Hanya warna BRAND (ink/chili/guava & turunannya) yang berubah per tema.
// Warna status (pending/diproses/selesai/dibatalkan, sinyal koneksi, dst)
// SENGAJA tidak dimasukkan di sini — maknanya harus tetap sama di semua tema
// (lihat --color-status-done / --color-status-cancel di index.css).
//
// Daftar id preset ini HARUS sinkron dengan THEME_PRESET_IDS di worker/src/utils.js
// ============================================

export const THEME_PRESETS = {
  hijau: {
    label: "Hijau",
    swatch: "#00b14f",
    vars: {
      "--color-ink": "#007a3d",
      "--color-ink-2": "#00944b",
      "--color-ink-3": "#4cc98a",
      "--color-ink-soft": "#5c8a72",
      "--color-chili": "#00b14f",
      "--color-chili-dark": "#00873d",
      "--color-guava": "#00d9a3",
      "--color-cream": "#f1faf5",
    },
  },
  merah: {
    label: "Merah",
    swatch: "#e53e3e",
    vars: {
      "--color-ink": "#7a1212",
      "--color-ink-2": "#a51d1d",
      "--color-ink-3": "#e08585",
      "--color-ink-soft": "#8a6060",
      "--color-chili": "#e53e3e",
      "--color-chili-dark": "#b02a2a",
      "--color-guava": "#ff7a59",
      "--color-cream": "#fdf3f1",
    },
  },
  biru: {
    label: "Biru",
    swatch: "#2563eb",
    vars: {
      "--color-ink": "#0f2f6b",
      "--color-ink-2": "#173f8c",
      "--color-ink-3": "#7fa8ec",
      "--color-ink-soft": "#5a729e",
      "--color-chili": "#2563eb",
      "--color-chili-dark": "#1d4ed8",
      "--color-guava": "#38bdf8",
      "--color-cream": "#eff6ff",
    },
  },
  ungu: {
    label: "Ungu",
    swatch: "#8b5cf6",
    vars: {
      "--color-ink": "#3b1670",
      "--color-ink-2": "#4c1d95",
      "--color-ink-3": "#c4a6f0",
      "--color-ink-soft": "#7a6a99",
      "--color-chili": "#8b5cf6",
      "--color-chili-dark": "#7c3aed",
      "--color-guava": "#d946ef",
      "--color-cream": "#f5f3ff",
    },
  },
  oranye: {
    label: "Oranye",
    swatch: "#f97316",
    vars: {
      "--color-ink": "#7c2d12",
      "--color-ink-2": "#9a3412",
      "--color-ink-3": "#fdba74",
      "--color-ink-soft": "#9a7050",
      "--color-chili": "#f97316",
      "--color-chili-dark": "#c2410c",
      "--color-guava": "#facc15",
      "--color-cream": "#fff7ed",
    },
  },
  pink: {
    label: "Pink",
    swatch: "#ec4899",
    vars: {
      "--color-ink": "#831843",
      "--color-ink-2": "#9d174d",
      "--color-ink-3": "#f9a8d4",
      "--color-ink-soft": "#996a80",
      "--color-chili": "#ec4899",
      "--color-chili-dark": "#db2777",
      "--color-guava": "#fb7185",
      "--color-cream": "#fdf2f8",
    },
  },
};

export const DEFAULT_THEME = "hijau";
const STORAGE_KEY = "theme_preset";

// Terapkan satu preset ke seluruh aplikasi dengan mengubah CSS variable di root,
// supaya semua class Tailwind (bg-chili, text-ink, dst) ikut berubah seketika
// tanpa reload/build ulang.
export function applyTheme(presetId) {
  const preset = THEME_PRESETS[presetId] || THEME_PRESETS[DEFAULT_THEME];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value);
  }

  // Warna address bar / status bar browser (efek langsung untuk tab yang sedang terbuka).
  // Catatan: ini TIDAK mengubah ikon aplikasi yang sudah ter-install di homescreen —
  // itu berkas gambar statis yang di-cache oleh sistem operasi, di luar jangkauan JS.
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", preset.vars["--color-ink"]);

  try {
    localStorage.setItem(STORAGE_KEY, presetId);
  } catch {
    // localStorage bisa gagal (mode private/incognito) — abaikan, tidak fatal
  }
}

// Terapkan tema tercepat yang kita tahu (cache lokal) SEBELUM data dari server datang,
// supaya tidak ada kedipan balik ke warna default saat halaman pertama dibuka.
export function applyCachedThemeInstantly() {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && THEME_PRESETS[cached]) applyTheme(cached);
  } catch {
    // abaikan
  }
}
