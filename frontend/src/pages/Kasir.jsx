import { useEffect, useState, useCallback } from "react";
import { Wallet, LogOut, ListChecks, PlusCircle, RefreshCw, Search, Printer } from "lucide-react";
import CashierLoginScreen from "../components/kasir/CashierLoginScreen";
import CashierVerifyCard from "../components/kasir/CashierVerifyCard";
import CashierOrderForm from "../components/kasir/CashierOrderForm";
import ReceiptPrintModal from "../components/kasir/ReceiptPrintModal";
import InstallPrompt from "../components/InstallPrompt";
import Footer from "../components/Footer";
import { useRoleManifest } from "../hooks/useRoleManifest";
import { api, kasirApi } from "../lib/api";
import { printReceipt } from "../lib/printReceipt";

// ============================================================================
// KASIR GLOBAL — SATU akun kasir untuk SEMUA stan sekaligus (bukan lagi 1
// halaman kasir per stan). Halaman ini diakses lewat /kasir (TANPA slug
// tenant), lihat App.jsx. 1 transaksi boleh berisi item campuran dari
// beberapa stan; backend (handleKasirCreateOrder) yang memecahnya jadi
// beberapa baris order (1 per stan) supaya dapur tiap stan tetap cuma lihat
// pesanan miliknya sendiri.
// ============================================================================

const TOKEN_KEY = "kasir_token";
const CASHIER_KEY = "kasir_info";
const PAPER_WIDTH_KEY = "kasir_receipt_paper_width";

