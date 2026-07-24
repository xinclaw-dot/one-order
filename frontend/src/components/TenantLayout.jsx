import { useEffect, useState } from "react";
import { useParams, Outlet } from "react-router-dom";
import { setTenantSlug, API_URL } from "../lib/api";

// ============================================
// MULTI-TENANT: dibungkus di sekitar semua route /:tenantSlug/*.
// Set slug tenant aktif ke api.js SEBELUM halaman anak (Customer/Kitchen/Admin/Kasir)
// dirender, dan validasi ke backend bahwa tenant tsb memang ada & aktif — supaya
// slug yang salah ketik langsung dapat pesan jelas, bukan error API yang membingungkan.
// ============================================
export default function TenantLayout() {
  const { tenantSlug } = useParams();
  const [status, setStatus] = useState("checking"); // checking | ok | not_found

  useEffect(() => {
    setTenantSlug(tenantSlug);
    setStatus("checking");

    fetch(`${API_URL}/${tenantSlug}/store-status`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then(() => setStatus("ok"))
      .catch(() => setStatus("not_found"));
  }, [tenantSlug]);

  if (status === "checking") return null;

  if (status === "not_found") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Warung tidak ditemukan</h1>
        <p style={{ color: "#666" }}>
          Warung "{tenantSlug}" tidak ditemukan atau sedang tidak aktif. Cek kembali link yang Anda gunakan.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
