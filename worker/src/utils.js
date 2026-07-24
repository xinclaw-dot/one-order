// ============================================
// Helper functions: response JSON, CORS, validasi, multi-tenant
// ============================================

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Filename",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

// Validasi nomor HP Indonesia: 08xxxxxxxxxx / +62xxxxxxxxxx / 62xxxxxxxxxx
export function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(phone.trim());
}

// Normalisasi nomor HP ke format 08xxxxxxxxxx supaya konsisten di database
export function normalizePhone(phone) {
  let p = phone.trim();
  if (p.startsWith("+62")) p = "0" + p.slice(3);
  else if (p.startsWith("62")) p = "0" + p.slice(2);
  return p;
}

// ============================================
// OPTIMASI D1 — hindari pola N+1 (1 query per order, lalu 1 query lagi per
// item) saat mengambil rincian pesanan untuk daftar order (dipakai Kitchen &
// Kasir, yang di-polling berkala). Sebelumnya: 1 + N + M query untuk N order
// dengan total M item. Sekarang: paling banyak beberapa query saja, TIDAK
// peduli berapa banyak order/item-nya.
//
// Di-chunk per 100 id karena D1 punya batas KERAS 100 bound parameter per
// query (bukan 999 seperti SQLite pada umumnya) — https://developers.cloudflare.com/d1/platform/limits/.
// Paket gratis D1 juga cuma boleh ~50 query per 1x invocation Worker, jadi
// pola N+1 lama bisa gagal total (bukan cuma lambat) begitu order menumpuk.
const D1_MAX_BOUND_PARAMS = 100;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Ambil semua order_items + order_item_addons untuk sekumpulan order_id
// SEKALIGUS lewat query batch, lalu di-join di memori (bukan di database).
// Return: Map<order_id, item[]>, tiap item sudah membawa array `addons`
// (bentuk hasilnya SAMA PERSIS seperti sebelumnya, cuma cara ambilnya beda).
export async function fetchOrderItemsByOrderIds(env, orderIds) {
  const itemsByOrder = new Map();
  if (!orderIds || orderIds.length === 0) return itemsByOrder;

  const allItems = [];
  for (const chunk of chunkArray(orderIds, D1_MAX_BOUND_PARAMS)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await env.DB.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
      .bind(...chunk)
      .all();
    allItems.push(...rows.results);
  }

  const itemIds = allItems.map((it) => it.id);
  const addonsByItem = new Map();
  for (const chunk of chunkArray(itemIds, D1_MAX_BOUND_PARAMS)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await env.DB.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})`)
      .bind(...chunk)
      .all();
    for (const a of rows.results) {
      if (!addonsByItem.has(a.order_item_id)) addonsByItem.set(a.order_item_id, []);
      addonsByItem.get(a.order_item_id).push(a);
    }
  }

  for (const item of allItems) {
    const withAddons = { ...item, addons: addonsByItem.get(item.id) || [] };
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(withAddons);
  }

  return itemsByOrder;
}

// Cek header Authorization: Bearer <token> cocok dengan salah satu dari beberapa token yang diizinkan
export function isAuthorizedAny(request, expectedTokens) {
  const auth = request.headers.get("Authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme === "Bearer" && expectedTokens.includes(token)) return true;

  // fallback: token lewat query string, khusus endpoint yang tidak bisa set header
  const url = new URL(request.url);
  const qToken = url.searchParams.get("token");
  return expectedTokens.includes(qToken);
}

// Cek header Authorization: Bearer <token> cocok dengan token yang diharapkan
export function isAuthorized(request, expectedToken) {
  const auth = request.headers.get("Authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme === "Bearer" && token === expectedToken) return true;

  const url = new URL(request.url);
  const qToken = url.searchParams.get("token");
  return qToken === expectedToken;
}

export function todayDateString() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function dateDaysAgoString(daysAgo) {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000 - daysAgo * 24 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

// ============================================
// JAM OPERASIONAL
// ============================================
export function nowTimeStringWIB() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(11, 16);
}

export function dayOfWeekWIB() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.getUTCDay();
}

export function wibDateTimeToUtcString(dateStr, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const utcMs = Date.parse(`${dateStr}T00:00:00Z`) + (h * 60 + m) * 60000 - 7 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString().slice(0, 19).replace("T", " ");
}

export function isWithinOperatingHours(openTime, closeTime, currentTime) {
  if (!openTime || !closeTime) return true;
  if (openTime === closeTime) return true;
  if (openTime < closeTime) {
    return currentTime >= openTime && currentTime < closeTime;
  }
  return currentTime >= openTime || currentTime < closeTime;
}

// Ambil jam operasional untuk SEMUA hari milik satu tenant
export async function getAllOperationalHours(env, tenantId) {
  const rows = await env.DB.prepare("SELECT * FROM operational_hours WHERE tenant_id = ? ORDER BY day_of_week ASC")
    .bind(tenantId)
    .all();
  return rows.results;
}

export const THEME_PRESET_IDS = ["hijau", "merah", "biru", "ungu", "oranye", "pink"];
export const DEFAULT_THEME_PRESET = "hijau";
export const RECEIPT_PAPER_WIDTHS = ["58", "80"];
export const DEFAULT_RECEIPT_PAPER_WIDTH = "58";

// Logika murni (tanpa query DB) untuk menghitung status buka/tutup dari baris
// settings + jam operasional HARI INI yang sudah diambil sebelumnya. Dipakai
// bareng oleh getStoreStatus (1 tenant) dan getStoreStatusForTenants (banyak
// tenant sekaligus) supaya hasilnya selalu konsisten satu sama lain.
function computeStoreStatus(settingsMap, hoursRow, dow) {
  const manualClosed = settingsMap.manual_closed === "1";
  const manualClosedNote = settingsMap.manual_closed_note || "";
  const themePreset = THEME_PRESET_IDS.includes(settingsMap.theme_preset) ? settingsMap.theme_preset : DEFAULT_THEME_PRESET;
  const qrisImageUrl = settingsMap.qris_image_url || "";
  const notificationSoundUrl = settingsMap.notification_sound_url || "";
  const receiptPaperWidth = RECEIPT_PAPER_WIDTHS.includes(settingsMap.receipt_paper_width)
    ? settingsMap.receipt_paper_width
    : DEFAULT_RECEIPT_PAPER_WIDTH;

  const openTime = hoursRow?.open_time || "08:00";
  const closeTime = hoursRow?.close_time || "22:00";
  const todayIsOperatingDay = hoursRow ? !!hoursRow.is_open : true;

  const base = {
    open_time: openTime,
    close_time: closeTime,
    day_of_week: dow,
    theme_preset: themePreset,
    qris_image_url: qrisImageUrl,
    notification_sound_url: notificationSoundUrl,
    receipt_paper_width: receiptPaperWidth,
  };

  if (manualClosed) {
    return {
      ...base,
      is_open: false,
      reason: "manual",
      manual_closed: true,
      manual_closed_note: manualClosedNote,
      is_operating_day: todayIsOperatingDay,
    };
  }

  if (!todayIsOperatingDay) {
    return {
      ...base,
      is_open: false,
      reason: "day_off",
      manual_closed: false,
      manual_closed_note: "",
      is_operating_day: false,
    };
  }

  const withinHours = isWithinOperatingHours(openTime, closeTime, nowTimeStringWIB());
  return {
    ...base,
    is_open: withinHours,
    reason: withinHours ? "open" : "outside_hours",
    manual_closed: false,
    manual_closed_note: "",
    is_operating_day: true,
  };
}

const STORE_STATUS_SETTING_KEYS = [
  "manual_closed",
  "manual_closed_note",
  "theme_preset",
  "qris_image_url",
  "notification_sound_url",
  "receipt_paper_width",
];

// Ambil status toko (jam operasional PER HARI + saklar tutup manual) milik satu tenant
export async function getStoreStatus(env, tenantId) {
  const rows = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${STORE_STATUS_SETTING_KEYS.map(() => "?").join(",")})`
  )
    .bind(tenantId, ...STORE_STATUS_SETTING_KEYS)
    .all();

  const settingsMap = {};
  for (const row of rows.results) settingsMap[row.key] = row.value;

  const dow = dayOfWeekWIB();
  const hoursRow = await env.DB.prepare("SELECT * FROM operational_hours WHERE tenant_id = ? AND day_of_week = ?")
    .bind(tenantId, dow)
    .first();

  return computeStoreStatus(settingsMap, hoursRow, dow);
}

