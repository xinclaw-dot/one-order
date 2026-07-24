# Warung Kita (Kitchen Online Order) — Versi React + PWA

Frontend project ini sudah ditulis ulang total pakai **React (Vite)** dengan desain baru yang lebih modern/youthful, dan sekarang bisa **di-install sebagai aplikasi (PWA)** langsung dari browser — baik oleh pelanggan, staff dapur, maupun admin. Backend (Cloudflare Worker + D1 + Cloudinary) **tidak diubah sama sekali**, jadi kalau sebelumnya sudah pernah deploy worker-nya, Anda tinggal lanjut ke **BAGIAN 6** di bawah.

Struktur project:
```
kitchen-order-app/
├── worker/                → Backend API (Cloudflare Workers + D1 + Cloudinary) — TIDAK BERUBAH
│   ├── wrangler.toml
│   ├── schema.sql
│   └── src/
└── frontend/               → React + Vite, satu project untuk 3 halaman lewat routing
    ├── src/
    │   ├── pages/           → Customer.jsx ( / ), Kitchen.jsx ( /kitchen ), Admin.jsx ( /admin )
    │   ├── components/      → UI per halaman (customer/kitchen/admin) + komponen bersama
    │   ├── hooks/            → useInstallPrompt, useKitchenOrders (realtime SSE)
    │   └── lib/               → api.js (URL backend & semua panggilan API), format.js
    ├── public/icons/         → Ikon PWA (sudah digenerate, siap pakai)
    └── vite.config.js         → Konfigurasi PWA (manifest, service worker)
```

---

## Restruktur "Single Kasir" (baca ini dulu kalau Anda lanjut dari versi sebelumnya)

Perubahan utama dibanding versi sebelumnya:
- **Kasir sekarang GLOBAL, bukan per-stan.** Dulu tiap warung (tenant) punya akun kasir &
  halaman kasir sendiri (`/<slug>/kasir`). Sekarang hanya ada **satu** halaman kasir, `/kasir`
  (tanpa slug), dan satu akun kasir bisa memproses pesanan untuk **semua stan sekaligus** dalam
  1 transaksi (item boleh campuran dari beberapa stan) — lihat **Bagian 4.6**.
- **Akun kasir dikelola dari Superadmin**, bukan lagi dari panel Admin tiap warung (tab "Kasir"
  di Admin sudah dihapus).
- Dapur (`/<slug>/kitchen`) & Admin (`/<slug>/admin`) tiap stan **tidak berubah** — tetap
  terpisah per warung seperti sebelumnya.

### ⚠️ Checklist: semua tempat yang WAJIB diisi ulang sebelum deploy
Supaya build ini tidak salah nyambung ke aplikasi/database lama yang sudah berjalan, beberapa
nilai SENGAJA dikosongkan jadi placeholder `ISI_SETELAH_SETTING_...`. Cari & isi semua ini
sebelum deploy:

| File | Yang perlu diisi | Dijelaskan di |
|---|---|---|
| `worker/wrangler.toml` | `database_id` | Bagian 2.1 & 5 |
| `worker/wrangler.toml` | `CLOUDINARY_CLOUD_NAME` | Bagian 3 |
| `worker/schema.sql` | `admin_token` / `kitchen_token` tenant contoh (atau hapus baris contohnya) | Bagian 4.5 |
| `frontend/src/lib/api.js` | `API_URL` | Bagian 6.2 |
| Cloudflare Secrets (bukan file) | `SUPERADMIN_TOKEN`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Bagian 3 & 4 |
| Panel Superadmin (setelah deploy) | Buat minimal 1 akun kasir global | Bagian 4.6 |

---

## Apa yang baru?

