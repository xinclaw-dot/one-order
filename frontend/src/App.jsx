import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TenantLayout from "./components/TenantLayout";
import Customer from "./pages/Customer";
import Kitchen from "./pages/Kitchen";
import Admin from "./pages/Admin";
import Kasir from "./pages/Kasir";
import Superadmin from "./pages/Superadmin";

// MULTI-TENANT: setiap warung diakses lewat prefix slug, contoh:
//   domain.com/warung-kita/order
//   domain.com/warung-kita/kitchen
//   domain.com/warung-kita/admin
// <TenantLayout> membaca ":tenantSlug" dari URL dan menyiapkannya untuk semua
// panggilan api.* sebelum halaman di dalamnya dirender.
//
// "/superman" TETAP global (tidak terikat 1 tenant) — superadmin mengelola semua
// tenant dari sana. Sengaja TIDAK ditautkan di menu/navigasi manapun.
//
// "/kasir" JUGA global (SENGAJA TIDAK di dalam /:tenantSlug lagi) — sejak
// restruktur "single kasir", satu akun kasir memproses pesanan untuk SEMUA
// stan sekaligus dari 1 halaman ini, bukan 1 halaman kasir per stan.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:tenantSlug" element={<TenantLayout />}>
          <Route index element={<Navigate to="order" replace />} />
          <Route path="order" element={<Customer />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="order" replace />} />
        </Route>

        <Route path="/kasir" element={<Kasir />} />
        <Route path="/superman" element={<Superadmin />} />

        {/* HALAMAN UTAMA: langsung tampilkan katalog menu gabungan semua warung, tanpa
            perlu slug tenant di URL sama sekali -- Customer sudah generik (setiap item
            menu membawa info warungnya sendiri-sendiri, dan checkout memakai slug dari
            keranjang, bukan dari URL). */}
        <Route path="/" element={<Customer />} />

        {/* Path lain yang tidak dikenali (typo, dst) -- bukan slug tenant yang valid
            dan bukan juga root -- tampilkan pesan netral saja. */}
        <Route path="*" element={<NoTenantScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

function NoTenantScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Warung Kita</h1>
      <p style={{ color: "#666" }}>Gunakan link warung Anda, contoh: /nama-warung-anda/order</p>
    </div>
  );
}
