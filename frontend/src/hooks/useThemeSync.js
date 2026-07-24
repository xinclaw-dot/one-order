import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { applyCachedThemeInstantly, applyTheme } from "../lib/theme";

// Dipakai di setiap halaman (Customer, Kasir, Kitchen, Admin) supaya warna dasar
// aplikasi selalu sinkron dengan pilihan admin.
//
// CATATAN: sebelumnya ini pakai SSE (EventSource) ke Durable Object supaya
// perubahan tema langsung tampil tanpa refresh. Masalahnya, SSE bikin koneksi
// menyala terus selama halaman terbuka — dan karena hook ini dipakai di
// SEMUA halaman (Customer, Kasir, Kitchen, Admin), tiap tab yang terbuka
// otomatis "menyalakan" Durable Object terus-menerus. Itu yang bikin jatah
// gratis 13.000 GB-detik/hari Cloudflare cepat habis, lalu semua request
// (bukan cuma tema) kena 503 sampai reset jam 00:00 UTC.
//
// Sekarang diganti polling biasa (fetch tiap beberapa detik) — tidak
// menyentuh Durable Object sama sekali, jadi tidak akan pernah kena limit
// ini lagi. Bedanya cuma jeda beberapa detik sebelum tema baru muncul,
// yang untuk kebutuhan ganti tema warna toko itu bukan masalah.
const POLL_INTERVAL_MS = 15000;

export function useThemeSync() {
  const lastThemeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Terapkan dulu tema yang terakhir kali dipakai (dari cache lokal), instan,
    //    supaya tidak ada kedipan warna default sebelum data server datang.
    applyCachedThemeInstantly();

    async function poll() {
      try {
        const data = await api.getStoreStatus();
        if (cancelled) return;
        if (data?.theme_preset && data.theme_preset !== lastThemeRef.current) {
          lastThemeRef.current = data.theme_preset;
          applyTheme(data.theme_preset);
        }
      } catch {
        /* gagal ambil status — coba lagi di polling berikutnya, abaikan */
      }
    }

    // Ambil segera saat halaman dibuka, lalu polling berkala setelahnya.
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
