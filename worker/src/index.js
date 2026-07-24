import {
  json,
  error,
  CORS_HEADERS,
  isValidPhone,
  normalizePhone,
  isAuthorizedAny,
  isSuperadmin,
  logActivity,
  todayDateString,
  dateDaysAgoString,
  hashPassword,
  verifyPassword,
  generateToken,
  generateReadableToken,
  requireGlobalCashier,
  getStoreStatus,
  getStoreStatusForTenants,
  fetchOrderItemsByOrderIds,
  getAllOperationalHours,
  nowTimeStringWIB,
  wibDateTimeToUtcString,
  resolveTenant,
  THEME_PRESET_IDS,
  RECEIPT_PAPER_WIDTHS,
} from "./utils.js";

// CATATAN: Durable Object "OrderStream" (dipakai untuk siaran real-time lewat SSE) sudah
// DIHAPUS total. Frontend polling biasa (fetch berkala) untuk order baru & perubahan
// tema/pengaturan, jadi endpoint /orders/stream & /settings/stream tidak diperlukan lagi.
//
// MULTI-TENANT: setiap warung (tenant) diakses lewat prefix slug di URL, contoh:
//   https://kitchen-order-api.xxx.workers.dev/warung-kita/menu
//   https://kitchen-order-api.xxx.workers.dev/warung-kita/admin/menu
// Frontend (satu deployment untuk semua tenant) membaca slug dari path React Router
// (domain.com/warung-kita/order, dst) dan mengirim slug yang sama sebagai prefix ke API.
//
// Endpoint /superadmin/* TIDAK memakai prefix slug — superadmin mengelola SEMUA tenant
// lewat token global (env.SUPERADMIN_TOKEN), termasuk membuat tenant baru.
//
// SINGLE KASIR GLOBAL: endpoint /kasir/* JUGA tidak memakai prefix slug — satu akun
// kasir (tabel global_cashiers) bisa membuat & memverifikasi pesanan lintas SEMUA
// stan sekaligus lewat 1 transaksi (item boleh campuran dari beberapa stan), yang di
// belakang layar dipecah jadi beberapa baris `orders` (1 per stan, ditandai
// order_group_code yang sama) supaya dapur tiap stan tetap hanya melihat pesanan
// miliknya sendiri.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // ---------- SUPERADMIN: tidak pakai prefix tenant, token global terpisah ----------
      if (path === "/superadmin" || path.startsWith("/superadmin/")) {
        return handleSuperadminRoute(request, env, path, method);
      }

      // ---------- PUBLIC GLOBAL: menu gabungan SEMUA tenant aktif (dipakai halaman
      // customer supaya bisa menampilkan menu semua warung sekaligus, dikelompokkan
      // per kategori dengan nama warung ditempel di tiap item). Tidak pakai prefix
      // slug karena memang lintas tenant. ----------
      if (path === "/public/menu-all" && method === "GET") {
        return handlePublicMenuAll(env);
      }

      // ---------- KASIR GLOBAL: tidak pakai prefix slug — 1 akun kasir untuk
      // SEMUA stan sekaligus (lihat komentar besar di atas file ini). ----------
      if (path === "/kasir" || path.startsWith("/kasir/")) {
        return handleKasirRoute(request, env, path, method);
      }

      // ---------- SEMUA endpoint lain: WAJIB prefix /:tenantSlug/... ----------
      const segments = path.split("/").filter(Boolean);
      const slug = segments[0];
      const subPath = "/" + segments.slice(1).join("/");

      const tenant = await resolveTenant(env, slug);
      if (!tenant) return error("Warung tidak ditemukan atau sedang tidak aktif", 404);

      const ADMIN_TOKEN = tenant.admin_token;
      const KITCHEN_TOKEN = tenant.kitchen_token;

      // ---------- PUBLIC: LOGIN ----------
      if (subPath === "/login" && method === "POST") {
        return handleLogin(request, env, tenant);
      }

      // ---------- PUBLIC: MENU (customer) ----------
      if (subPath === "/menu" && method === "GET") {
        return handleGetMenu(env, tenant);
      }

      // ---------- PUBLIC: STATUS TOKO (jam operasional / tutup manual) ----------
      if (subPath === "/store-status" && method === "GET") {
        const status = await getStoreStatus(env, tenant.id);
        return json({ ...status, tenant_name: tenant.name, tenant_slug: tenant.slug });
      }

      // ---------- PUBLIC: ORDER ----------
      if (subPath === "/order" && method === "POST") {
        return handleCreateOrder(request, env, tenant);
      }

      // ---------- PUBLIC: RIWAYAT PESANAN CUSTOMER ----------
      if (subPath === "/my-orders" && method === "GET") {
        return handleGetMyOrders(request, env, tenant);
      }

      // ---------- KITCHEN (perlu token) ----------
      if (subPath === "/orders" && method === "GET") {
        if (!isAuthorizedAny(request, [KITCHEN_TOKEN, ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleGetOrders(request, env, tenant);
      }

      if (subPath === "/order/status" && method === "PATCH") {
        if (!isAuthorizedAny(request, [KITCHEN_TOKEN, ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleUpdateOrderStatus(request, env, tenant);
      }

      // ---------- ADMIN (perlu token) ----------
      if (subPath === "/admin/menu" && method === "GET") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminGetMenu(env, tenant);
      }

      if (subPath === "/admin/menu" && method === "POST") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminCreateMenu(request, env, tenant);
      }

      const editMenuMatch = subPath.match(/^\/admin\/menu\/(\d+)$/);
      if (editMenuMatch && method === "PATCH") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminEditMenu(request, env, tenant, Number(editMenuMatch[1]));
      }

      const toggleMatch = subPath.match(/^\/admin\/menu\/(\d+)\/toggle-active$/);
      if (toggleMatch && method === "PATCH") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminToggleActive(env, tenant, Number(toggleMatch[1]));
      }

      if (editMenuMatch && method === "DELETE") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminDeleteMenu(env, tenant, Number(editMenuMatch[1]));
      }

      const addonMatch = subPath.match(/^\/admin\/menu\/(\d+)\/addons$/);
      if (addonMatch && method === "POST") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminAddAddon(request, env, tenant, Number(addonMatch[1]));
      }

      const deleteAddonMatch = subPath.match(/^\/admin\/menu\/(\d+)\/addons\/(\d+)$/);
      if (deleteAddonMatch && method === "DELETE") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminDeleteAddon(env, tenant, Number(deleteAddonMatch[1]), Number(deleteAddonMatch[2]));
      }

      const availableMatch = subPath.match(/^\/admin\/menu\/(\d+)\/toggle-available$/);
      if (availableMatch && method === "PATCH") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminToggleAvailable(env, tenant, Number(availableMatch[1]));
      }

      if (subPath === "/admin/upload" && method === "POST") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminUpload(request, env);
      }

      // ---------- ADMIN: PENGATURAN JAM OPERASIONAL & TUTUP MANUAL ----------
      if (subPath === "/admin/settings" && method === "GET") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        const status = await getStoreStatus(env, tenant.id);
        const hours = await getAllOperationalHours(env, tenant.id);
        return json({ ...status, hours });
      }

      if (subPath === "/admin/settings" && method === "PATCH") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminUpdateSettings(request, env, tenant);
      }

      // ---------- ADMIN: GANTI TOKEN LOGIN ADMIN & KITCHEN (disimpan di tabel tenants) ----------
      if (subPath === "/admin/tokens" && method === "PATCH") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminUpdateTokens(request, env, tenant);
      }

      // ---------- ADMIN: LAPORAN ----------
      if (subPath === "/admin/reports" && method === "GET") {
        if (!isAuthorizedAny(request, [ADMIN_TOKEN, env.SUPERADMIN_TOKEN])) return error("Unauthorized", 401);
        return handleAdminReports(request, env, tenant);
      }

      // CATATAN: endpoint /cashier/* & /admin/cashiers (kasir PER-TENANT) sudah
      // DIHAPUS total — diganti kasir GLOBAL di /kasir/* (lihat handleKasirRoute),
      // dikelola dari Superadmin -> "Kasir Global".

      return error("Not found", 404);
    } catch (err) {
      console.error(err);
      return error("Terjadi kesalahan server: " + err.message, 500);
    }
  },
};

// ============================================
// LOGIN (customer, per tenant)
// ============================================
async function handleLogin(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body || !isValidPhone(body.phone)) {
    return error("Nomor HP tidak valid");
  }
  const phone = normalizePhone(body.phone);

  let user = await env.DB.prepare("SELECT * FROM users WHERE tenant_id = ? AND phone = ?")
    .bind(tenant.id, phone)
    .first();
  const isReturning = !!user;

  if (!user) {
    if (!body.name || body.name.trim().length < 2) {
      return error("Nama wajib diisi untuk pendaftaran pertama kali");
    }
    user = await env.DB.prepare(
      "INSERT INTO users (tenant_id, name, phone) VALUES (?, ?, ?) RETURNING *"
    )
      .bind(tenant.id, body.name.trim(), phone)
      .first();
  }

  await logActivity(env, tenant.id, "customer", user.name, isReturning ? "login" : "register", phone);

  return json({ user, is_returning: isReturning });
}

