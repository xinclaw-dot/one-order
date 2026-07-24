import { useEffect, useState } from "react";
import { ReceiptText, Eraser, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { timeGreeting } from "../lib/format";
import CategoryTabs from "../components/customer/CategoryTabs";
import MenuList from "../components/customer/MenuList";
import CartBar from "../components/customer/CartBar";
import AddItemSheet from "../components/customer/AddItemSheet";
import CartSheet from "../components/customer/CartSheet";
import CheckoutLoginSheet from "../components/customer/CheckoutLoginSheet";
import SuccessSheet from "../components/customer/SuccessSheet";
import MyOrdersSheet from "../components/customer/MyOrdersSheet";
import InstallPrompt from "../components/InstallPrompt";
import Footer from "../components/Footer";
import BottomSheet from "../components/BottomSheet";
import { useThemeSync } from "../hooks/useThemeSync";
import { useRoleManifest } from "../hooks/useRoleManifest";

// MULTI-TENANT: halaman ini menampilkan menu dari SEMUA warung aktif sekaligus
// (dikelompokkan per kategori, nama warung ditempel per item). Keranjang dibatasi
// hanya boleh berisi item dari 1 warung dalam satu waktu -- menambah item dari warung
// lain akan menawarkan untuk mengosongkan keranjang dulu.
//
// SINGLE LOGIN: customer cuma diminta isi nomor HP & nama SEKALI (disimpan sebagai
// "identitas global" di perangkatnya). Setelah itu, tiap kali dia checkout ke warung
// yang belum pernah dia pesan, sistem otomatis mendaftarkan dia ke warung itu di
// belakang layar pakai identitas yang sama -- tanpa nanya lagi. Di database, tiap
// warung tetap punya baris customer sendiri-sendiri (isolasi data per tenant tetap
// utuh) -- yang disatukan hanya pengalaman login di sisi customer.
const IDENTITY_KEY = "kitchen_customer_identity_v1"; // { phone, name }
const USERS_KEY = "kitchen_customer_users_v1"; // { [tenantSlug]: { phone, name, is_returning } }

function loadIdentity() {
  try {
    const saved = localStorage.getItem(IDENTITY_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

// Bandingkan 2 daftar id add-on (urutan diabaikan) untuk menentukan apakah sebuah baris
// keranjang mewakili kombinasi menu + add-on + catatan yang sama persis.
function sameAddonCombo(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((id, i) => id === sortedB[i]);
}

function loadUsersByTenant() {
  try {
    const saved = localStorage.getItem(USERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export default function Customer() {
  useThemeSync();
  useRoleManifest("customer");

  const [catalog, setCatalog] = useState([]); // menu gabungan semua warung
  const [tenantsById, setTenantsById] = useState({});
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [tenantFilter, setTenantFilter] = useState(null); // slug warung yang sedang di-highlight dari rekomendasi

  const [addingItem, setAddingItem] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [pickupType, setPickupType] = useState("now");
  const [pickupTime, setPickupTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [successOrder, setSuccessOrder] = useState(null);

  const [identity, setIdentity] = useState(loadIdentity); // { phone, name } sekali isi, dipakai ke semua warung
  const [usersByTenant, setUsersByTenant] = useState(loadUsersByTenant);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutNeedsName, setCheckoutNeedsName] = useState(false);

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
    // Segarkan berkala supaya status buka/tutup & stok tiap warung tetap up to date.
    const interval = setInterval(loadCatalog, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Muat riwayat pesanan di depan (bukan cuma saat sheet "Pesanan Saya" dibuka) supaya
    // rekomendasi "warung favorit" & "warung serupa" sudah siap begitu halaman dibuka.
    loadMyOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersByTenant]);

  function loadCatalog() {
    api
      .getAllMenu()
      .then((data) => {
        setCatalog(data.menu || []);
        setTenantsById(data.tenants || {});
      })
      .catch(() => {});
  }

  function persistIdentity(next) {
    setIdentity(next);
    if (next) localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
    else localStorage.removeItem(IDENTITY_KEY);
  }

  function persistUsersByTenant(next) {
    setUsersByTenant(next);
    localStorage.setItem(USERS_KEY, JSON.stringify(next));
  }

  function forgetAllAccounts() {
    if (!confirm("Lupakan akun kamu yang tersimpan di perangkat ini?")) return;
    persistIdentity(null);
    persistUsersByTenant({});
    setCart([]);
  }

  const cartTenantSlug = cart[0]?.tenant_slug || null;
  const cartTenantName = cart[0]?.tenant_name || null;
  const cartTenant = cartTenantSlug
    ? Object.values(tenantsById).find((t) => t.slug === cartTenantSlug)
    : null;
  const cartUser = cartTenantSlug ? usersByTenant[cartTenantSlug] : null;
  // Kalau identitas global sudah ada, login-nya otomatis di belakang layar (lihat effect
  // di bawah) -- form login cuma tampil untuk customer yang benar-benar baru pertama kali.
  const needsCheckoutLogin = cart.length > 0 && !cartUser && !identity;
  const autoLoggingIn = cart.length > 0 && !cartUser && !!identity;
  const [autoLoginRetry, setAutoLoginRetry] = useState(0);

  useEffect(() => {
    if (!autoLoggingIn) return;
    let cancelled = false;
    setCheckoutLoading(true);
    setCheckoutError("");
    api
      .login(identity.phone, identity.name, cartTenantSlug)
      .then((data) => {
        if (cancelled) return;
        const savedUser = { ...data.user, is_returning: !!data.is_returning };
        persistUsersByTenant({ ...usersByTenant, [cartTenantSlug]: savedUser });
      })
      .catch((e) => {
        if (!cancelled) setCheckoutError(e.message);
      })
      .finally(() => {
        if (!cancelled) setCheckoutLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoggingIn, cartTenantSlug, autoLoginRetry]);

  function loadMyOrders() {
    const slugs = Object.keys(usersByTenant);
    if (slugs.length === 0) {
      setMyOrders([]);
      return;
    }
    setMyOrdersLoading(true);
    Promise.all(
      slugs.map((slug) =>
        api
          .getMyOrders(usersByTenant[slug].phone, slug)
          .then((data) => (data.orders || []).map((o) => ({ ...o, tenant_slug: slug, tenant_name: tenantNameFor(slug) })))
          .catch(() => [])
      )
    )
      .then((lists) => {
        const merged = lists.flat().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setMyOrders(merged);
      })
      .finally(() => setMyOrdersLoading(false));
  }

  function tenantNameFor(slug) {
    const found = Object.values(tenantsById).find((t) => t.slug === slug);
    return found?.name || slug;
  }

  function openMyOrders() {
    setShowMyOrders(true);
    loadMyOrders();
  }

  async function handleCheckoutLogin(phone, name) {
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const data = await api.login(phone, name, cartTenantSlug);
      const savedUser = { ...data.user, is_returning: !!data.is_returning };
      persistUsersByTenant({ ...usersByTenant, [cartTenantSlug]: savedUser });
      persistIdentity({ phone: savedUser.phone, name: savedUser.name });
      setCheckoutNeedsName(false);
    } catch (e) {
      if (!name && /nama wajib diisi/i.test(e.message)) {
        setCheckoutNeedsName(true);
        setCheckoutError("");
      } else {
        setCheckoutError(e.message);
      }
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Kata-kata pendek (di bawah 4 huruf) diabaikan supaya tidak "cocok" cuma karena
  // kata umum seperti "nasi"/"mie" saja -- fokus ke kata yang lebih khas (mis. "goreng",
  // "ayam", "bakso", "spesial").
  function significantWords(text) {
    return (text || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4);
  }

  // Prioritas 1: warung yang paling sering dipesan dari riwayat pemesanan customer.
  // Prioritas 2: warung LAIN yang menu-nya menyerupai (banyak kata sama) dengan menu-menu
  // yang pernah dipesan sebelumnya -- cara sederhana menebak "mungkin kamu juga suka ini".
  function computeRecommendations() {
    if (!myOrders || myOrders.length === 0) return null;

    const orderCountBySlug = {};
    const orderedWords = new Set();
    for (const o of myOrders) {
      if (!o.tenant_slug) continue;
      orderCountBySlug[o.tenant_slug] = (orderCountBySlug[o.tenant_slug] || 0) + 1;
      for (const item of o.items || []) {
        for (const w of significantWords(item.menu_name)) orderedWords.add(w);
      }
    }

    const favoriteSlug = Object.entries(orderCountBySlug).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (!favoriteSlug) return null;

    const similarityBySlug = {};
    for (const item of catalog) {
      if (item.tenant_slug === favoriteSlug) continue;
      const score = significantWords(item.name).filter((w) => orderedWords.has(w)).length;
      if (score > 0) similarityBySlug[item.tenant_slug] = (similarityBySlug[item.tenant_slug] || 0) + score;
    }

    const alternatives = Object.entries(similarityBySlug)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([slug]) => slug);

    return { favoriteSlug, alternatives };
  }
  const recommendations = computeRecommendations();

  function toggleTenantFilter(slug) {
    setTenantFilter((prev) => (prev === slug ? null : slug));
  }

  let filteredMenu = activeCategory === "Semua" ? catalog : catalog.filter((m) => m.category === activeCategory);
  if (tenantFilter) filteredMenu = filteredMenu.filter((m) => m.tenant_slug === tenantFilter);

  const cartTotal = cart.reduce((s, ci) => s + ci.subtotal, 0);
  const cartQtyCount = cart.reduce((s, ci) => s + ci.qty, 0);

  // Rentang jam "Ambil Nanti": minimal 10 menit dari sekarang (tidak lebih awal dari jam
  // buka warung tujuan), maksimal sampai jam tutup warung itu hari ini.
  function getPickupWindow() {
    if (!cartTenant) return {};
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const candidate = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const minTime = candidate > cartTenant.open_time ? candidate : cartTenant.open_time;
    return { minTime, maxTime: cartTenant.close_time };
  }
  const pickupWindow = getPickupWindow();

  // Setiap kombinasi menu + add-on + catatan adalah baris (line) yang berdiri sendiri di
  // keranjang. Keranjang HANYA boleh berisi item dari 1 warung -- kalau item baru dari
  // warung lain, tawarkan untuk mengosongkan keranjang dulu (bukan digabung diam-diam).
  function addToCart(entry) {
    let base = cart;
    if (cart.length > 0 && cart[0].tenant_slug !== entry.tenant_slug) {
      const proceed = confirm(
        `Keranjang kamu saat ini berisi pesanan untuk ${cart[0].tenant_name}. Menambah item dari ${entry.tenant_name} akan mengosongkan keranjang itu dulu (1 pesanan hanya untuk 1 warung). Lanjutkan?`
      );
      if (!proceed) {
        setAddingItem(null);
        return;
      }
      base = [];
    }

    const idx = base.findIndex(
      (ci) =>
        ci.menu_id === entry.menu_id &&
        sameAddonCombo(ci.addon_ids, entry.addon_ids) &&
        (ci.note || "") === (entry.note || "")
    );

    if (idx >= 0) {
      const next = [...base];
      const newQty = next[idx].qty + entry.qty;
      next[idx] = { ...next[idx], qty: newQty, subtotal: next[idx].unitPrice * newQty };
      setCart(next);
    } else {
      setCart([
        ...base,
        {
          ...entry,
          lineId: `${entry.menu_id}-${entry.addon_ids.join("_")}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ]);
    }
    setAddingItem(null);
  }

  function changeCartQty(lineId, delta) {
    setCart((prev) => {
      const idx = prev.findIndex((ci) => ci.lineId === lineId);
      if (idx < 0) return prev;
      const next = [...prev];
      const newQty = next[idx].qty + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], qty: newQty, subtotal: next[idx].unitPrice * newQty };
      }
      return next;
    });
  }

  function removeFromCart(lineId) {
    setCart((prev) => prev.filter((ci) => ci.lineId !== lineId));
  }

  async function submitOrder() {
    setOrderError("");
    if (pickupType === "scheduled" && !pickupTime) {
      setOrderError("Pilih dulu jam pengambilan pesanan.");
      return;
    }
    if (!cartUser) {
      setOrderError("Masuk dulu untuk warung ini sebelum mengirim pesanan.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.submitOrder(
        {
          phone: cartUser.phone,
          name: cartUser.name,
          payment_method: paymentMethod,
          pickup_type: pickupType,
          pickup_time: pickupType === "scheduled" ? pickupTime : undefined,
          items: cart.map((ci) => ({ menu_id: ci.menu_id, qty: ci.qty, note: ci.note, addon_ids: ci.addon_ids })),
        },
        cartTenantSlug
      );
      setSuccessOrder({ ...data.order, tenant_name: cartTenantName });
      setShowCart(false);
      loadMyOrders();
      loadCatalog(); // stok/status bisa berubah setelah order (mis. menu jadi habis)
    } catch (e) {
      setOrderError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAfterOrder() {
    setCart([]);
    setSuccessOrder(null);
    setPickupType("now");
    setPickupTime("");
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto min-h-screen w-full max-w-3xl bg-white pb-32 sm:shadow-[0_0_60px_-15px_rgba(0,122,61,0.25)]">
        <header className="sticky top-0 z-20 bg-ink px-4 py-4 text-cream">
          <div className="flex items-center gap-2.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black p-1.5 shadow-md shadow-black/20 ring-2 ring-white/70">
              <img src="/logo.png" alt="Warung Kita" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-cream/90">
                {timeGreeting()}{identity?.name ? `, ${identity.name}` : ""}, mau pesan apa? 👋
              </p>
              <p className="truncate text-[11px] text-cream/60">Menu dari semua warung, langsung ke dapur masing-masing</p>
            </div>
            <button
              onClick={openMyOrders}
              aria-label="Pesanan Saya"
              className="shrink-0 rounded-lg p-2 text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95"
            >
              <ReceiptText size={17} />
            </button>
            {identity && (
              <button
                onClick={forgetAllAccounts}
                aria-label="Lupakan akun"
                className="shrink-0 rounded-lg p-2 text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95"
              >
                <Eraser size={17} />
              </button>
            )}
          </div>
        </header>

        {recommendations && (
          <div className="px-4 pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Rekomendasi untuk kamu</p>
              {tenantFilter && (
                <button onClick={() => setTenantFilter(null)} className="text-[11px] font-bold text-chili-dark">
                  Tampilkan semua warung
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              <TenantChip
                label={tenantNameFor(recommendations.favoriteSlug)}
                badge="Favorit kamu"
                active={tenantFilter === recommendations.favoriteSlug}
                onClick={() => toggleTenantFilter(recommendations.favoriteSlug)}
              />
              {recommendations.alternatives.map((slug) => (
                <TenantChip
                  key={slug}
                  label={tenantNameFor(slug)}
                  badge="Mirip seleramu"
                  active={tenantFilter === slug}
                  onClick={() => toggleTenantFilter(slug)}
                />
              ))}
            </div>
          </div>
        )}

        <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

        <MenuList items={filteredMenu} onAdd={setAddingItem} />

        <Footer />
      </div>

      <CartBar count={cartQtyCount} total={cartTotal} onOpen={() => setShowCart(true)} />

      <AddItemSheet item={addingItem} onClose={() => setAddingItem(null)} onConfirm={addToCart} />

      {showCart && needsCheckoutLogin ? (
        <CheckoutLoginSheet
          open={showCart}
          tenantName={cartTenantName}
          onLogin={handleCheckoutLogin}
          loading={checkoutLoading}
          error={checkoutError}
          needsName={checkoutNeedsName}
          onBackToPhone={() => {
            setCheckoutNeedsName(false);
            setCheckoutError("");
          }}
          onClose={() => setShowCart(false)}
        />
      ) : showCart && autoLoggingIn ? (
        <BottomSheet open={showCart} onClose={() => setShowCart(false)}>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {checkoutError ? (
              <>
                <p className="text-[13px] font-medium text-chili-dark">{checkoutError}</p>
                <button
                  onClick={() => setAutoLoginRetry((n) => n + 1)}
                  className="rounded-xl bg-gradient-to-r from-chili to-guava px-4 py-2 text-[13px] font-bold text-white active:scale-95"
                >
                  Coba lagi
                </button>
              </>
            ) : (
              <>
                <Loader2 size={22} className="animate-spin text-chili-dark" />
                <p className="text-[13px] font-semibold text-ink-soft">Menyiapkan akun kamu di {cartTenantName}...</p>
              </>
            )}
          </div>
        </BottomSheet>
      ) : (
        <CartSheet
          open={showCart}
          onClose={() => setShowCart(false)}
          cart={cart}
          cartTenantName={cartTenantName}
          onRemove={removeFromCart}
          onChangeQty={changeCartQty}
          total={cartTotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          pickupType={pickupType}
          setPickupType={setPickupType}
          pickupTime={pickupTime}
          setPickupTime={setPickupTime}
          pickupWindow={pickupWindow}
          onSubmit={submitOrder}
          submitting={submitting}
          error={orderError}
          qrisImageUrl={cartTenant?.qris_image_url}
        />
      )}

      <SuccessSheet order={successOrder} onReset={resetAfterOrder} qrisImageUrl={cartTenant?.qris_image_url} />

      <MyOrdersSheet
        open={showMyOrders}
        onClose={() => setShowMyOrders(false)}
        orders={myOrders}
        loading={myOrdersLoading}
        onRefresh={loadMyOrders}
      />

      <InstallPrompt liftPx={cartQtyCount > 0 ? 84 : 0} />
    </div>
  );
}

function TenantChip({ label, badge, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 flex-col items-start rounded-2xl px-3.5 py-2 text-left ring-1 transition ${
        active ? "bg-gradient-to-r from-chili to-guava text-white ring-transparent" : "bg-cream text-ink ring-ink/10"
      }`}
    >
      <span className={`text-[9.5px] font-extrabold uppercase tracking-wide ${active ? "text-white/80" : "text-chili-dark"}`}>
        {badge}
      </span>
      <span className="max-w-[140px] truncate text-[12.5px] font-bold">{label}</span>
    </button>
  );
}