export default function Kasir() {
  useRoleManifest("kasir");
  // CATATAN: useThemeSync() SENGAJA tidak dipakai di sini — halaman ini
  // lintas banyak stan (masing-masing bisa punya tema warna sendiri), jadi
  // tidak ada 1 "tema toko" tunggal yang relevan untuk disinkronkan.

  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [cashier, setCashier] = useState(() => {
    const saved = sessionStorage.getItem(CASHIER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState("order"); // 'verify' | 'order'
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [tenantsById, setTenantsById] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [toast, setToast] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [receiptModal, setReceiptModal] = useState(null); // { orders, items, groupCode } | null
  const [paperWidth, setPaperWidth] = useState(() => localStorage.getItem(PAPER_WIDTH_KEY) || "58");

  function togglePaperWidth() {
    const next = paperWidth === "58" ? "80" : "58";
    setPaperWidth(next);
    localStorage.setItem(PAPER_WIDTH_KEY, next);
  }

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const data = await kasirApi.getOrders(token);
      setOrders(data.orders || []);
    } catch (e) {
      if (e.message?.toLowerCase().includes("unauthorized")) handleLogout();
    } finally {
      setLoadingOrders(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadMenu = useCallback(() => {
    // Menu GABUNGAN semua stan aktif — endpoint publik yang sama dengan
    // yang dipakai halaman Customer (/public/menu-all), supaya kasir selalu
    // melihat menu terbaru dari semua stan dalam 1 daftar.
    api
      .getAllMenu()
      .then((data) => {
        setMenu(data.menu || []);
        setTenantsById(data.tenants || {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    loadOrders();
    loadMenu();
    const interval = setInterval(() => {
      loadOrders();
      loadMenu();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadOrders, loadMenu]);

  async function handleLogin(username, password) {
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await kasirApi.login(username, password);
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(CASHIER_KEY, JSON.stringify(data.cashier));
      setToken(data.token);
      setCashier(data.cashier);
    } catch (e) {
      setLoginError(e.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    if (token) kasirApi.logout(token).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CASHIER_KEY);
    setToken(null);
    setCashier(null);
    setOrders([]);
  }

  async function handleVerify(order) {
    setVerifyingId(order.id);
    try {
      const data = await kasirApi.verifyPayment(token, order.id);
      const updatedById = {};
      for (const o of data.orders || []) updatedById[o.id] = o;
      setOrders((prev) => prev.map((o) => (updatedById[o.id] ? { ...o, ...updatedById[o.id] } : o)));
      const codes = (data.orders || []).map((o) => o.order_code).join(", ");
      setToast(
        (data.orders || []).length > 1
          ? `Pesanan ${codes} berhasil diverifikasi & ditandai lunas ✅ (1 transaksi, ${data.orders.length} stan)`
          : `Pesanan ${codes || order.order_code} berhasil diverifikasi & ditandai lunas ✅`
      );
      setTimeout(() => setToast(""), 3500);
    } catch (e) {
      setToast(e.message);
      setTimeout(() => setToast(""), 3000);
    } finally {
      setVerifyingId(null);
    }
  }

  // Cetak ulang nota kapan saja, mis. kalau print pertama gagal/nota kertas macet.
  // Dipanggil dari daftar Verifikasi, jadi cuma tahu 1 order (bukan grup lengkap)
  // — cukup untuk cetak ulang nota order itu sendiri.
  function handleReprint(order) {
    const printed = printReceipt({
      orders: [order],
      items: null,
      cashierName: cashier?.name,
      paperWidth,
    });
    if (!printed) {
      setToast("Struk gagal dicetak. Coba lagi.");
      setTimeout(() => setToast(""), 6000);
    }
  }

  async function handleCreateOrder(payload) {
    setOrderError("");
    setOrderSubmitting(true);
    const { _receiptItems, ...apiPayload } = payload;
    try {
      const data = await kasirApi.createOrder(token, apiPayload);
      const codes = data.orders.map((o) => `${o.order_code} (${o.tenant_name})`).join(", ");
      setToast(
        data.orders.length > 1
          ? `Pesanan dibuat untuk ${data.orders.length} stan: ${codes} 🎉`
          : `Pesanan ${data.orders[0].order_code} berhasil dibuat & dikirim ke dapur 🎉`
      );
      setTimeout(() => setToast(""), 4500);
      await loadOrders();
      setReceiptModal({ orders: data.orders, items: _receiptItems, groupCode: data.order_group_code });
    } catch (e) {
      setOrderError(e.message);
    } finally {
      setOrderSubmitting(false);
    }
  }

  if (!token) {
    return (
      <>
        <CashierLoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} />
        <Footer />
        <InstallPrompt />
      </>
    );
  }

  // Halaman Verifikasi: pesanan yang belum lunas dan perlu diverifikasi kasir —
  // baik dari pelanggan self-order yang datang ke kasir menyebutkan nomor antriannya,
  // maupun pesanan yang dibuat langsung oleh kasir sendiri tapi belum ditandai lunas
  // (mis. checkbox "Sudah dibayar sekarang" tidak dicentang saat membuat pesanan).
  // Ditampilkan lintas SEMUA stan, dengan nama stan di tiap kartu.
  const unpaidOrders = orders.filter((o) => o.payment_status !== "paid");
  const filteredVerifyOrders = queueSearch.trim()
    ? unpaidOrders.filter(
        (o) =>
          (o.order_code || "").toLowerCase().includes(queueSearch.trim().toLowerCase()) ||
          (o.tenant_name || "").toLowerCase().includes(queueSearch.trim().toLowerCase())
      )
    : unpaidOrders;

  return (
    <div className="min-h-screen bg-cream pb-10">
      <div className="mx-auto min-h-screen w-full max-w-6xl bg-white sm:shadow-[0_0_60px_-15px_rgba(0,122,61,0.25)]">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-5 py-4 text-cream">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava">
              <Wallet size={17} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[16px] font-extrabold leading-tight">Dashboard Kasir</p>
              <p className="truncate text-[11px] text-cream/60">
                {cashier?.name || cashier?.username} · Semua Stan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePaperWidth}
              aria-label="Ganti lebar kertas struk"
              title={`Kertas struk: ${paperWidth}mm (tekan untuk ganti)`}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10.5px] font-bold text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95"
            >
              <Printer size={15} /> {paperWidth}mm
            </button>
            <button onClick={loadOrders} aria-label="Muat ulang" className="rounded-lg p-1.5 text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95">
              <RefreshCw size={17} className={loadingOrders ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleLogout}
              aria-label="Keluar"
              className="rounded-lg p-1.5 text-cream/70 transition hover:bg-white/10 hover:text-cream active:scale-95"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="flex gap-2 px-5 py-4 sm:max-w-md">
          <button
            onClick={() => setTab("verify")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition ${
              tab === "verify" ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink-soft ring-1 ring-ink/10"
            }`}
          >
            <ListChecks size={15} /> Verifikasi
            {unpaidOrders.length > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-extrabold">{unpaidOrders.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("order")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold transition ${
              tab === "order" ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink-soft ring-1 ring-ink/10"
            }`}
          >
            <PlusCircle size={15} /> Buat Pesanan
          </button>
        </div>

        {toast && (
          <div className="mx-5 mb-3 rounded-xl bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-cream animate-pop-in">{toast}</div>
        )}

        {tab === "verify" && (
          <div className="space-y-3 px-5">
            <p className="text-[12px] leading-snug text-ink-soft">
              Daftar pesanan yang belum lunas dari SEMUA stan — baik dari pelanggan self-order (minta sebutkan
              nomor antriannya) maupun pesanan yang dibuat langsung di kasir tapi belum ditandai lunas.
              Tekan Verifikasi setelah pembayaran diterima.
            </p>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 ring-1 ring-ink/10 focus-within:ring-chili sm:max-w-md">
              <Search size={15} className="text-ink-soft" />
              <input
                type="text"
                placeholder="Cari nomor antrian atau nama stan"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="w-full bg-transparent py-2.5 text-[14px] text-ink focus:outline-none"
              />
            </div>

            {loadingOrders && orders.length === 0 && <p className="text-center text-[13px] text-ink-soft">Memuat pesanan...</p>}
            {!loadingOrders && unpaidOrders.length === 0 && (
              <p className="mt-10 text-center text-sm text-ink-soft">Tidak ada pesanan yang perlu diverifikasi.</p>
            )}
            {!loadingOrders && unpaidOrders.length > 0 && filteredVerifyOrders.length === 0 && (
              <p className="mt-10 text-center text-sm text-ink-soft">Nomor antrian / nama stan tidak ditemukan.</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredVerifyOrders.map((o) => (
                <CashierVerifyCard key={o.id} order={o} onVerify={handleVerify} verifying={verifyingId === o.id} onReprint={handleReprint} />
              ))}
            </div>
          </div>
        )}

        {tab === "order" && (
          <CashierOrderForm menu={menu} tenantsById={tenantsById} onSubmit={handleCreateOrder} submitting={orderSubmitting} error={orderError} />
        )}

        <Footer />
      </div>

      {receiptModal && (
        <ReceiptPrintModal
          orders={receiptModal.orders}
          onPrint={() =>
            printReceipt({
              orders: receiptModal.orders,
              items: receiptModal.items,
              cashierName: cashier?.name,
              paperWidth,
            })
          }
          onClose={() => setReceiptModal(null)}
        />
      )}

      <InstallPrompt />
    </div>
  );
}