// ============================================
// MENU (customer, publik, per tenant)
// ============================================
async function handleGetMenu(env, tenant) {
  const menus = await env.DB.prepare(
    "SELECT id, name, price, category, description, image_url, is_available FROM menu WHERE tenant_id = ? AND is_active = 1 ORDER BY category, name"
  )
    .bind(tenant.id)
    .all();

  const addons = await env.DB.prepare(
    `SELECT ma.id, ma.menu_id, ma.name, ma.extra_price
     FROM menu_addons ma
     JOIN menu m ON m.id = ma.menu_id
     WHERE m.tenant_id = ? AND m.is_active = 1`
  )
    .bind(tenant.id)
    .all();

  const addonsByMenu = {};
  for (const a of addons.results) {
    if (!addonsByMenu[a.menu_id]) addonsByMenu[a.menu_id] = [];
    addonsByMenu[a.menu_id].push(a);
  }

  const result = menus.results.map((m) => ({
    ...m,
    addons: addonsByMenu[m.id] || [],
  }));

  return json({ menu: result });
}

// ============================================
// PUBLIC GLOBAL: menu gabungan semua tenant AKTIF, ditandai per item dengan
// tenant_slug/tenant_name/tenant_is_open supaya frontend bisa menampilkan satu
// daftar menu lintas warung, dikelompokkan per kategori. Order tetap dikirim
// ke tenant masing-masing lewat /:slug/order seperti biasa — endpoint ini
// HANYA untuk menampilkan, tidak untuk membuat order.
// ============================================
async function handlePublicMenuAll(env) {
  const tenantsRows = await env.DB.prepare("SELECT id, slug, name FROM tenants WHERE is_active = 1").all();

  // OPTIMASI D1: dulu status tiap tenant diambil satu-satu dalam loop (2 query
  // per tenant) — endpoint ini di-poll halaman Customer tiap 2 menit & Kasir
  // tiap 20 detik, jadi makin banyak stan makin berat. Sekarang 2 query TOTAL
  // untuk semua tenant sekaligus (lihat getStoreStatusForTenants di utils.js).
  const tenantIds = tenantsRows.results.map((t) => t.id);
  const statusByTenant = await getStoreStatusForTenants(env, tenantIds);

  const tenantsById = {};
  for (const t of tenantsRows.results) {
    const status = statusByTenant.get(t.id);
    tenantsById[t.id] = {
      id: t.id,
      slug: t.slug,
      name: t.name,
      is_open: status.is_open,
      reason: status.reason,
      open_time: status.open_time,
      close_time: status.close_time,
      qris_image_url: status.qris_image_url,
    };
  }

  const menus = await env.DB.prepare(
    `SELECT m.id, m.tenant_id, m.name, m.price, m.category, m.description, m.image_url, m.is_available
     FROM menu m
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.is_active = 1 AND t.is_active = 1
     ORDER BY m.category, m.name`
  ).all();

  const addons = await env.DB.prepare(
    `SELECT ma.id, ma.menu_id, ma.name, ma.extra_price
     FROM menu_addons ma
     JOIN menu m ON m.id = ma.menu_id
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.is_active = 1 AND t.is_active = 1`
  ).all();

  const addonsByMenu = {};
  for (const a of addons.results) {
    if (!addonsByMenu[a.menu_id]) addonsByMenu[a.menu_id] = [];
    addonsByMenu[a.menu_id].push(a);
  }

  const menu = menus.results.map((m) => {
    const t = tenantsById[m.tenant_id] || {};
    return {
      ...m,
      tenant_slug: t.slug,
      tenant_name: t.name,
      tenant_is_open: !!t.is_open,
      addons: addonsByMenu[m.id] || [],
    };
  });

  return json({ menu, tenants: tenantsById });
}

// ============================================
// ORDER — dengan hitung total di server + rate limit (per tenant)
// ============================================
async function handleCreateOrder(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body) return error("Body request tidak valid");

  const { phone, name, payment_method, items, note, pickup_type, pickup_time } = body;

  if (!isValidPhone(phone)) return error("Nomor HP tidak valid");
  if (!name || name.trim().length < 2) return error("Nama wajib diisi");
  if (!["cash", "qris"].includes(payment_method)) {
    return error("Metode pembayaran tidak valid");
  }
  if (!Array.isArray(items) || items.length === 0) {
    return error("Keranjang tidak boleh kosong");
  }

  const storeStatus = await getStoreStatus(env, tenant.id);
  if (!storeStatus.is_open) {
    return error(
      storeStatus.reason === "manual"
        ? `Toko sedang tutup sementara${storeStatus.manual_closed_note ? ": " + storeStatus.manual_closed_note : ""}.`
        : storeStatus.reason === "day_off"
        ? "Toko tutup hari ini."
        : `Toko sedang tutup. Jam buka: ${storeStatus.open_time} - ${storeStatus.close_time}.`,
      403
    );
  }

  const pickupType = pickup_type === "scheduled" ? "scheduled" : "now";
  let pickupTimeUtc = null;

  if (pickupType === "scheduled") {
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timePattern.test(pickup_time || "")) {
      return error("Jam pengambilan tidak valid (format HH:MM)");
    }
    const today = todayDateString();
    pickupTimeUtc = wibDateTimeToUtcString(today, pickup_time);
    const nowUtc = wibDateTimeToUtcString(today, nowTimeStringWIB());

    if (pickupTimeUtc <= nowUtc) {
      return error("Jam pengambilan harus di waktu yang akan datang");
    }
    if (!isWithinPickupWindow(pickup_time, storeStatus.open_time, storeStatus.close_time)) {
      return error(`Jam pengambilan harus di antara ${storeStatus.open_time} - ${storeStatus.close_time}`);
    }
  }

  const normalizedPhone = normalizePhone(phone);
  const maxActive = Number(env.MAX_ACTIVE_ORDERS_PER_PHONE || 3);

  const activeCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE tenant_id = ? AND user_phone = ? AND status IN ('pending','diproses')"
  )
    .bind(tenant.id, normalizedPhone)
    .first();

  if (activeCount.count >= maxActive) {
    return error(
      `Anda masih punya ${activeCount.count} pesanan yang belum selesai. Selesaikan dulu sebelum order lagi.`,
      429
    );
  }

  const resolved = await resolveOrderItems(env, tenant, items);
  if (resolved.error) return error(resolved.error);

  const date = todayDateString();
  const dailyOrderNumber = await nextQueueNumber(env, {
    counterTable: "daily_counters",
    tenantId: tenant.id,
    date,
    orderSource: "self",
  });
  const orderCode = "A" + String(dailyOrderNumber).padStart(3, "0");

  const order = await env.DB.prepare(
    `INSERT INTO orders
       (tenant_id, daily_order_number, order_date, user_name, user_phone, payment_method, total, status, order_source, order_code, payment_status, pickup_type, pickup_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'self', ?, 'unpaid', ?, ?)
     RETURNING *`
  )
    .bind(
      tenant.id,
      dailyOrderNumber,
      date,
      name.trim(),
      normalizedPhone,
      payment_method,
      resolved.total,
      orderCode,
      pickupType,
      pickupTimeUtc
    )
    .first();

  await insertOrderItems(env, order.id, resolved.resolvedItems);

  await logActivity(env, tenant.id, "customer", name.trim(), "create_order", orderCode);

  return json({ order }, 201);
}

function isWithinPickupWindow(pickupTime, openTime, closeTime) {
  if (!openTime || !closeTime || openTime === closeTime) return true;
  if (openTime < closeTime) {
    return pickupTime >= openTime && pickupTime <= closeTime;
  }
  return pickupTime >= openTime || pickupTime <= closeTime;
}

// ============================================
// PUBLIC: riwayat pesanan customer (self-order) berdasarkan nomor HP miliknya sendiri.
// ============================================
async function handleGetMyOrders(request, env, tenant) {
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");

  if (!isValidPhone(phone)) return error("Nomor HP tidak valid");
  const normalizedPhone = normalizePhone(phone);

  const orders = await env.DB.prepare(
    `SELECT * FROM orders
     WHERE tenant_id = ? AND user_phone = ? AND order_source = 'self'
     ORDER BY created_at DESC
     LIMIT 30`
  )
    .bind(tenant.id, normalizedPhone)
    .all();

  // OPTIMASI D1: sama seperti fix di handleGetOrders (Kitchen) & handleKasirGetOrders
  // (Kasir) — batch, bukan 1 query per order + 1 query per item.
  const orderIds = orders.results.map((o) => o.id);
  const itemsByOrder = await fetchOrderItemsByOrderIds(env, orderIds);
  const fullOrders = orders.results.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
  }));

  return json({ orders: fullOrders });
}

// ============================================
// Helper bersama: resolusi item order dari DB (harga & addon terpercaya, di-scope
// ke tenant supaya id menu/addon dari warung lain tidak bisa dipesan silang),
// nomor urut harian atomik, dan penyisipan order_items + addons.
// ============================================
async function resolveOrderItems(env, tenant, items) {
  let total = 0;
  const resolvedItems = [];

  for (const item of items) {
    const menu = await env.DB.prepare("SELECT * FROM menu WHERE id = ? AND tenant_id = ? AND is_active = 1")
      .bind(item.menu_id, tenant.id)
      .first();

    if (!menu) {
      return { error: `Menu dengan id ${item.menu_id} tidak ditemukan atau sudah nonaktif` };
    }
    if (!menu.is_available) {
      return { error: `${menu.name} sedang habis, tidak bisa dipesan saat ini` };
    }

    const qty = Number(item.qty) || 1;
    if (qty < 1) return { error: "Jumlah item tidak valid" };

    let itemTotal = menu.price * qty;
    const resolvedAddons = [];

    if (Array.isArray(item.addon_ids)) {
      for (const addonId of item.addon_ids) {
        const addon = await env.DB.prepare("SELECT * FROM menu_addons WHERE id = ? AND menu_id = ?")
          .bind(addonId, item.menu_id)
          .first();
        if (!addon) return { error: `Addon dengan id ${addonId} tidak valid untuk menu ini` };
        itemTotal += addon.extra_price * qty;
        resolvedAddons.push(addon);
      }
    }

    total += itemTotal;
    resolvedItems.push({ menu, qty, note: item.note || null, addons: resolvedAddons });
  }

  return { total, resolvedItems };
}