- **Desain baru** — tema "tiket warung malam": gradasi merah cabai → pink, kartu bergaya struk/tiket sobek, tipografi tebal, dibuat biar terasa lebih hidup dan pas untuk anak muda, tapi tetap gampang dibaca dan cepat dipakai di HP.
- **PWA Installer** — muncul tombol/banner "Pasang Warung Kita" otomatis di HP Android/desktop (pakai `beforeinstallprompt`), dan petunjuk manual untuk iPhone (Safari tidak mendukung install otomatis). Setelah di-install, aplikasi punya ikon sendiri di layar utama dan terbuka tanpa address bar browser.
- **Bisa dibuka offline (terbatas)** — tampilan & aset (CSS/JS/ikon) sudah tersimpan di HP lewat service worker, jadi tetap terbuka meski sinyal lemot. Data menu/pesanan tetap butuh koneksi (selalu ambil data terbaru dari server, tidak akan menampilkan data basi tanpa disadari).
- **Logic & endpoint API sama persis** seperti sebelumnya (login, menu, order, realtime kitchen, kelola menu, laporan) — hanya tampilannya yang dibangun ulang dengan React.

---

## BAGIAN 1 — Persiapan Awal

### 1.1 Install Node.js
Download dan install dari https://nodejs.org (pilih versi **LTS**). Cek di terminal:
```bash
node -v
npm -v
```

### 1.2 Install Wrangler (CLI Cloudflare)
```bash
npm install -g wrangler
wrangler --version
```

### 1.3 Login ke akun Cloudflare Anda
```bash
wrangler login
```

---

## BAGIAN 2 — Setup Database (D1)

*(Lewati bagian ini kalau backend sudah pernah di-deploy sebelumnya — lanjut ke Bagian 6)*

### 2.1 Buat database D1
```bash
cd kitchen-order-app/worker
wrangler d1 create kitchen_order_db
```
Copy `database_id` yang muncul, lalu tempel ke `wrangler.toml` pada baris `database_id = "GANTI_DENGAN_DATABASE_ID_ANDA"`.

### 2.2 Jalankan schema
```bash
wrangler d1 execute kitchen_order_db --file=./schema.sql --remote
```

---

## BAGIAN 3 — Setup Penyimpanan Gambar (Cloudinary)

1. Daftar gratis di https://cloudinary.com, buka **Dashboard**, catat **Cloud Name**, **API Key**, **API Secret**.
2. Isi `CLOUDINARY_CLOUD_NAME` di `worker/wrangler.toml`.
3. Simpan API Key & Secret sebagai secret (jangan taruh di file):
```bash
cd worker
wrangler secret put CLOUDINARY_API_KEY
wrangler secret put CLOUDINARY_API_SECRET
```

---

## BAGIAN 4 — Atur Token Keamanan

**PENTING (multi-tenant): token admin & kitchen SEKARANG per warung (tenant), BUKAN lagi
di `wrangler.toml`.** Setiap tenant punya `admin_token` & `kitchen_token` sendiri, disimpan
di tabel `tenants`, dan bisa diganti kapan saja lewat panel Admin tenant itu (tab "Keamanan")
atau lewat panel superadmin (tombol "Regenerate Token"). Yang perlu diatur di `wrangler.toml`
hanyalah `SUPERADMIN_TOKEN` (token global untuk mengelola SEMUA tenant), lewat secret:
```bash
cd worker
wrangler secret put SUPERADMIN_TOKEN
```

**Akun kasir SEKARANG GLOBAL** (lihat Bagian 4.6) — tidak lagi diatur lewat token statis,
tapi lewat username/password yang dibuat dari panel Superadmin.

---

## BAGIAN 4.5 — Multi-Tenant: Kelola Banyak Warung

Aplikasi ini sekarang mendukung banyak warung (tenant) dalam SATU database & SATU deployment
frontend. Setiap warung diakses lewat slug di URL:
```
https://domain-anda.pages.dev/<slug-warung>/order    (customer)
https://domain-anda.pages.dev/<slug-warung>/kitchen  (dapur)
https://domain-anda.pages.dev/<slug-warung>/admin    (admin)
```
Kasir TIDAK lagi punya slug tenant sendiri — lihat Bagian 4.6.

`schema.sql` sudah membuat 1 tenant contoh (`warung-kita`) dengan token placeholder
(`ISI_SETELAH_SETTING_ADMIN_TOKEN` / `ISI_SETELAH_SETTING_KITCHEN_TOKEN`) — **wajib** diganti
lewat panel Admin sebelum dipakai sungguhan, atau hapus baris contoh itu dari `schema.sql`
sebelum dijalankan kalau tidak perlu.