// OPTIMASI D1 — versi BATCH dari getStoreStatus untuk banyak tenant sekaligus
// (dipakai handlePublicMenuAll, yang di-poll halaman Customer & Kasir). Dulu:
// 2 query PER tenant (settings + operational_hours) dalam sebuah loop — untuk
// 10 stan jadi 20 query setiap kali endpoint ini dipanggil. Sekarang: 2 query
// TOTAL tidak peduli berapa banyak tenant-nya. Hasil per tenant identik
// dengan hasil getStoreStatus(env, tenantId) untuk tenant yang sama.
// Return: Map<tenant_id, status>.
export async function getStoreStatusForTenants(env, tenantIds) {
  const statusByTenant = new Map();
  if (!tenantIds || tenantIds.length === 0) return statusByTenant;

  const dow = dayOfWeekWIB();
  const idPlaceholders = tenantIds.map(() => "?").join(",");
  const keyPlaceholders = STORE_STATUS_SETTING_KEYS.map(() => "?").join(",");

  const [settingsRows, hoursRows] = await Promise.all([
    env.DB.prepare(
      `SELECT tenant_id, key, value FROM settings WHERE tenant_id IN (${idPlaceholders}) AND key IN (${keyPlaceholders})`
    )
      .bind(...tenantIds, ...STORE_STATUS_SETTING_KEYS)
      .all(),
    env.DB.prepare(`SELECT * FROM operational_hours WHERE tenant_id IN (${idPlaceholders}) AND day_of_week = ?`)
      .bind(...tenantIds, dow)
      .all(),
  ]);

  const settingsByTenant = new Map();
  for (const row of settingsRows.results) {
    if (!settingsByTenant.has(row.tenant_id)) settingsByTenant.set(row.tenant_id, {});
    settingsByTenant.get(row.tenant_id)[row.key] = row.value;
  }

  const hoursByTenant = new Map();
  for (const row of hoursRows.results) hoursByTenant.set(row.tenant_id, row);

  for (const tenantId of tenantIds) {
    statusByTenant.set(
      tenantId,
      computeStoreStatus(settingsByTenant.get(tenantId) || {}, hoursByTenant.get(tenantId) || null, dow)
    );
  }

  return statusByTenant;
}