const MAX_QUEUE_NUMBER = 50;

// Ambil nomor antrian berikutnya (1..50, lalu roll balik ke 1) secara atomik, per tenant.
async function nextQueueNumber(env, { counterTable, tenantId, date, orderSource }) {
  let candidate = null;

  for (let attempt = 0; attempt < MAX_QUEUE_NUMBER; attempt++) {
    const row = await env.DB.prepare(
      `INSERT INTO ${counterTable} (tenant_id, date, counter) VALUES (?, ?, 1)
       ON CONFLICT(tenant_id, date) DO UPDATE SET counter = counter + 1
       RETURNING counter`
    )
      .bind(tenantId, date)
      .first();

    candidate = ((row.counter - 1) % MAX_QUEUE_NUMBER) + 1;

    const clash = await env.DB.prepare(
      `SELECT id FROM orders
       WHERE tenant_id = ? AND order_date = ? AND order_source = ? AND daily_order_number = ?
         AND status IN ('pending','diproses')
       LIMIT 1`
    )
      .bind(tenantId, date, orderSource, candidate)
      .first();

    if (!clash) return candidate;
  }

  return candidate;
}

async function insertOrderItems(env, orderId, resolvedItems) {
  for (const item of resolvedItems) {
    const orderItem = await env.DB.prepare(
      `INSERT INTO order_items (order_id, menu_id, menu_name, menu_price, qty, note)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(orderId, item.menu.id, item.menu.name, item.menu.price, item.qty, item.note)
      .first();

    for (const addon of item.addons) {
      await env.DB.prepare(
        `INSERT INTO order_item_addons (order_item_id, addon_id, addon_name, addon_price)
         VALUES (?, ?, ?, ?)`
      )
        .bind(orderItem.id, addon.id, addon.name, addon.extra_price)
        .run();
    }
  }
}

// ============================================================================
// KASIR GLOBAL — router kecil sendiri untuk /kasir/*, TIDAK pakai prefix slug
// (satu akun kasir lintas semua stan). Dipanggil dari fetch() di atas.
// ============================================================================
async function handleKasirRoute(request, env, path, method) {
  if (path === "/kasir/login" && method === "POST") {
    return handleKasirLogin(request, env);
  }

  if (path === "/kasir/logout" && method === "POST") {
    return handleKasirLogout(request, env);
  }

  if (path === "/kasir/orders" && method === "GET") {
    const cashier = await requireGlobalCashier(request, env);
    if (!cashier) return error("Unauthorized", 401);
    return handleKasirGetOrders(request, env);
  }

  if (path === "/kasir/order" && method === "POST") {
    const cashier = await requireGlobalCashier(request, env);
    if (!cashier) return error("Unauthorized", 401);
    return handleKasirCreateOrder(request, env, cashier);
  }

  const verifyMatch = path.match(/^\/kasir\/order\/(\d+)\/verify-payment$/);
  if (verifyMatch && method === "PATCH") {
    const cashier = await requireGlobalCashier(request, env);
    if (!cashier) return error("Unauthorized", 401);
    return handleKasirVerifyPayment(env, Number(verifyMatch[1]), cashier);
  }

  const availableMatch = path.match(/^\/kasir\/menu\/(\d+)\/toggle-available$/);
  if (availableMatch && method === "PATCH") {
    const cashier = await requireGlobalCashier(request, env);
    if (!cashier) return error("Unauthorized", 401);
    return handleKasirToggleMenuAvailable(env, Number(availableMatch[1]));
  }

  return error("Not found", 404);
}

async function handleKasirLogin(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password) {
    return error("Username dan password wajib diisi");
  }

  const cashier = await env.DB.prepare("SELECT * FROM global_cashiers WHERE username = ?")
    .bind(body.username.trim())
    .first();

  if (!cashier || !cashier.is_active) return error("Username atau password salah", 401);

  const valid = await verifyPassword(body.password, cashier.password_salt, cashier.password_hash);
  if (!valid) return error("Username atau password salah", 401);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare("INSERT INTO global_cashier_sessions (cashier_id, token, expires_at) VALUES (?, ?, ?)")
    .bind(cashier.id, token, expiresAt)
    .run();

  await logActivity(env, null, "cashier", cashier.name, "login", cashier.username);

  return json({ token, cashier: { id: cashier.id, username: cashier.username, name: cashier.name } });
}

async function handleKasirLogout(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const [, token] = auth.split(" ");
  if (token) {
    const session = await env.DB.prepare(
      `SELECT c.name FROM global_cashier_sessions cs JOIN global_cashiers c ON c.id = cs.cashier_id WHERE cs.token = ?`
    )
      .bind(token)
      .first();
    await env.DB.prepare("DELETE FROM global_cashier_sessions WHERE token = ?").bind(token).run();
    if (session) await logActivity(env, null, "cashier", session.name, "logout", null);
  }
  return json({ ok: true });
}

// Resolusi item keranjang kasir LINTAS STAN: setiap item cukup kirim menu_id
// (id menu sudah unik global lintas tenant), tenant pemiliknya ditentukan dari
// data menu itu sendiri di DB (bukan dari input klien) supaya tidak bisa
// dipalsukan. Hasilnya dikelompokkan per tenant_id, karena tiap stan tetap
// butuh baris `orders` sendiri (nomor antrian & tampilan dapur per stan).
async function resolveOrderItemsMultiTenant(env, items) {
  const groups = {}; // tenantId -> { tenant: {id,slug,name}, total, resolvedItems: [] }

  for (const item of items) {
    const menu = await env.DB.prepare(
      `SELECT m.*, t.id as t_id, t.slug as t_slug, t.name as t_name, t.is_active as t_active
       FROM menu m JOIN tenants t ON t.id = m.tenant_id
       WHERE m.id = ? AND m.is_active = 1`
    )
      .bind(item.menu_id)
      .first();

    if (!menu) return { error: `Menu dengan id ${item.menu_id} tidak ditemukan atau sudah nonaktif` };
    if (!menu.t_active) return { error: `Stan ${menu.t_name} sedang tidak aktif` };
    if (!menu.is_available) return { error: `${menu.name} (${menu.t_name}) sedang habis, tidak bisa dipesan saat ini` };

    const qty = Number(item.qty) || 1;
    if (qty < 1) return { error: "Jumlah item tidak valid" };

    let itemTotal = menu.price * qty;
    const resolvedAddons = [];

    if (Array.isArray(item.addon_ids)) {
      for (const addonId of item.addon_ids) {
        const addon = await env.DB.prepare("SELECT * FROM menu_addons WHERE id = ? AND menu_id = ?")
          .bind(addonId, item.menu_id)
          .first();
        if (!addon) return { error: `Addon dengan id ${addonId} tidak valid untuk menu ini` };
        itemTotal += addon.extra_price * qty;
        resolvedAddons.push(addon);
      }
    }

    const tenantId = menu.t_id;
    if (!groups[tenantId]) {
      groups[tenantId] = {
        tenant: { id: menu.t_id, slug: menu.t_slug, name: menu.t_name },
        total: 0,
        resolvedItems: [],
      };
    }
    groups[tenantId].total += itemTotal;
    groups[tenantId].resolvedItems.push({ menu, qty, note: item.note || null, addons: resolvedAddons });
  }

  return { groups };
}

// Order dibuat langsung oleh kasir (walk-in) -> kode D###. Satu transaksi kasir
// boleh berisi item campuran dari beberapa stan sekaligus (1 struk pelanggan),
// tapi di belakang layar dipecah jadi 1 baris `orders` PER STAN (masing-masing
// dapat nomor antrian sendiri di stan itu) supaya dapur tiap stan tetap hanya
// melihat pesanan miliknya. Kalau lebih dari 1 stan terlibat, semua baris order
// hasil transaksi ini ditandai order_group_code yang sama.
async function handleKasirCreateOrder(request, env, cashier) {
  const body = await request.json().catch(() => null);
  if (!body) return error("Body request tidak valid");

  const { phone, name, payment_method, items, mark_paid } = body;

  if (!["cash", "qris"].includes(payment_method)) {
    return error("Metode pembayaran tidak valid");
  }
  if (!Array.isArray(items) || items.length === 0) {
    return error("Keranjang tidak boleh kosong");
  }

  let normalizedPhone = "-";
  if (phone && phone.trim()) {
    if (!isValidPhone(phone)) return error("Nomor HP tidak valid");
    normalizedPhone = normalizePhone(phone);
  }
  const customerName = name && name.trim().length >= 2 ? name.trim() : "Pelanggan Kasir";

  const resolved = await resolveOrderItemsMultiTenant(env, items);
  if (resolved.error) return error(resolved.error);

  const tenantIds = Object.keys(resolved.groups);

  // Cek status buka/tutup manual TIAP stan yang terlibat SEBELUM menyimpan apa
  // pun — supaya transaksi tidak "setengah jalan" (sebagian stan dapat order,
  // sebagian tidak) kalau salah satu stan ternyata sedang tutup manual.
  for (const tid of tenantIds) {
    const status = await getStoreStatus(env, Number(tid));
    if (status.reason === "manual") {
      return error(
        `Stan "${resolved.groups[tid].tenant.name}" sedang ditutup manual${status.manual_closed_note ? ": " + status.manual_closed_note : ""}. Buka lagi dulu (lewat Dashboard Admin stan itu) sebelum membuat pesanan untuk stan ini.`,
        403
      );
    }
  }

  const date = todayDateString();
  const orderGroupCode = tenantIds.length > 1 ? "G" + generateReadableToken().toUpperCase() : null;
  const paymentStatus = mark_paid === false ? "unpaid" : "paid";
  const createdOrders = [];

  for (const tid of tenantIds) {
    const group = resolved.groups[tid];
    const dailyOrderNumber = await nextQueueNumber(env, {
      counterTable: "daily_counters_kasir",
      tenantId: Number(tid),
      date,
      orderSource: "kasir",
    });
    const orderCode = "D" + String(dailyOrderNumber).padStart(3, "0");

    const order = await env.DB.prepare(
      `INSERT INTO orders
         (tenant_id, daily_order_number, order_date, user_name, user_phone, payment_method, total, status,
          order_source, order_code, payment_status, cashier_id, payment_verified_by, payment_verified_at, order_group_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'kasir', ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(
        Number(tid),
        dailyOrderNumber,
        date,
        customerName,
        normalizedPhone,
        payment_method,
        group.total,
        orderCode,
        paymentStatus,
        cashier.id,
        paymentStatus === "paid" ? cashier.id : null,
        paymentStatus === "paid" ? new Date().toISOString() : null,
        orderGroupCode
      )
      .first();

    await insertOrderItems(env, order.id, group.resolvedItems);

    await logActivity(
      env,
      Number(tid),
      "cashier",
      cashier.name,
      "create_order",
      orderCode + (orderGroupCode ? ` (transaksi gabungan ${orderGroupCode})` : "")
    );

    createdOrders.push({ ...order, tenant_slug: group.tenant.slug, tenant_name: group.tenant.name });
  }

  return json({ order_group_code: orderGroupCode, orders: createdOrders }, 201);
}

// Verifikasi pembayaran 1 order. Kalau order itu bagian dari transaksi gabungan
// lintas stan (order_group_code terisi), SEMUA baris order lain dengan kode
// grup yang sama ikut diverifikasi sekaligus — karena di mata pelanggan itu
// cuma 1x bayar untuk 1 struk, walau di database jadi beberapa baris order.
async function handleKasirVerifyPayment(env, orderId, cashier) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return error("Order tidak ditemukan", 404);
  if (order.payment_status === "paid") return json({ orders: [order] });

  let targets = [order];
  if (order.order_group_code) {
    const siblings = await env.DB.prepare(
      "SELECT * FROM orders WHERE order_group_code = ? AND payment_status != 'paid'"
    )
      .bind(order.order_group_code)
      .all();
    targets = siblings.results;
  }

  const updatedOrders = [];
  for (const o of targets) {
    const updated = await env.DB.prepare(
      `UPDATE orders SET payment_status = 'paid', payment_verified_by = ?, payment_verified_at = datetime('now')
       WHERE id = ? RETURNING *`
    )
      .bind(cashier.id, o.id)
      .first();
    await logActivity(env, updated.tenant_id, "cashier", cashier.name, "verify_payment", updated.order_code);
    updatedOrders.push(updated);
  }

  return json({ orders: updatedOrders });
}

// Kasir bisa menandai menu habis/tersedia lagi untuk stan mana pun langsung
// dari layar buat-pesanan (menu_id sudah cukup, tenant pemiliknya melekat di
// baris menu itu sendiri).
async function handleKasirToggleMenuAvailable(env, menuId) {
  const existing = await env.DB.prepare("SELECT * FROM menu WHERE id = ?").bind(menuId).first();
  if (!existing) return error("Menu tidak ditemukan", 404);

  const menu = await env.DB.prepare("UPDATE menu SET is_available = ? WHERE id = ? RETURNING *")
    .bind(existing.is_available ? 0 : 1, menuId)
    .first();

  await logActivity(
    env,
    menu.tenant_id,
    "cashier",
    null,
    menu.is_available ? "mark_menu_available" : "mark_menu_sold_out",
    menu.name
  );

  return json({ menu });
}

// Daftar order LINTAS SEMUA STAN aktif (dipakai kasir untuk tab "Buat Pesanan"
// riwayat & tab "Verifikasi"). Tiap order ditandai tenant_slug/tenant_name
// supaya kasir tahu order itu milik stan mana. Filter opsional: ?status=,
// ?tenant_slug= (kalau kasir ingin fokus ke 1 stan saja).
async function handleKasirGetOrders(request, env) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const tenantSlugFilter = url.searchParams.get("tenant_slug");

  let query = `SELECT o.*, t.slug as tenant_slug, t.name as tenant_name
               FROM orders o JOIN tenants t ON t.id = o.tenant_id WHERE 1=1`;
  const bindings = [];

  if (tenantSlugFilter) {
    query += " AND t.slug = ?";
    bindings.push(tenantSlugFilter);
  }
  if (statusFilter === "aktif") {
    query += " AND o.status NOT IN ('selesai', 'dibatalkan')";
  } else if (statusFilter) {
    query += " AND o.status = ?";
    bindings.push(statusFilter);
  }
  query +=
    " ORDER BY CASE WHEN o.pickup_type = 'scheduled' AND o.pickup_time IS NOT NULL THEN o.pickup_time ELSE o.created_at END ASC";

  const orders = await env.DB.prepare(query).bind(...bindings).all();

  // OPTIMASI D1: sama seperti fix di handleGetOrders (Kitchen) — endpoint ini
  // di-polling halaman Kasir tiap 20 detik, TAPI lintas SEMUA stan sekaligus,
  // jadi pola N+1 lama di sini justru lebih berat lagi (order dari banyak
  // tenant digabung dalam 1 daftar). Sekarang cukup beberapa query batch total.
  const orderIds = orders.results.map((o) => o.id);
  const itemsByOrder = await fetchOrderItemsByOrderIds(env, orderIds);
  const fullOrders = orders.results.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
  }));

  return json({ orders: fullOrders });
}