**Membuat warung baru** dilakukan lewat panel superadmin:
1. Buka `https://domain-anda.pages.dev/superman`, ketuk logo 5x untuk membuka form login,
   masukkan `SUPERADMIN_TOKEN`.
2. Di tab **Tenant**, klik **Warung Baru**, isi nama & slug.
3. Sistem otomatis membuat `admin_token` & `kitchen_token` acak untuk warung tsb — **catat
   sekarang**, hanya ditampilkan sekali (bisa dibuat ulang kapan saja lewat "Regenerate Token",
   tapi token lama langsung tidak berlaku).
4. Bagikan link `/<slug>/order` ke pelanggan warung tsb, dan token admin/kitchen ke pemilik/dapur.

Superadmin bisa "masuk sebagai" role apa pun (Admin/Kitchen/Customer) untuk warung
manapun, dan role Kasir (global, lintas semua warung), langsung dari panel `/superman`,
tanpa perlu tahu token/password warung atau kasir tsb secara manual.

Setiap warung terisolasi total: menu, customer, order, laporan, dan pengaturan (jam
buka, tema, QRIS, dll) masing-masing tenant terpisah — nomor HP pelanggan yang sama boleh
dipakai untuk order di warung berbeda. **Pengecualian: kasir** (lihat Bagian 4.6) — akun
kasir memang sengaja dibuat LINTAS semua tenant, bukan bagian dari isolasi ini.

### Migrasi dari versi single-tenant lama
Kalau Anda sebelumnya sudah punya database versi lama (sebelum multi-tenant, satu warung per
deployment), `schema.sql` yang baru ini TIDAK bisa langsung dijalankan di atas database lama
(strukturnya berubah total: kolom `tenant_id` ditambahkan ke hampir semua tabel). Cara teraman:
1. Backup data lama dulu: `wrangler d1 export kitchen_order_db --remote --output=backup-lama.sql`
   (atau pakai tombol Backup di panel superadmin versi lama).
2. Buat database D1 BARU (`wrangler d1 create`), jalankan `schema.sql` yang baru di situ.
3. Buat 1 tenant lewat panel superadmin untuk mewakili warung lama Anda.
4. Pindahkan data dari `backup-lama.sql` secara manual (INSERT per tabel dengan menambahkan
   `tenant_id` sesuai id tenant yang baru dibuat) — sesuaikan dengan isi backup Anda.

---

## BAGIAN 4.6 — Single Kasir: Satu Kasir untuk SEMUA Stan

**Sejak restruktur ini, kasir TIDAK lagi 1 akun per stan.** Sekarang hanya ada SATU
halaman kasir, `/kasir` (tanpa slug tenant), dan satu akun kasir yang login di sana bisa
langsung memproses pesanan untuk **semua stan/warung sekaligus** — cocok untuk food court
dengan 1 meja kasir terpusat yang melayani banyak stan.

Cara kerjanya:
- 1 transaksi di halaman `/kasir` boleh berisi item campuran dari beberapa stan sekaligus
  (1 struk untuk pelanggan). Di belakang layar, sistem otomatis memecahnya menjadi beberapa
  baris pesanan (1 per stan) supaya dapur tiap stan (`/<slug>/kitchen`) tetap **hanya**
  melihat pesanan miliknya sendiri.
- Verifikasi pembayaran juga otomatis berlaku untuk seluruh stan dalam 1 transaksi tsb
  sekaligus (karena di mata pelanggan cuma 1x bayar).
- Menu yang tampil di `/kasir` adalah gabungan menu SEMUA stan aktif, dengan chip filter
  per stan supaya tidak perlu scroll panjang.

**Membuat akun kasir** dilakukan lewat panel superadmin:
1. Buka `/superman`, login pakai `SUPERADMIN_TOKEN`.
2. Buka tab **Kasir Global**, klik **Kasir Baru**, isi nama, username, & password.
3. Bagikan username/password itu ke staff kasir — mereka login langsung di `/kasir`.

Superadmin juga bisa langsung "Masuk Sebagai Kasir" dari dalam detail 1 tenant manapun
(tab "Masuk Sebagai") tanpa perlu tahu password kasir mana pun, untuk keperluan testing/demo.

