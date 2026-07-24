import { useEffect, useState } from "react";
import { ChefHat, Bell, BellOff, LogOut, Smartphone, UserRound, AlertTriangle } from "lucide-react";
import LoginGate from "../components/LoginGate";
import OrderTicket from "../components/kitchen/OrderTicket";
import InstallPrompt from "../components/InstallPrompt";
import Footer from "../components/Footer";
import { useKitchenOrders } from "../hooks/useKitchenOrders";
import { useThemeSync } from "../hooks/useThemeSync";
import { useRoleManifest } from "../hooks/useRoleManifest";
import { api } from "../lib/api";

const FILTERS = [
  { id: "aktif", label: "Belum Selesai" },
  { id: "selesai", label: "Selesai" },
  { id: "semua", label: "Semua" },
];

export default function Kitchen() {
  useThemeSync();
  useRoleManifest("kitchen");
  const [token, setToken] = useState(() => sessionStorage.getItem("kitchen_token"));
  const [filter, setFilter] = useState("aktif");
  const { orders, connected, soundEnabled, audioUnlocked, toggleSound, unlockAudio, updateStatus } = useKitchenOrders(token);

  useEffect(() => {
    if (!token) return;
    api.getOrders(token).catch(() => {
      setToken(null);
      sessionStorage.removeItem("kitchen_token");
    });
  }, [token]);

  function handleLoginSubmit(t) {
    sessionStorage.setItem("kitchen_token", t);
    unlockAudio();
    setToken(t);
  }

  function handleLogout() {
    sessionStorage.removeItem("kitchen_token");
    setToken(null);
  }

  function sendWA(order) {
    const queueNumber = order.order_code || `#${order.daily_order_number}`;
    const sapaan = order.user_name ? `Kak ${order.user_name}` : "Anda";
    const msg =
      order.status === "pending"
        ? "Halo, pesanan Anda sedang diproses 🙏"
        : `Pesanan anda dengan nomor antrian ${queueNumber} telah selesai. Silahkan diambil. Semoga ${sapaan} puas dengan layanan kami.`;
    const phone = order.user_phone.replace(/^0/, "62");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!token)
    return (
      <>
        <LoginGate title="Dashboard Kitchen" icon={ChefHat} onSubmit={handleLoginSubmit} />
        <Footer />
        <InstallPrompt />
      </>
    );

  const filteredOrders =
    filter === "semua"
      ? orders
      : filter === "aktif"
      ? orders.filter((o) => o.status !== "selesai" && o.status !== "dibatalkan")
      : orders.filter((o) => o.status === filter);

  // Pisahkan jadi 2 daftar: order self-order (dari customer langsung) dan order dari kasir,
  // supaya dapur bisa lebih mudah membedakan sumber pesanan.
  const selfOrders = filteredOrders.filter((o) => o.order_source === "self");
  const kasirOrders = filteredOrders.filter((o) => o.order_source === "kasir");

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto min-h-screen w-full max-w-6xl bg-white pb-10 sm:shadow-[0_0_60px_-15px_rgba(0,122,61,0.25)]">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-white/95 px-5 py-4 backdrop-blur ring-1 ring-ink/5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-chili to-guava text-white">
              <ChefHat size={17} />
            </span>
            <p className="font-display text-[16px] font-extrabold">Dashboard Kitchen</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleSound} className="text-ink/70" aria-label="Toggle suara notifikasi">
              {soundEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-ink/60 sm:flex">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-matcha animate-pulse-dot" : "bg-status-cancel"}`} />
              {connected ? "Realtime tersambung" : "Terputus..."}
            </span>
            <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${connected ? "bg-matcha animate-pulse-dot" : "bg-status-cancel"}`} />
            <button
              onClick={handleLogout}
              aria-label="Keluar"
              className="rounded-lg p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink active:scale-95"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {soundEnabled && !audioUnlocked && (
          <button
            onClick={unlockAudio}
            className="flex w-full items-center justify-center gap-2 bg-amber-100 px-5 py-2.5 text-[12.5px] font-bold text-amber-900 active:bg-amber-200"
          >
            <AlertTriangle size={15} />
            Suara notifikasi belum aktif — tap di sini untuk mengaktifkan
          </button>
        )}

        <div className="flex gap-2 overflow-x-auto px-5 py-4 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
                filter === f.id ? "bg-gradient-to-r from-chili to-guava text-white" : "bg-white text-ink/60 ring-1 ring-ink/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 && <p className="mt-16 text-center text-sm text-ink/40">Belum ada pesanan.</p>}

        {filteredOrders.length > 0 && (
          <>
            <section className="px-4 pb-6 sm:px-5">
              <h2 className="mb-3 flex items-center gap-1.5 font-display text-[13px] font-extrabold uppercase tracking-wide text-ink/70">
                <Smartphone size={14} /> Self Order
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/50">{selfOrders.length}</span>
              </h2>
              {selfOrders.length === 0 ? (
                <p className="text-[13px] text-ink/40">Belum ada pesanan self order.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory scroll-px-4 sm:flex-wrap sm:overflow-visible sm:snap-none">
                  {selfOrders.map((order, idx) => (
                    <div key={order.id} className="w-[250px] shrink-0 snap-start sm:w-[270px]">
                      <OrderTicket order={order} index={idx} onUpdateStatus={updateStatus} onSendWA={sendWA} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="px-4 pb-6 sm:px-5">
              <h2 className="mb-3 flex items-center gap-1.5 font-display text-[13px] font-extrabold uppercase tracking-wide text-ink/70">
                <UserRound size={14} /> Order by Kasir
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/50">{kasirOrders.length}</span>
              </h2>
              {kasirOrders.length === 0 ? (
                <p className="text-[13px] text-ink/40">Belum ada pesanan dari kasir.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory scroll-px-4 sm:flex-wrap sm:overflow-visible sm:snap-none">
                  {kasirOrders.map((order, idx) => (
                    <div key={order.id} className="w-[250px] shrink-0 snap-start sm:w-[270px]">
                      <OrderTicket order={order} index={idx} onUpdateStatus={updateStatus} onSendWA={sendWA} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <Footer />
      </div>
      <InstallPrompt />
    </div>
  );
}