// ============================================
// KITCHEN: list order + detail item (per tenant)
// ============================================
async function handleGetOrders(request, env, tenant) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  let query = "SELECT * FROM orders WHERE tenant_id = ?";
  const bindings = [tenant.id];
  if (statusFilter === "aktif") {
    query += " AND status NOT IN ('selesai', 'dibatalkan')";
  } else if (statusFilter) {
    query += " AND status = ?";
    bindings.push(statusFilter);
  }
  query +=
    " ORDER BY CASE WHEN pickup_type = 'scheduled' AND pickup_time IS NOT NULL THEN pickup_time ELSE created_at END ASC";

  const orders = await env.DB.prepare(query).bind(...bindings).all();

  // OPTIMASI D1: dulu di sini ada loop "1 query order_items per order, lalu 1
  // query order_item_addons per item" (N+1) — endpoint ini di-polling Kitchen
  // tiap 4 detik TANPA henti selama dashboard terbuka, jadi pola N+1 lama itu
  // bisa jadi ratusan query per siklus begitu order menumpuk. Sekarang cukup
  // beberapa query batch total, hasil akhirnya (bentuk `items`/`addons` per
  // order) tetap identik seperti sebelumnya.
  const orderIds = orders.results.map((o) => o.id);
  const itemsByOrder = await fetchOrderItemsByOrderIds(env, orderIds);
  const fullOrders = orders.results.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
  }));

  return json({ orders: fullOrders });
}

