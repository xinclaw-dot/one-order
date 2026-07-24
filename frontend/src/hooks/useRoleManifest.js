import { useEffect } from "react";

// Konfigurasi manifest & judul home-screen untuk tiap role.
// "/" (Customer) tetap pakai manifest bawaan yang di-generate vite-plugin-pwa
// (/manifest.webmanifest), sedangkan 3 role lain pakai manifest statis
// terpisah di folder public/ (lihat frontend/public/manifest-*.webmanifest).
const ROLE_MANIFESTS = {
  // Customer sengaja TIDAK diubah — title & apple-mobile-web-app-title tetap
  // seperti default di index.html ("Orderin Aja — Pesan Makanan" /
  // "Orderin Aja"), tidak berubah dari kondisi sekarang.
  customer: {
    href: "/manifest.webmanifest",
    title: "Orderin Aja — Pesan Makanan",
    appleTitle: "Orderin Aja",
  },
  kitchen: {
    href: "/manifest-kitchen.webmanifest",
    title: "Orderin Aja — Kitchen",
    appleTitle: "Kitchen",
  },
  kasir: {
    href: "/manifest-kasir.webmanifest",
    title: "Orderin Aja — Kasir",
    appleTitle: "Kasir",
  },
  admin: {
    href: "/manifest-admin.webmanifest",
    title: "Orderin Aja — Admin",
    appleTitle: "Admin",
  },
};

/**
 * Mengganti <link rel="manifest"> dan judul home-screen (iOS) sesuai halaman
 * yang aktif. Ini yang membuat tombol "Install" / "Tambah ke Layar Utama" di
 * /kitchen, /kasir, dan /admin menghasilkan aplikasi terpisah dari Customer
 * (nama & shortcut sendiri di layar utama), bukan ikut manifest default.
 *
 * Panggil hook ini sekali di baris paling atas tiap halaman (Customer,
 * Kitchen, Kasir, Admin), sama seperti pemanggilan useThemeSync().
 *
 * @param {"customer"|"kitchen"|"kasir"|"admin"} role
 */
export function useRoleManifest(role) {
  useEffect(() => {
    const config = ROLE_MANIFESTS[role] || ROLE_MANIFESTS.customer;

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.setAttribute("href", config.href);

    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement("meta");
      appleTitle.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(appleTitle);
    }
    appleTitle.setAttribute("content", config.appleTitle);

    document.title = config.title;
  }, [role]);
}
