-- ============================================
-- SCHEMA DATABASE: Warung Kita — Multi-Tenant (D1)
-- ============================================
-- File INI SATU-SATUNYA yang dibutuhkan untuk membuat database baru dari nol.
-- Semua migration_*.sql lama (untuk database versi single-tenant sebelumnya)
-- sudah tidak dipakai lagi — lihat README bagian "Migrasi dari versi lama"
-- kalau Anda perlu memindahkan data dari database single-tenant yang sudah ada.
--
-- CATATAN RESTRUKTUR "SINGLE KASIR": akun kasir SEKARANG GLOBAL (tabel
-- global_cashiers / global_cashier_sessions di bawah), TIDAK per-tenant lagi.
-- Satu akun kasir bisa memproses pesanan untuk SEMUA stan sekaligus lewat
-- halaman /kasir (tanpa slug). Tabel `cashiers` / `cashier_sessions` yang lama
-- (per-tenant) sudah DIHAPUS dari skema ini. Kolom `orders.order_group_code`
-- dipakai untuk mengelompokkan beberapa order (1 per stan) yang berasal dari
-- 1x transaksi kasir yang mencampur item dari beberapa stan sekaligus.
--
-- Jalankan:
--   wrangler d1 execute kitchen_order_db --file=./schema.sql --remote
-- ============================================

-- ============================================
-- TENANTS (warung). Setiap baris = 1 warung yang berjalan di /:slug/...
-- admin_token & kitchen_token adalah token statis PER TENANT (dibuat otomatis
-- saat tenant dibuat lewat panel superadmin, bisa diganti lagi lewat panel Admin
-- tenant itu sendiri di tab "Keamanan" -> tersimpan di sini, BUKAN di tabel settings).
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  admin_token TEXT NOT NULL,
  kitchen_token TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Makanan','Minuman','Topping')),
  description TEXT,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_id INTEGER NOT NULL REFERENCES menu(id),
  name TEXT NOT NULL,
  extra_price INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_counters (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  date TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, date)
);

-- KASIR GLOBAL: satu akun kasir bisa dipakai untuk SEMUA stan (tidak terikat
-- 1 tenant). Dikelola dari panel Superadmin (/superman -> "Kasir Global").
CREATE TABLE IF NOT EXISTS global_cashiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS global_cashier_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id INTEGER NOT NULL REFERENCES global_cashiers(id),
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_counters_kasir (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  date TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, date)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  daily_order_number INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_phone TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','qris')),
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','diproses','selesai','dibatalkan')),
  order_source TEXT NOT NULL DEFAULT 'self' CHECK (order_source IN ('self','kasir')),
  order_code TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  pickup_type TEXT NOT NULL DEFAULT 'now' CHECK (pickup_type IN ('now','scheduled')),
  pickup_time TEXT,
  cashier_id INTEGER REFERENCES global_cashiers(id),
  payment_verified_by INTEGER REFERENCES global_cashiers(id),
  payment_verified_at TEXT,
  -- Mengelompokkan order lintas-stan yang lahir dari 1x transaksi kasir yang
  -- sama (1 struk pelanggan bisa berisi item dari beberapa stan sekaligus,
  -- tapi tiap stan tetap dapat baris order sendiri supaya dapur stan itu
  -- hanya melihat pesanan miliknya). NULL untuk order 1-stan biasa (self-order
  -- pelanggan, atau order kasir yang isinya cuma 1 stan).
  order_group_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_id INTEGER NOT NULL REFERENCES menu(id),
  menu_name TEXT NOT NULL,
  menu_price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS order_item_addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  addon_id INTEGER NOT NULL REFERENCES menu_addons(id),
  addon_name TEXT NOT NULL,
  addon_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS operational_hours (
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  day_of_week INTEGER NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1,
  open_time TEXT NOT NULL DEFAULT '08:00',
  close_time TEXT NOT NULL DEFAULT '22:00',
  PRIMARY KEY (tenant_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  actor_type TEXT NOT NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_tenant ON menu(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_active ON menu(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_menu_addons_menu ON menu_addons(menu_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(tenant_id, user_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_item ON order_item_addons(order_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(tenant_id, order_source);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(tenant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_group_code ON orders(order_group_code);
CREATE INDEX IF NOT EXISTS idx_global_cashier_sessions_token ON global_cashier_sessions(token);
CREATE INDEX IF NOT EXISTS idx_global_cashiers_username ON global_cashiers(username);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);
-- CATATAN: TIDAK ADA seed akun kasir di sini secara sengaja. Buat akun kasir
-- global pertama Anda lewat panel Superadmin (/superman -> "Kasir Global")
-- setelah deploy, supaya passwordnya tidak pernah tersimpan sebagai teks polos
-- di file ini.



-- ============================================