async function handleUpdateOrderStatus(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body || !body.order_id || !body.status) {
    return error("order_id dan status wajib diisi");
  }
  if (!["pending", "diproses", "selesai", "dibatalkan"].includes(body.status)) {
    return error("Status tidak valid");
  }

  const order = await env.DB.prepare(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ? RETURNING *`
  )
    .bind(body.status, body.order_id, tenant.id)
    .first();

  if (!order) return error("Order tidak ditemukan", 404);

  await logActivity(env, tenant.id, "kitchen_admin", null, "update_order_status", `${order.order_code || order.id} -> ${body.status}`);

  return json({ order });
}

// ============================================
// ADMIN: kelola menu (per tenant)
// ============================================
async function handleAdminGetMenu(env, tenant) {
  const menus = await env.DB.prepare("SELECT * FROM menu WHERE tenant_id = ? ORDER BY category, name")
    .bind(tenant.id)
    .all();
  const addons = await env.DB.prepare(
    `SELECT ma.* FROM menu_addons ma JOIN menu m ON m.id = ma.menu_id WHERE m.tenant_id = ?`
  )
    .bind(tenant.id)
    .all();

  const addonsByMenu = {};
  for (const a of addons.results) {
    if (!addonsByMenu[a.menu_id]) addonsByMenu[a.menu_id] = [];
    addonsByMenu[a.menu_id].push(a);
  }

  const result = menus.results.map((m) => ({ ...m, addons: addonsByMenu[m.id] || [] }));
  return json({ menu: result });
}

async function handleAdminCreateMenu(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.price || !body.category) {
    return error("name, price, dan category wajib diisi");
  }
  const VALID_CATEGORIES = ["Makanan", "Minuman", "Topping"];
  if (!VALID_CATEGORIES.includes(body.category)) {
    return error(`category harus salah satu dari: ${VALID_CATEGORIES.join(", ")}`);
  }

  const menu = await env.DB.prepare(
    `INSERT INTO menu (tenant_id, name, price, category, description, image_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING *`
  )
    .bind(tenant.id, body.name, body.price, body.category, body.description || null, body.image_url || null)
    .first();

  await logActivity(env, tenant.id, "admin", "admin", "create_menu", menu.name);

  return json({ menu }, 201);
}

async function handleAdminEditMenu(request, env, tenant, menuId) {
  const body = await request.json().catch(() => null);
  if (!body) return error("Body tidak valid");

  const existing = await env.DB.prepare("SELECT * FROM menu WHERE id = ? AND tenant_id = ?")
    .bind(menuId, tenant.id)
    .first();
  if (!existing) return error("Menu tidak ditemukan", 404);

  const VALID_CATEGORIES = ["Makanan", "Minuman", "Topping"];
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    return error(`category harus salah satu dari: ${VALID_CATEGORIES.join(", ")}`);
  }

  const menu = await env.DB.prepare(
    `UPDATE menu SET name = ?, price = ?, category = ?, description = ?, image_url = ?
     WHERE id = ? AND tenant_id = ? RETURNING *`
  )
    .bind(
      body.name ?? existing.name,
      body.price ?? existing.price,
      body.category ?? existing.category,
      body.description ?? existing.description,
      body.image_url ?? existing.image_url,
      menuId,
      tenant.id
    )
    .first();

  await logActivity(env, tenant.id, "admin", "admin", "edit_menu", menu.name);

  return json({ menu });
}

async function handleAdminToggleActive(env, tenant, menuId) {
  const existing = await env.DB.prepare("SELECT * FROM menu WHERE id = ? AND tenant_id = ?")
    .bind(menuId, tenant.id)
    .first();
  if (!existing) return error("Menu tidak ditemukan", 404);

  const menu = await env.DB.prepare("UPDATE menu SET is_active = ? WHERE id = ? AND tenant_id = ? RETURNING *")
    .bind(existing.is_active ? 0 : 1, menuId, tenant.id)
    .first();

  await logActivity(env, tenant.id, "admin", "admin", menu.is_active ? "activate_menu" : "deactivate_menu", menu.name);

  return json({ menu });
}

async function handleAdminToggleAvailable(env, tenant, menuId) {
  const existing = await env.DB.prepare("SELECT * FROM menu WHERE id = ? AND tenant_id = ?")
    .bind(menuId, tenant.id)
    .first();
  if (!existing) return error("Menu tidak ditemukan", 404);

  const menu = await env.DB.prepare("UPDATE menu SET is_available = ? WHERE id = ? AND tenant_id = ? RETURNING *")
    .bind(existing.is_available ? 0 : 1, menuId, tenant.id)
    .first();

  await logActivity(env, tenant.id, "admin", "admin", menu.is_available ? "mark_menu_available" : "mark_menu_sold_out", menu.name);

  return json({ menu });
}

async function handleAdminDeleteMenu(env, tenant, menuId) {
  const existing = await env.DB.prepare("SELECT * FROM menu WHERE id = ? AND tenant_id = ?")
    .bind(menuId, tenant.id)
    .first();
  if (!existing) return error("Menu tidak ditemukan", 404);

  const used = await env.DB.prepare("SELECT COUNT(*) as count FROM order_items WHERE menu_id = ?")
    .bind(menuId)
    .first();

  if (used.count > 0) {
    return error(
      "Menu ini sudah pernah dipesan pelanggan, tidak bisa dihapus permanen supaya riwayat order tetap aman. Nonaktifkan saja.",
      400
    );
  }

  await env.DB.prepare("DELETE FROM menu_addons WHERE menu_id = ?").bind(menuId).run();
  await env.DB.prepare("DELETE FROM menu WHERE id = ? AND tenant_id = ?").bind(menuId, tenant.id).run();

  await logActivity(env, tenant.id, "admin", "admin", "delete_menu", existing.name);

  return json({ deleted: true });
}

async function handleAdminAddAddon(request, env, tenant, menuId) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name) return error("name wajib diisi");

  const menu = await env.DB.prepare("SELECT id FROM menu WHERE id = ? AND tenant_id = ?").bind(menuId, tenant.id).first();
  if (!menu) return error("Menu tidak ditemukan", 404);

  const addon = await env.DB.prepare(
    "INSERT INTO menu_addons (menu_id, name, extra_price) VALUES (?, ?, ?) RETURNING *"
  )
    .bind(menuId, body.name, body.extra_price || 0)
    .first();

  return json({ addon }, 201);
}

async function handleAdminDeleteAddon(env, tenant, menuId, addonId) {
  const menu = await env.DB.prepare("SELECT id FROM menu WHERE id = ? AND tenant_id = ?").bind(menuId, tenant.id).first();
  if (!menu) return error("Menu tidak ditemukan", 404);

  await env.DB.prepare("DELETE FROM menu_addons WHERE id = ? AND menu_id = ?").bind(addonId, menuId).run();
  return json({ deleted: true });
}

// ============================================
// ADMIN: upload gambar langsung ke Cloudinary (tidak perlu tenant-scoping,
// Cloudinary folder sudah cukup terpisah lewat public_id acak)
// ============================================
async function handleAdminUpload(request, env) {
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  const isAudio = contentType.startsWith("audio/");

  const resourceType = isAudio ? "video" : "image";
  const folder = isAudio ? "notification" : "menu";

  const filename = request.headers.get("X-Filename") || `${folder}-${Date.now()}.jpg`;
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/\.[^.]+$/, "");
  const publicId = `${folder}/${Date.now()}-${safeName}`;

  const fileBuffer = await request.arrayBuffer();

  if (isAudio && fileBuffer.byteLength > 2 * 1024 * 1024) {
    return json({ error: "Ukuran file suara maksimal 2MB" }, 400);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = await sha1Hex(`${paramsToSign}${env.CLOUDINARY_API_SECRET}`);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: contentType }), filename);
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("signature", signature);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: form }
  );

  const data = await uploadRes.json();

  if (!uploadRes.ok) {
    return json({ error: data.error?.message || "Upload ke Cloudinary gagal" }, uploadRes.status || 500);
  }

  return json({ image_url: data.secure_url, sound_url: data.secure_url }, 201);
}

async function sha1Hex(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================
// ADMIN: PENGATURAN JAM OPERASIONAL (PER HARI) & TUTUP MANUAL (per tenant)
// ============================================
async function handleAdminUpdateSettings(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body) return error("Body tidak valid");

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (body.hours !== undefined) {
    if (!Array.isArray(body.hours)) return error("hours harus berupa array");

    for (const h of body.hours) {
      const dow = Number(h.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return error("day_of_week tidak valid (0 = Minggu ... 6 = Sabtu)");
      }
      const isOpen = h.is_open ? 1 : 0;
      const openTime = h.open_time || "08:00";
      const closeTime = h.close_time || "22:00";
      if (isOpen && (!timePattern.test(openTime) || !timePattern.test(closeTime))) {
        return error(`Format jam tidak valid untuk hari ke-${dow} (pakai HH:MM)`);
      }

      await env.DB.prepare(
        `INSERT INTO operational_hours (tenant_id, day_of_week, is_open, open_time, close_time)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, day_of_week) DO UPDATE SET is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time`
      )
        .bind(tenant.id, dow, isOpen, openTime, closeTime)
        .run();
    }
  }

  const updates = [];
  if (body.manual_closed !== undefined) {
    updates.push(["manual_closed", body.manual_closed ? "1" : "0"]);
  }
  if (body.manual_closed_note !== undefined) {
    updates.push(["manual_closed_note", String(body.manual_closed_note || "").slice(0, 200)]);
  }
  if (body.theme_preset !== undefined) {
    if (!THEME_PRESET_IDS.includes(body.theme_preset)) {
      return error(`theme_preset tidak valid. Pilihan: ${THEME_PRESET_IDS.join(", ")}`);
    }
    updates.push(["theme_preset", body.theme_preset]);
  }
  if (body.qris_image_url !== undefined) {
    updates.push(["qris_image_url", String(body.qris_image_url || "").slice(0, 1000)]);
  }
  if (body.notification_sound_url !== undefined) {
    updates.push(["notification_sound_url", String(body.notification_sound_url || "").slice(0, 1000)]);
  }
  if (body.receipt_paper_width !== undefined) {
    if (!RECEIPT_PAPER_WIDTHS.includes(String(body.receipt_paper_width))) {
      return error(`receipt_paper_width tidak valid. Pilihan: ${RECEIPT_PAPER_WIDTHS.join(", ")}`);
    }
    updates.push(["receipt_paper_width", String(body.receipt_paper_width)]);
  }

  for (const [key, value] of updates) {
    await env.DB.prepare(
      `INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`
    )
      .bind(tenant.id, key, value)
      .run();
  }

  const status = await getStoreStatus(env, tenant.id);
  const hours = await getAllOperationalHours(env, tenant.id);

  await logActivity(env, tenant.id, "admin", "admin", "update_settings", updates.map(([k]) => k).join(", ") || "jam operasional");

  return json({ ...status, hours });
}

// ============================================
// ADMIN: ganti token login Admin & Kitchen — disimpan langsung di tabel tenants.
// body: { admin_token?: string, kitchen_token?: string }
// ============================================
async function handleAdminUpdateTokens(request, env, tenant) {
  const body = await request.json().catch(() => null);
  if (!body) return error("Body tidak valid");

  let newAdminToken = tenant.admin_token;
  let newKitchenToken = tenant.kitchen_token;
  const updated = [];

  if (body.admin_token !== undefined) {
    const val = String(body.admin_token).trim();
    if (val.length < 6) return error("Token admin minimal 6 karakter");
    newAdminToken = val;
    updated.push("admin_token");
  }

  if (body.kitchen_token !== undefined) {
    const val = String(body.kitchen_token).trim();
    if (val.length < 6) return error("Token kitchen minimal 6 karakter");
    newKitchenToken = val;
    updated.push("kitchen_token");
  }

  if (updated.length === 0) return error("Tidak ada token yang dikirim");

  await env.DB.prepare("UPDATE tenants SET admin_token = ?, kitchen_token = ? WHERE id = ?")
    .bind(newAdminToken, newKitchenToken, tenant.id)
    .run();

  await logActivity(env, tenant.id, "admin", "admin", "update_login_tokens", updated.join(", "));

  // CATATAN: token LAMA langsung tidak berlaku untuk request berikutnya (dibaca ulang
  // dari tabel tenants tiap request). Sesi yang sedang login dengan token lama akan
  // ter-logout otomatis di request berikutnya — ini disengaja.
  return json({ ok: true, updated });
}

// ============================================
// ADMIN: LAPORAN (per tenant)
// ============================================
async function handleAdminReports(request, env, tenant) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") || "week";

  let threshold;
  if (range === "today") threshold = todayDateString();
  else if (range === "week") threshold = dateDaysAgoString(6);
  else if (range === "month") threshold = dateDaysAgoString(29);
  else threshold = "2000-01-01";

  const summaryRow = await env.DB.prepare(
    `SELECT
       COUNT(*) as total_orders,
       COALESCE(SUM(CASE WHEN status != 'dibatalkan' THEN total ELSE 0 END), 0) as total_revenue,
       COALESCE(SUM(CASE WHEN status = 'dibatalkan' THEN 1 ELSE 0 END), 0) as cancelled_orders
     FROM orders WHERE tenant_id = ? AND order_date >= ?`
  )
    .bind(tenant.id, threshold)
    .first();

  const completedOrders = summaryRow.total_orders - summaryRow.cancelled_orders;
  const avgOrderValue = completedOrders > 0 ? Math.round(summaryRow.total_revenue / completedOrders) : 0;

  const topProducts = await env.DB.prepare(
    `SELECT oi.menu_id, oi.menu_name as name, SUM(oi.qty) as qty_sold, SUM(oi.qty * oi.menu_price) as revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.tenant_id = ? AND o.order_date >= ? AND o.status != 'dibatalkan'
     GROUP BY oi.menu_id, oi.menu_name
     ORDER BY qty_sold DESC
     LIMIT 10`
  )
    .bind(tenant.id, threshold)
    .all();

  const byCategory = await env.DB.prepare(
    `SELECT COALESCE(m.category, 'Lainnya') as category, SUM(oi.qty) as qty_sold, SUM(oi.qty * oi.menu_price) as revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu m ON m.id = oi.menu_id
     WHERE o.tenant_id = ? AND o.order_date >= ? AND o.status != 'dibatalkan'
     GROUP BY category
     ORDER BY revenue DESC`
  )
    .bind(tenant.id, threshold)
    .all();

  const byDay = await env.DB.prepare(
    `SELECT order_date,
       SUM(CASE WHEN status != 'dibatalkan' THEN total ELSE 0 END) as revenue,
       COUNT(*) as order_count
     FROM orders
     WHERE tenant_id = ? AND order_date >= ?
     GROUP BY order_date
     ORDER BY order_date ASC`
  )
    .bind(tenant.id, threshold)
    .all();

  const byPaymentMethod = await env.DB.prepare(
    `SELECT payment_method, SUM(total) as revenue, COUNT(*) as order_count
     FROM orders
     WHERE tenant_id = ? AND order_date >= ? AND status != 'dibatalkan'
     GROUP BY payment_method
     ORDER BY revenue DESC`
  )
    .bind(tenant.id, threshold)
    .all();

  const byHour = await env.DB.prepare(
    `SELECT strftime('%H', datetime(created_at, '+7 hours')) as hour, COUNT(*) as order_count
     FROM orders
     WHERE tenant_id = ? AND order_date >= ? AND status != 'dibatalkan'
     GROUP BY hour
     ORDER BY hour ASC`
  )
    .bind(tenant.id, threshold)
    .all();

  const totalCustomersRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM users WHERE tenant_id = ?`)
    .bind(tenant.id)
    .first();

  const newCustomersRow = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM users WHERE tenant_id = ? AND datetime(created_at, '+7 hours') >= datetime(?)`
  )
    .bind(tenant.id, threshold)
    .first();

  const newCustomers = await env.DB.prepare(
    `SELECT name, phone, datetime(created_at, '+7 hours') as registered_at
     FROM users
     WHERE tenant_id = ? AND datetime(created_at, '+7 hours') >= datetime(?)
     ORDER BY created_at DESC
     LIMIT 100`
  )
    .bind(tenant.id, threshold)
    .all();

  const topCustomers = await env.DB.prepare(
    `SELECT o.user_name as name, o.user_phone as phone,
       COUNT(*) as order_count,
       SUM(o.total) as total_spent,
       MAX(o.created_at) as last_order_at
     FROM orders o
     WHERE o.tenant_id = ? AND o.order_date >= ? AND o.status != 'dibatalkan'
     GROUP BY o.user_phone, o.user_name
     ORDER BY total_spent DESC
     LIMIT 10`
  )
    .bind(tenant.id, threshold)
    .all();

  const activeCustomersRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_phone) as total
     FROM orders
     WHERE tenant_id = ? AND order_date >= ? AND status != 'dibatalkan'`
  )
    .bind(tenant.id, threshold)
    .first();

  return json({
    range,
    threshold,
    summary: {
      total_orders: summaryRow.total_orders,
      completed_orders: completedOrders,
      cancelled_orders: summaryRow.cancelled_orders,
      total_revenue: summaryRow.total_revenue,
      avg_order_value: avgOrderValue,
    },
    top_products: topProducts.results,
    by_category: byCategory.results,
    by_day: byDay.results,
    by_payment_method: byPaymentMethod.results,
    by_hour: byHour.results,
    customers: {
      total_customers: totalCustomersRow.total,
      new_customers: newCustomersRow.total,
      active_customers: activeCustomersRow.total,
      new_customer_list: newCustomers.results,
      top_customers: topCustomers.results,
    },
  });
}