---

## BAGIAN 5 — Deploy Backend (Worker)

Sebelum deploy: pastikan `worker/wrangler.toml` sudah diisi dengan nilai Anda sendiri, BUKAN
placeholder bawaan (`database_id` dari Bagian 2.1, `CLOUDINARY_CLOUD_NAME` dari Bagian 3) —
kalau masih `ISI_SETELAH_SETTING_...`, deploy akan gagal atau nyambung ke resource yang salah.

```bash
cd worker
wrangler deploy
```
Catat URL yang muncul, contoh: `https://kitchen-order-api.NAMA-ANDA.workers.dev`

Test (ganti `warung-kita` dengan slug tenant Anda):
```bash
curl https://kitchen-order-api.NAMA-ANDA.workers.dev/warung-kita/menu
```

---

## BAGIAN 6 — Setup & Build Frontend (React)

### 6.1 Install dependencies
```bash
cd frontend
npm install
```

### 6.2 Masukkan URL backend Anda
Buka `frontend/src/lib/api.js`, ganti baris `export const API_URL = ...` (isinya sengaja
placeholder `"ISI_SETELAH_SETTING_API_URL"` supaya build ini tidak salah nyambung ke Worker
aplikasi lama yang sudah berjalan):
```js
export const API_URL = "https://kitchen-order-api.NAMA-ANDA.workers.dev";
```
Cukup di **satu tempat ini saja** — dipakai otomatis oleh halaman customer, kitchen, admin, kasir, dan superadmin.

### 6.3 (Opsional) Coba dulu di komputer sendiri
```bash
npm run dev
```
Buka `http://localhost:5173`, `http://localhost:5173/kitchen`, `http://localhost:5173/admin`.

### 6.4 Build untuk production
```bash
npm run build
```
Ini akan membuat folder `frontend/dist` — inilah yang di-deploy, **bukan** folder `src`.

### 6.5 Deploy ke Cloudflare Pages
```bash
wrangler pages deploy dist --project-name=warung-anda
```
Setelah sukses, Anda dapat satu URL, contoh `https://warung-anda.pages.dev`, dipakai bersama
oleh SEMUA tenant (lihat Bagian 4.5). Untuk tenant dengan slug `warung-kita`:
- **`/warung-kita/order`** → halaman pelanggan (taruh di meja / QR code)
- **`/warung-kita/kitchen`** → dashboard dapur (buka di HP/tablet dapur)
- **`/warung-kita/admin`** → kelola menu & laporan (khusus pemilik)
- **`/kasir`** → dashboard kasir GLOBAL, lintas semua stan (lihat Bagian 4.6) — perhatikan
  TIDAK ada slug tenant di depannya

> Setiap kali ubah kode atau ganti `API_URL`, ulangi `npm run build` lalu `wrangler pages deploy dist --project-name=warung-anda`.

---

## BAGIAN 7 — Cara Install sebagai Aplikasi (PWA)

**Android / Desktop Chrome & Edge:**
Buka link warung Anda (`/<slug>/order`), akan muncul banner "Pasang" otomatis di bagian bawah layar. Tinggal ketuk **Install Sekarang**. Kalau banner sudah ditutup, bisa juga lewat menu browser (⋮) → **Install app / Add to Home screen**.

**iPhone/iPad (Safari):**
Safari tidak mendukung tombol install otomatis, jadi akan muncul petunjuk: ketuk ikon **Share** (kotak dengan panah ke atas) → **Tambah ke Layar Utama**.

**Staff dapur & admin** juga bisa install dari `/<slug>/kitchen` atau `/<slug>/admin` masing-masing di HP/tablet mereka biar buka aplikasinya lebih cepat, tanpa harus buka browser dulu. **Staff kasir** install dari `/kasir` (tanpa slug — 1 aplikasi kasir yang sama dipakai untuk semua stan).

