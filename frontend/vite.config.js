import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'robots.txt',
        'manifest-kitchen.webmanifest',
        'manifest-kasir.webmanifest',
        'manifest-admin.webmanifest',
      ],
      manifest: {
        // Halaman utama customer sekarang ada di "/" (root, tanpa slug tenant) --
        // katalog gabungan semua warung. id/start_url/scope HARUS ikut root "/",
        // bukan lagi "/order" (peninggalan struktur lama), supaya saat PWA
        // ini di-install lalu dibuka dari ikon, browser tidak diarahkan ke
        // "/order" (yang sekarang malah cocok dengan route ":tenantSlug" dan
        // dianggap slug tenant "order" -> muncul "Warung tidak ditemukan").
        //
        // Catatan: kitchen/kasir/admin diakses per-tenant lewat
        // "/:tenantSlug/kitchen" dkk (bukan lagi path flat "/kitchen"), jadi
        // scope "/" di sini tidak lagi tabrakan dengan scope manifest mereka.
        id: '/',
        name: 'Orderin Aja — Self Order',
        short_name: 'Orderin Aja',
        description: 'Pesan Orderin Aja langsung ke dapur, tanpa antre.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'id',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/menu') || url.pathname.startsWith('/orders'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})