// ============================================================================
// SUPERADMIN — kelola SEMUA tenant. Tidak pakai prefix slug, token global terpisah
// (env.SUPERADMIN_TOKEN). Router kecil sendiri, dipanggil dari fetch() di atas.
// ============================================================================
async function handleSuperadminRoute(request, env, path, method) {
  if (!isSuperadmin(request, env)) return error("Unauthorized", 401);

  if (path === "/superadmin/tenants" && method === "GET") {
    return handleSuperadminListTenants(env);
  }

  if (path === "/superadmin/tenants" && method === "POST") {
    return handleSuperadminCreateTenant(request, env);
  }

  const idMatch = path.match(/^\/superadmin\/tenants\/(\d+)$/);
  if (idMatch && method === "DELETE") {
    return handleSuperadminDeleteTenant(env, Number(idMatch[1]));
  }

  const toggleMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/toggle-active$/);
  if (toggleMatch && method === "PATCH") {
    return handleSuperadminToggleTenant(env, Number(toggleMatch[1]));
  }

  const regenMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/regenerate-tokens$/);
  if (regenMatch && method === "POST") {
    return handleSuperadminRegenerateTokens(env, Number(regenMatch[1]));
  }

  const statsMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/stats$/);
  if (statsMatch && method === "GET") {
    return handleSuperadminTenantStats(env, Number(statsMatch[1]));
  }

  const activityMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/activity$/);
  if (activityMatch && method === "GET") {
    return handleSuperadminTenantActivity(request, env, Number(activityMatch[1]));
  }

  const backupMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/backup$/);
  if (backupMatch && method === "GET") {
    return handleSuperadminTenantBackup(env, Number(backupMatch[1]));
  }

  const resetMatch = path.match(/^\/superadmin\/tenants\/(\d+)\/reset$/);
  if (resetMatch && method === "POST") {
    return handleSuperadminTenantReset(request, env, Number(resetMatch[1]));
  }

  if (path === "/superadmin/stats" && method === "GET") {
    return handleSuperadminGlobalStats(env);
  }

  // ---------- KASIR GLOBAL: kelola akun (satu akun untuk semua stan) ----------
  if (path === "/superadmin/kasir" && method === "GET") {
    return handleSuperadminListKasir(env);
  }

  if (path === "/superadmin/kasir" && method === "POST") {
    return handleSuperadminCreateKasir(request, env);
  }

  const kasirToggleMatch = path.match(/^\/superadmin\/kasir\/(\d+)\/toggle-active$/);
  if (kasirToggleMatch && method === "PATCH") {
    return handleSuperadminToggleKasir(env, Number(kasirToggleMatch[1]));
  }

  const kasirResetPwMatch = path.match(/^\/superadmin\/kasir\/(\d+)\/reset-password$/);
  if (kasirResetPwMatch && method === "POST") {
    return handleSuperadminResetKasirPassword(request, env, Number(kasirResetPwMatch[1]));
  }

  // "Masuk sebagai kasir" TANPA perlu tahu username/password kasir mana pun —
  // dipakai lewat 1 akun kasir khusus ("superadmin_dev"), dibuat otomatis sekali
  // lalu dipakai ulang. Sengaja GLOBAL (bukan per-tenant lagi) karena kasir
  // sekarang memang lintas semua stan.
  if (path === "/superadmin/impersonate-kasir" && method === "POST") {
    return handleSuperadminImpersonateKasir(env);
  }

  return error("Not found", 404);
}

