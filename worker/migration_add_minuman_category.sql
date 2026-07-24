-- ============================================
-- MIGRASI: izinkan kategori 'Minuman' lagi di tabel menu
-- ============================================
-- HANYA perlu dijalankan SEKALI, kalau database Anda dibuat SEBELUM perubahan ini
-- (kolom category masih dikunci CHECK (category IN ('Makanan','Topping'))).
-- Kalau Anda baru saja membuat database dari schema.sql yang terbaru, TIDAK PERLU
-- menjalankan file ini -- schema.sql sudah termasuk perubahan ini.
--
-- SQLite tidak bisa mengubah CHECK constraint secara langsung, jadi tabel menu
-- dibuat ulang dengan constraint baru, lalu semua data lama dipindahkan (ID tetap
-- sama persis, jadi menu_addons & order_items yang mereferensikan menu ini tidak
-- ikut rusak).
--
-- Jalankan:
--   wrangler d1 execute kitchen_order_db --file=./migration_add_minuman_category.sql --remote
-- ============================================

-- Menunda pengecekan foreign key sampai akhir transaksi -- perlu karena menu_addons
-- dan order_items masih mereferensikan tabel menu, dan D1 menegakkan FK tsb saat
-- DROP TABLE dijalankan. Di akhir transaksi tabel "menu" sudah ada lagi (hasil RENAME)
-- dengan isi & id yang identik, jadi referensi tsb tetap valid.
PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE menu_new (
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

INSERT INTO menu_new (id, tenant_id, name, price, category, description, image_url, is_active, is_available, created_at)
SELECT id, tenant_id, name, price, category, description, image_url, is_active, is_available, created_at FROM menu;

DROP TABLE menu;
ALTER TABLE menu_new RENAME TO menu;

CREATE INDEX IF NOT EXISTS idx_menu_tenant ON menu(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_active ON menu(tenant_id, is_active);
