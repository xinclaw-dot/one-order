// ISI SETELAH SETTING: ganti dengan URL Worker API Anda SENDIRI setelah deploy
// (lihat BAGIAN 5 & 6.2 di README), contoh:
//   export const API_URL = "https://kitchen-order-api.namamu.workers.dev";
// Sengaja dikosongkan (placeholder, BUKAN URL aplikasi lama) supaya build ini
// tidak tersambung diam-diam ke Worker/database aplikasi lama yang sudah berjalan.
export const API_URL = "https://kitchen-order-api.tahlil-thecemandi.workers.dev";

class ApiError extends Error {}

// ============================================
// MULTI-TENANT: slug warung diambil dari URL (/:tenantSlug/...) dan di-set SEKALI
// oleh <TenantLayout> (lihat src/components/TenantLayout.jsx) sebelum halaman apa pun
// yang memanggil api.* dirender. Semua endpoint tenant otomatis dapat prefix /<slug>.
// ============================================
let TENANT_SLUG = null;

export function setTenantSlug(slug) {
  TENANT_SLUG = slug;
}

export function getTenantSlug() {
  return TENANT_SLUG;
}

function tenantUrl(path, tenantSlugOverride) {
  const slug = tenantSlugOverride || TENANT_SLUG;
  if (!slug) {
    throw new ApiError("Slug warung belum diketahui — buka halaman lewat /<nama-warung>/order, dst.");
  }
  return `${API_URL}/${slug}${path}`;
}

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Terjadi kesalahan, coba lagi.");
  return data;
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Menu gabungan SEMUA warung aktif (dipakai halaman customer). Tidak terikat 1 tenant.
  getAllMenu() {
    return fetch(`${API_URL}/public/menu-all`).then(parse);
  },

  // tenantSlug opsional: kalau tidak diisi, pakai tenant dari URL saat ini (TENANT_SLUG).
  // Dipakai eksplisit di halaman Customer supaya login/order/status selalu menyasar
  // warung asal item yang ada di keranjang, bukan sekadar warung yang sedang dibuka di URL.
  login(phone, name, tenantSlug) {
    return fetch(tenantUrl(`/login`, tenantSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name }),
    }).then(parse);
  },

  getMenu() {
    return fetch(tenantUrl(`/menu`)).then(parse);
  },

  getStoreStatus(tenantSlug) {
    return fetch(tenantUrl(`/store-status`, tenantSlug)).then(parse);
  },

  submitOrder(payload, tenantSlug) {
    return fetch(tenantUrl(`/order`, tenantSlug), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(parse);
  },

  getOrders(token) {
    return fetch(tenantUrl(`/orders`), { headers: authHeaders(token) }).then(parse);
  },

  getMyOrders(phone, tenantSlug) {
    return fetch(tenantUrl(`/my-orders?phone=${encodeURIComponent(phone)}`, tenantSlug)).then(parse);
  },

  updateOrderStatus(token, order_id, status) {
    return fetch(tenantUrl(`/order/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ order_id, status }),
    }).then(parse);
  },

  getAdminMenu(token) {
    return fetch(tenantUrl(`/admin/menu`), { headers: authHeaders(token) }).then(parse);
  },

  createMenu(token, form) {
    return fetch(tenantUrl(`/admin/menu`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  updateMenu(token, id, form) {
    return fetch(tenantUrl(`/admin/menu/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  toggleMenuActive(token, id) {
    return fetch(tenantUrl(`/admin/menu/${id}/toggle-active`), {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },

  deleteMenu(token, id) {
    return fetch(tenantUrl(`/admin/menu/${id}`), {
      method: "DELETE",
      headers: authHeaders(token),
    }).then(parse);
  },

  toggleMenuAvailable(token, id) {
    return fetch(tenantUrl(`/admin/menu/${id}/toggle-available`), {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },

  getSettings(token) {
    return fetch(tenantUrl(`/admin/settings`), { headers: authHeaders(token) }).then(parse);
  },

  updateSettings(token, form) {
    return fetch(tenantUrl(`/admin/settings`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  addAddon(token, menuId, form) {
    return fetch(tenantUrl(`/admin/menu/${menuId}/addons`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  deleteAddon(token, menuId, addonId) {
    return fetch(tenantUrl(`/admin/menu/${menuId}/addons/${addonId}`), {
      method: "DELETE",
      headers: authHeaders(token),
    }).then(parse);
  },

  uploadImage(token, file) {
    return fetch(tenantUrl(`/admin/upload`), {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": file.type,
        "X-Filename": file.name,
      },
      body: file,
    }).then(parse);
  },

  getReports(token, range) {
    return fetch(tenantUrl(`/admin/reports?range=${range}`), {
      headers: authHeaders(token),
    }).then(parse);
  },

  // CATATAN: endpoint kasir PER-TENANT (/cashier/*, /admin/cashiers) & fungsi
  // api.cashierLogin/getCashierOrders/dst sudah DIHAPUS total — kasir sekarang
  // GLOBAL (1 akun untuk semua stan), lihat `kasirApi` di bawah file ini.

  updateTokens(token, payload) {
    return fetch(tenantUrl(`/admin/tokens`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    }).then(parse);
  },
};

// ============================================
// KASIR GLOBAL (halaman /kasir, TANPA slug tenant) — satu akun kasir bisa
// membuat & memverifikasi pesanan untuk SEMUA stan sekaligus dalam 1 transaksi
// (item boleh campuran beberapa stan). TIDAK memakai tenantUrl() karena memang
// tidak terikat 1 tenant. Menu gabungan semua stan pakai api.getAllMenu() yang
// sudah ada (endpoint publik /public/menu-all, dipakai bareng halaman Customer).
// ============================================
export const kasirApi = {
  login(username, password) {
    return fetch(`${API_URL}/kasir/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(parse);
  },

  logout(token) {
    return fetch(`${API_URL}/kasir/logout`, {
      method: "POST",
      headers: authHeaders(token),
    }).then(parse);
  },

  getOrders(token) {
    return fetch(`${API_URL}/kasir/orders`, { headers: authHeaders(token) }).then(parse);
  },

  createOrder(token, payload) {
    return fetch(`${API_URL}/kasir/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(payload),
    }).then(parse);
  },

  verifyPayment(token, orderId) {
    return fetch(`${API_URL}/kasir/order/${orderId}/verify-payment`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },

  toggleMenuAvailable(token, menuId) {
    return fetch(`${API_URL}/kasir/menu/${menuId}/toggle-available`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },
};

// ============================================
// SUPERADMIN (khusus /superman) — TIDAK terikat 1 tenant, jadi TIDAK memakai
// tenantUrl(). superadminApi.* mengelola SEMUA tenant lewat SUPERADMIN_TOKEN,
// dan endpoint per-tenant di sini memakai tenant `id` (angka), bukan slug.
// ============================================
export const superadminApi = {
  listTenants(token) {
    return fetch(`${API_URL}/superadmin/tenants`, { headers: authHeaders(token) }).then(parse);
  },

  createTenant(token, form) {
    return fetch(`${API_URL}/superadmin/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  toggleTenantActive(token, id) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/toggle-active`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },

  regenerateTenantTokens(token, id) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/regenerate-tokens`, {
      method: "POST",
      headers: authHeaders(token),
    }).then(parse);
  },

  getGlobalStats(token) {
    return fetch(`${API_URL}/superadmin/stats`, { headers: authHeaders(token) }).then(parse);
  },

  getTenantStats(token, id) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/stats`, { headers: authHeaders(token) }).then(parse);
  },

  getTenantActivity(token, id, limit = 100) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/activity?limit=${limit}`, { headers: authHeaders(token) }).then(parse);
  },

  getTenantBackup(token, id) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/backup`, { headers: authHeaders(token) }).then(parse);
  },

  resetTenant(token, id, confirm, seedSample) {
    return fetch(`${API_URL}/superadmin/tenants/${id}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ confirm, seed_sample: seedSample }),
    }).then(parse);
  },

  // ---------- KASIR GLOBAL (satu akun untuk semua stan) ----------
  listKasir(token) {
    return fetch(`${API_URL}/superadmin/kasir`, { headers: authHeaders(token) }).then(parse);
  },

  createKasir(token, form) {
    return fetch(`${API_URL}/superadmin/kasir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(form),
    }).then(parse);
  },

  toggleKasirActive(token, id) {
    return fetch(`${API_URL}/superadmin/kasir/${id}/toggle-active`, {
      method: "PATCH",
      headers: authHeaders(token),
    }).then(parse);
  },

  resetKasirPassword(token, id, password) {
    return fetch(`${API_URL}/superadmin/kasir/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ password }),
    }).then(parse);
  },

  impersonateKasir(token) {
    return fetch(`${API_URL}/superadmin/impersonate-kasir`, {
      method: "POST",
      headers: authHeaders(token),
    }).then(parse);
  },
};