// ---------- SUPERADMIN: daftar & buat tenant ----------
async function handleSuperadminListTenants(env) {
  const tenants = await env.DB.prepare(
    "SELECT id, slug, name, is_active, created_at FROM tenants ORDER BY created_at DESC"
  ).all();
  return json({ tenants: tenants.results });
}

async function handleSuperadminCreateTenant(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.slug || !body.name) {
    return error("slug dan name wajib diisi");
  }
  const slug = String(body.slug).trim().toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(slug)) {
    return error("slug hanya boleh huruf kecil, angka, dan tanda strip (contoh: warung-kita)");
  }
  if (["superadmin", "admin", "api", "public"].includes(slug)) {
    return error("slug ini dipakai sistem, pilih slug lain");
  }

  const existing = await env.DB.prepare("SELECT id FROM tenants WHERE slug = ?").bind(slug).first();
  if (existing) return error("slug sudah dipakai tenant lain");

  const adminToken = generateReadableToken();
  const kitchenToken = generateReadableToken();

  const tenant = await env.DB.prepare(
    `INSERT INTO tenants (slug, name, admin_token, kitchen_token, is_active)
     VALUES (?, ?, ?, ?, 1) RETURNING *`
  )
    .bind(slug, body.name.trim(), adminToken, kitchenToken)
    .first();

  const defaultSettings = [
    ["manual_closed", "0"],
    ["manual_closed_note", ""],
    ["theme_preset", "hijau"],
    ["qris_image_url", ""],
    ["notification_sound_url", ""],
    ["receipt_paper_width", "58"],
  ];
  for (const [key, value] of defaultSettings) {
    await env.DB.prepare("INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)")
      .bind(tenant.id, key, value)
      .run();
  }
  for (let dow = 0; dow <= 6; dow++) {
    await env.DB.prepare(
      "INSERT INTO operational_hours (tenant_id, day_of_week, is_open, open_time, close_time) VALUES (?, ?, 1, '08:00', '22:00')"
    )
      .bind(tenant.id, dow)
      .run();
  }

  await logActivity(env, null, "superadmin", "developer", "create_tenant", `${tenant.slug} (${tenant.name})`);

  return json({ tenant }, 201);
}

async function handleSuperadminDeleteTenant(env, tenantId) {
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant) return error("Tenant tidak ditemukan", 404);

  // Tidak dihapus permanen (menjaga riwayat order/laporan) — cukup dinonaktifkan.
  // Kalau memang perlu hapus permanen datanya, pakai endpoint reset lalu hapus manual lewat D1.
  return error("Untuk keamanan data, tenant tidak bisa dihapus permanen dari sini. Nonaktifkan lewat toggle-active, atau hapus manual lewat wrangler d1 kalau benar-benar yakin.", 400);
}

async function handleSuperadminToggleTenant(env, tenantId) {
  const existing = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!existing) return error("Tenant tidak ditemukan", 404);

  const tenant = await env.DB.prepare(
    "UPDATE tenants SET is_active = ? WHERE id = ? RETURNING id, slug, name, is_active, created_at"
  )
    .bind(existing.is_active ? 0 : 1, tenantId)
    .first();

  await logActivity(env, null, "superadmin", "developer", tenant.is_active ? "activate_tenant" : "deactivate_tenant", tenant.slug);

  return json({ tenant });
}

async function handleSuperadminRegenerateTokens(env, tenantId) {
  const existing = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!existing) return error("Tenant tidak ditemukan", 404);

  const adminToken = generateReadableToken();
  const kitchenToken = generateReadableToken();

  const tenant = await env.DB.prepare(
    "UPDATE tenants SET admin_token = ?, kitchen_token = ? WHERE id = ? RETURNING *"
  )
    .bind(adminToken, kitchenToken, tenantId)
    .first();

  await logActivity(env, null, "superadmin", "developer", "regenerate_tenant_tokens", tenant.slug);

  return json({ tenant });
}

async function handleSuperadminTenantStats(env, tenantId) {
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant) return error("Tenant tidak ditemukan", 404);

  // CATATAN: dulu ada hitungan "active_cashiers" per tenant di sini — sudah
  // dihapus karena kasir sekarang GLOBAL (1 akun untuk semua stan), lihat
  // /superadmin/kasir untuk daftar & jumlah akun kasir yang aktif.
  const [users, menu, orders, revenue] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ?").bind(tenantId).first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM menu WHERE tenant_id = ? AND is_active = 1").bind(tenantId).first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE tenant_id = ?").bind(tenantId).first(),
    env.DB.prepare("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE tenant_id = ? AND status != 'dibatalkan'")
      .bind(tenantId)
      .first(),
  ]);

  return json({
    tenant,
    total_customers: users.count,
    active_menu_items: menu.count,
    total_orders: orders.count,
    total_revenue_all_time: revenue.total,
  });
}

async function handleSuperadminGlobalStats(env) {
  const [tenants, users, orders, revenue] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM tenants WHERE is_active = 1").first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM orders").first(),
    env.DB.prepare("SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status != 'dibatalkan'").first(),
  ]);

  return json({
    active_tenants: tenants.count,
    total_customers_all_tenants: users.count,
    total_orders_all_tenants: orders.count,
    total_revenue_all_tenants: revenue.total,
  });
}

async function handleSuperadminTenantActivity(request, env, tenantId) {
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant) return error("Tenant tidak ditemukan", 404);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
  const actorType = url.searchParams.get("actor_type");

  let query = "SELECT * FROM activity_log WHERE tenant_id = ?";
  const bindings = [tenantId];
  if (actorType) {
    query += " AND actor_type = ?";
    bindings.push(actorType);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  bindings.push(limit);

  const rows = await env.DB.prepare(query).bind(...bindings).all();
  return json({ activity: rows.results });
}

// Tabel yang di-backup / di-reset UNTUK SATU TENANT. tenants sendiri tidak ikut
// dihapus saat reset — hanya data operasional tenant tsb yang dikosongkan.
// CATATAN: "cashiers" (kasir per-tenant) sengaja TIDAK ada lagi di daftar ini —
// akun kasir sekarang GLOBAL (tabel global_cashiers, lihat schema.sql), jadi
// tidak ikut ter-backup/ter-reset saat 1 tenant di-reset/backup di sini.
const TENANT_SCOPED_TABLES = [
  "users",
  "menu",
  "daily_counters",
  "daily_counters_kasir",
  "orders",
  "settings",
  "operational_hours",
  "activity_log",
];

async function handleSuperadminTenantBackup(env, tenantId) {
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant) return error("Tenant tidak ditemukan", 404);

  const dump = { tenant };
  for (const table of TENANT_SCOPED_TABLES) {
    const rows = await env.DB.prepare(`SELECT * FROM ${table} WHERE tenant_id = ?`).bind(tenantId).all();
    dump[table] = rows.results;
  }
  // menu_addons, order_items, order_item_addons tidak punya tenant_id langsung — ambil lewat join
  const menuAddons = await env.DB.prepare(
    `SELECT ma.* FROM menu_addons ma JOIN menu m ON m.id = ma.menu_id WHERE m.tenant_id = ?`
  )
    .bind(tenantId)
    .all();
  dump.menu_addons = menuAddons.results;

  const orderItems = await env.DB.prepare(
    `SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.tenant_id = ?`
  )
    .bind(tenantId)
    .all();
  dump.order_items = orderItems.results;

  const orderItemAddons = await env.DB.prepare(
    `SELECT oia.* FROM order_item_addons oia
     JOIN order_items oi ON oi.id = oia.order_item_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.tenant_id = ?`
  )
    .bind(tenantId)
    .all();
  dump.order_item_addons = orderItemAddons.results;

  await logActivity(env, tenantId, "superadmin", "developer", "backup_database", `${TENANT_SCOPED_TABLES.length} tabel`);

  return json({ exported_at: new Date().toISOString(), tenant_slug: tenant.slug, tables: dump });
}