// ============================================
// KASIR: hashing password (PBKDF2-SHA256) + token session
// ============================================

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  return diff === 0;
}

export function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// Token pendek & mudah dibaca (dipakai untuk admin_token/kitchen_token tenant baru)
export function generateReadableToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(6)));
}

// ============================================
// SUPERADMIN: token superadmin GLOBAL (env.SUPERADMIN_TOKEN), terpisah dari
// admin_token/kitchen_token tiap tenant. Dipakai HANYA untuk endpoint /superadmin/*
// (kelola tenant, aktivitas, backup, reset per tenant).
// ============================================
export function isSuperadmin(request, env) {
  if (!env.SUPERADMIN_TOKEN) return false;
  return isAuthorized(request, env.SUPERADMIN_TOKEN);
}

// ============================================
// MULTI-TENANT: resolusi tenant dari slug di segmen pertama path URL.
// Mengembalikan null kalau slug kosong / tenant tidak ada / tenant dinonaktifkan.
// ============================================
export async function resolveTenant(env, slug) {
  if (!slug) return null;
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE slug = ?").bind(slug).first();
  if (!tenant || !tenant.is_active) return null;
  return tenant;
}

// ============================================
// ACTIVITY LOG: mencatat aktivitas penting, di-scope ke tenant (tenantId boleh null
// untuk aksi level superadmin seperti membuat/menghapus tenant).
// ============================================
export async function logActivity(env, tenantId, actorType, actorName, action, detail) {
  try {
    await env.DB.prepare(
      `INSERT INTO activity_log (tenant_id, actor_type, actor_name, action, detail) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(tenantId ?? null, actorType, actorName || null, action, detail || null)
      .run();
  } catch (err) {
    console.error("Gagal mencatat activity_log:", err);
  }
}

// ============================================
// KASIR GLOBAL: satu akun kasir bisa memproses pesanan untuk SEMUA stan
// sekaligus (tidak terikat 1 tenant) — lihat tabel global_cashiers /
// global_cashier_sessions di schema.sql. Cek sesi dari header
// Authorization: Bearer <token> (atau ?token= untuk fallback).
// ============================================
export async function requireGlobalCashier(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const [scheme, headerToken] = auth.split(" ");
  const qToken = new URL(request.url).searchParams.get("token");
  const token = scheme === "Bearer" ? headerToken : qToken;
  if (!token) return null;

  const session = await env.DB.prepare(
    `SELECT cs.cashier_id as id, c.username, c.name, c.is_active
     FROM global_cashier_sessions cs
     JOIN global_cashiers c ON c.id = cs.cashier_id
     WHERE cs.token = ? AND cs.expires_at > datetime('now')`
  )
    .bind(token)
    .first();

  if (!session || !session.is_active) return null;
  return { id: session.id, username: session.username, name: session.name };
}