> **Keterbatasan diketahui (multi-tenant):** konfigurasi PWA (`vite.config.js` & file
> `manifest-*.webmanifest`) masih memakai `scope`/`start_url` tanpa slug tenant (mis. `/order`,
> bukan `/<slug>/order`), karena manifest di-generate sekali saat build untuk seluruh
> deployment. Efeknya: install PWA tetap berfungsi, tapi scope-nya sedikit lebih luas dari
> idealnya kalau Anda menjalankan banyak tenant sekaligus di domain yang sama. Kalau ini
> penting untuk Anda (banyak tenant, masing-masing perlu app terinstall terpisah bersih),
> perlu penyesuaian lanjutan: generate manifest per-tenant secara dinamis dari Worker.

---

## BAGIAN 8 (OPSIONAL, LEBIH AMAN) — Upgrade ke Cloudflare Access

Sama seperti sebelumnya — kalau mau proteksi lebih kuat daripada token sederhana (staff login pakai email masing-masing):
1. Buka https://one.dash.cloudflare.com (Zero Trust dashboard)
2. **Access → Applications → Add an Application → Self-hosted**
3. Isi domain `warung-anda.pages.dev` dengan path `/*/kitchen` dan `/*/admin` (perhatikan `/*/` supaya berlaku untuk semua slug tenant)
4. Buat **Policy** "Allow" untuk email staff/pemilik

Token admin/kitchen per-tenant tetap bisa dipakai berbarengan sebagai lapisan kedua.

---

## Troubleshooting Umum

| Masalah | Kemungkinan Penyebab |
|---|---|
| `/<slug>/menu` mengembalikan array kosong | Schema belum dijalankan, ulangi Bagian 2.2, atau tenant belum ada menu |
| `Warung tidak ditemukan atau sedang tidak aktif` | Slug salah ketik, tenant belum dibuat lewat `/superman`, atau tenant sedang dinonaktifkan |
| Gambar tidak muncul / upload gagal | `CLOUDINARY_CLOUD_NAME` belum diganti dari placeholder `ISI_SETELAH_SETTING_...` (Bagian 3), atau secret belum di-set |
| Dashboard kitchen/admin: "Unauthorized" | Token yang diketik tidak sama persis dengan `admin_token`/`kitchen_token` tenant tsb (cek di panel Admin tab Keamanan, atau lewat superadmin) |
| `/kasir`: "Username atau password salah" | Akun kasir belum dibuat — buat dulu lewat `/superman` tab **Kasir Global** (Bagian 4.6) |
| Order baru tidak muncul realtime | Cek indikator "Realtime tersambung" di kanan atas dashboard kitchen |
| Tombol "Pasang Aplikasi" tidak muncul | Sudah pernah di-install sebelumnya, atau browser tidak mendukung (mis. Firefox desktop) — di iPhone memang selalu manual lewat Share |
| Setelah `npm run build`, perubahan tidak terlihat di web | Lupa deploy ulang: `wrangler pages deploy dist --project-name=warung-anda` |
| Ganti `API_URL` tapi tidak berubah di web | `API_URL` dibaca saat build — build ulang (`npm run build`) setelah mengubahnya |
| `wrangler deploy` gagal / error database | `database_id` di `worker/wrangler.toml` masih placeholder `ISI_SETELAH_SETTING_DATABASE_ID` — isi dengan ID dari Bagian 2.1 |

---

## Ringkasan Alur Kerja Sehari-hari

1. **Pemilik** buka `/admin` → tab "Kelola Menu" untuk tambah/edit menu, tab "Laporan" untuk lihat produk terlaris, tren penjualan, kategori, metode pembayaran, dan jam ramai.
2. **Pelanggan** buka `/` → login nomor HP → pesan → bisa install aplikasi biar order berikutnya lebih cepat.
3. **Kitchen** buka `/kitchen` di HP/tablet dapur → pesanan baru langsung muncul (realtime + bunyi notifikasi) → klik Proses → klik Selesai → klik "Kirim WA" untuk notifikasi manual ke pelanggan.
4. **Kasir** buka `/kasir` (satu halaman untuk SEMUA stan, lihat Bagian 4.6) → tab "Buat Pesanan" untuk input order walk-in (boleh campur beberapa stan dalam 1 transaksi) → tab "Verifikasi" untuk tandai lunas pesanan self-order pelanggan yang datang bayar ke kasir.

Semua angka laporan otomatis mengecualikan order berstatus "dibatalkan", supaya mencerminkan penjualan nyata.