// ============================================
// SUPERADMIN: reset SATU TENANT — hapus semua data operasional tenant tsb
// (menu, order, kasir, customer, dst), tapi baris tenants-nya sendiri TETAP ADA
// (slug & token admin/kitchen tidak berubah). Sangat destruktif, wajib frasa konfirmasi.
// body: { confirm: "RESET DATABASE", seed_sample: boolean }
// ============================================
async function handleSuperadminTenantReset(request, env, tenantId) {
  const tenant = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant) return error("Tenant tidak ditemukan", 404);

  const body = await request.json().catch(() => null);
  const REQUIRED_PHRASE = "RESET DATABASE";

  if (!body || body.confirm !== REQUIRED_PHRASE) {
    return error(`Konfirmasi tidak valid. Kirim { "confirm": "${REQUIRED_PHRASE}" } persis untuk melanjutkan.`, 400);
  }

  const seedSample = !!body.seed_sample;

  // Hapus child dulu (lewat join, karena tidak punya tenant_id langsung), baru parent.
  await env.DB.prepare(
    `DELETE FROM order_item_addons WHERE order_item_id IN (
       SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.tenant_id = ?
     )`
  )
    .bind(tenantId)
    .run();
  await env.DB.prepare(
    `DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = ?)`
  )
    .bind(tenantId)
    .run();
  await env.DB.prepare(`DELETE FROM orders WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM daily_counters WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM daily_counters_kasir WHERE tenant_id = ?`).bind(tenantId).run();
  // CATATAN: akun kasir GLOBAL sengaja TIDAK ikut dihapus di sini — kasir tidak
  // terikat 1 tenant lagi, jadi reset 1 stan tidak boleh mempengaruhi akun kasir
  // yang juga dipakai untuk stan lain. Kelola akun kasir lewat /superadmin/kasir.
  await env.DB.prepare(
    `DELETE FROM menu_addons WHERE menu_id IN (SELECT id FROM menu WHERE tenant_id = ?)`
  )
    .bind(tenantId)
    .run();
  await env.DB.prepare(`DELETE FROM menu WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM users WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM activity_log WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM settings WHERE tenant_id = ?`).bind(tenantId).run();
  await env.DB.prepare(`DELETE FROM operational_hours WHERE tenant_id = ?`).bind(tenantId).run();

  const defaultSettings = [
    ["manual_closed", "0"],
    ["manual_closed_note", ""],
    ["theme_preset", "hijau"],
    ["qris_image_url", ""],
    ["notification_sound_url", ""],
    ["receipt_paper_width", "58"],
  ];
  for (const [key, value] of defaultSettings) {
    await env.DB.prepare("INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)").bind(tenantId, key, value).run();
  }
  for (let dow = 0; dow <= 6; dow++) {
    await env.DB.prepare(
      "INSERT INTO operational_hours (tenant_id, day_of_week, is_open, open_time, close_time) VALUES (?, ?, 1, '08:00', '22:00')"
    )
      .bind(tenantId, dow)
      .run();
  }

  if (seedSample) {
    const menu1 = await env.DB.prepare(
      `INSERT INTO menu (tenant_id, name, price, category, description, is_active)
       VALUES (?, 'Nasi Goreng Spesial', 18000, 'Makanan', 'Nasi goreng dengan telur, ayam suwir, dan kerupuk', 1) RETURNING id`
    )
      .bind(tenantId)
      .first();
    const menu2 = await env.DB.prepare(
      `INSERT INTO menu (tenant_id, name, price, category, description, is_active)
       VALUES (?, 'Mie Ayam', 15000, 'Makanan', 'Mie ayam dengan pangsit', 1) RETURNING id`
    )
      .bind(tenantId)
      .first();
    await env.DB.prepare(`INSERT INTO menu (tenant_id, name, price, category, description, is_active)
       VALUES (?, 'Es Teh Manis', 5000, 'Minuman', 'Teh manis dingin', 1)`).bind(tenantId).run();
    await env.DB.prepare(`INSERT INTO menu (tenant_id, name, price, category, description, is_active)
       VALUES (?, 'Kerupuk Tambahan', 2000, 'Topping', 'Kerupuk ekstra', 1)`).bind(tenantId).run();
    await env.DB.prepare("INSERT INTO menu_addons (menu_id, name, extra_price) VALUES (?, 'Extra Telur', 4000)").bind(menu1.id).run();
    await env.DB.prepare("INSERT INTO menu_addons (menu_id, name, extra_price) VALUES (?, 'Extra Pedas', 0)").bind(menu1.id).run();
    await env.DB.prepare("INSERT INTO menu_addons (menu_id, name, extra_price) VALUES (?, 'Extra Pangsit', 3000)").bind(menu2.id).run();
  }

  await logActivity(env, tenantId, "superadmin", "developer", "reset_database", seedSample ? "dengan data contoh" : "kosong total");

  return json({ ok: true, tenant_slug: tenant.slug, seeded_sample: seedSample, reset_at: new Date().toISOString() });
}

// ============================================
// SUPERADMIN: kelola akun KASIR GLOBAL (satu akun kasir bisa dipakai untuk
// SEMUA stan sekaligus — lihat tabel global_cashiers di schema.sql). Berbeda
// dari admin_token/kitchen_token per-tenant, akun kasir memang sengaja diatur
// dari sini (bukan dari panel Admin tiap stan) karena scope-nya lintas tenant.
// ============================================
async function handleSuperadminListKasir(env) {
  const rows = await env.DB.prepare(
    "SELECT id, username, name, is_active, created_at FROM global_cashiers ORDER BY created_at DESC"
  ).all();
  return json({ cashiers: rows.results });
}

async function handleSuperadminCreateKasir(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password || !body.name) {
    return error("username, password, dan name wajib diisi");
  }
  if (body.password.length < 6) return error("Password minimal 6 karakter");

  const existing = await env.DB.prepare("SELECT id FROM global_cashiers WHERE username = ?")
    .bind(body.username.trim())
    .first();
  if (existing) return error("Username sudah dipakai");

  const { hash, salt } = await hashPassword(body.password);
  const cashier = await env.DB.prepare(
    `INSERT INTO global_cashiers (username, password_hash, password_salt, name, is_active) VALUES (?, ?, ?, ?, 1)
     RETURNING id, username, name, is_active, created_at`
  )
    .bind(body.username.trim(), hash, salt, body.name.trim())
    .first();

  await logActivity(env, null, "superadmin", "developer", "create_global_cashier", cashier.username);

  return json({ cashier }, 201);
}

async function handleSuperadminToggleKasir(env, cashierId) {
  const existing = await env.DB.prepare("SELECT * FROM global_cashiers WHERE id = ?").bind(cashierId).first();
  if (!existing) return error("Kasir tidak ditemukan", 404);

  const cashier = await env.DB.prepare(
    "UPDATE global_cashiers SET is_active = ? WHERE id = ? RETURNING id, username, name, is_active, created_at"
  )
    .bind(existing.is_active ? 0 : 1, cashierId)
    .first();

  await logActivity(
    env,
    null,
    "superadmin",
    "developer",
    cashier.is_active ? "activate_global_cashier" : "deactivate_global_cashier",
    cashier.username
  );

  return json({ cashier });
}

async function handleSuperadminResetKasirPassword(request, env, cashierId) {
  const existing = await env.DB.prepare("SELECT * FROM global_cashiers WHERE id = ?").bind(cashierId).first();
  if (!existing) return error("Kasir tidak ditemukan", 404);

  const body = await request.json().catch(() => null);
  if (!body || !body.password || body.password.length < 6) {
    return error("Password baru minimal 6 karakter");
  }

  const { hash, salt } = await hashPassword(body.password);
  await env.DB.prepare("UPDATE global_cashiers SET password_hash = ?, password_salt = ? WHERE id = ?")
    .bind(hash, salt, cashierId)
    .run();

  await logActivity(env, null, "superadmin", "developer", "reset_global_cashier_password", existing.username);

  return json({ ok: true });
}

// "Masuk sebagai kasir" tanpa perlu tahu username/password kasir mana pun.
// Memakai satu akun kasir khusus ("superadmin_dev"), dibuat otomatis sekali
// lalu dipakai ulang — sekarang GLOBAL (tidak lagi 1 per tenant) karena kasir
// memang sudah lintas semua stan.
async function handleSuperadminImpersonateKasir(env) {
  const DEV_USERNAME = "superadmin_dev";

  let cashier = await env.DB.prepare("SELECT * FROM global_cashiers WHERE username = ?")
    .bind(DEV_USERNAME)
    .first();

  if (!cashier) {
    const { hash, salt } = await hashPassword(generateToken());
    cashier = await env.DB.prepare(
      `INSERT INTO global_cashiers (username, password_hash, password_salt, name, is_active)
       VALUES (?, ?, ?, ?, 1) RETURNING *`
    )
      .bind(DEV_USERNAME, hash, salt, "Superadmin (Developer)")
      .first();
  } else if (!cashier.is_active) {
    cashier = await env.DB.prepare("UPDATE global_cashiers SET is_active = 1 WHERE id = ? RETURNING *")
      .bind(cashier.id)
      .first();
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare("INSERT INTO global_cashier_sessions (cashier_id, token, expires_at) VALUES (?, ?, ?)")
    .bind(cashier.id, token, expiresAt)
    .run();

  await logActivity(env, null, "superadmin", "developer", "impersonate_kasir", cashier.username);

  return json({
    token,
    cashier: { id: cashier.id, username: cashier.username, name: cashier.name },
  });
}
