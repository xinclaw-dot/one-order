import { useState } from "react";
import { Trophy, PackageSearch, TrendingUp, CreditCard, Clock, FileDown, FileSpreadsheet, Users, UserPlus } from "lucide-react";
import BarRow from "./BarRow";
import { rupiah, maxOf, formatDateLabel, formatDateTimeLabelWIB } from "../../lib/format";
import { exportReportsPdf, exportReportsExcel } from "../../lib/reportExport";

const RANGES = [
  { id: "today", label: "Hari Ini" },
  { id: "week", label: "7 Hari" },
  { id: "month", label: "30 Hari" },
  { id: "all", label: "Semua" },
];

function StatBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <p className="text-[11px] font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 font-ticket text-lg font-extrabold text-ink">{value}</p>
    </div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
      <h3 className="mb-3 flex items-center gap-1.5 font-display text-[14px] font-extrabold">
        <Icon size={15} className="text-chili-dark" /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function ReportsPanel({ range, setRange, reports, loading }) {
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    setExporting(true);
    try {
      await exportReportsPdf(reports, range);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      await exportReportsExcel(reports, range);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold transition ${
              range === r.id ? "bg-ink text-cream" : "bg-white text-ink/60 ring-1 ring-ink/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-[13px] text-ink-soft">Memuat laporan...</p>}

      {reports && !loading && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-bold text-ink ring-1 ring-ink/10 active:scale-[0.98] disabled:opacity-50"
          >
            <FileDown size={14} className="text-chili-dark" /> {exporting ? "Memproses..." : "Export PDF"}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-[12.5px] font-bold text-ink ring-1 ring-ink/10 active:scale-[0.98] disabled:opacity-50"
          >
            <FileSpreadsheet size={14} className="text-matcha" /> {exporting ? "Memproses..." : "Export Excel"}
          </button>
        </div>
      )}

      {reports && !loading && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Total Penjualan" value={rupiah(reports.summary.total_revenue)} />
            <StatBox label="Order Selesai/Aktif" value={reports.summary.completed_orders} />
            <StatBox label="Rata-rata / Order" value={rupiah(reports.summary.avg_order_value)} />
            <StatBox label="Order Dibatalkan" value={reports.summary.cancelled_orders} />
          </div>

          {reports.customers && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Total Customer Terdaftar" value={reports.customers.total_customers} />
              <StatBox label="Customer Baru Daftar" value={reports.customers.new_customers} />
              <StatBox label="Customer Aktif Belanja" value={reports.customers.active_customers} />
              <StatBox
                label="Rata-rata Belanja/Customer"
                value={rupiah(
                  reports.customers.active_customers > 0
                    ? Math.round(reports.summary.total_revenue / reports.customers.active_customers)
                    : 0
                )}
              />
            </div>
          )}

          <Card icon={Trophy} title="Produk Terlaris">
            {reports.top_products.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Belum ada data penjualan di rentang ini.</p>
            ) : (
              reports.top_products.map((p, idx) => (
                <BarRow
                  key={p.menu_id}
                  rank={idx + 1}
                  label={p.name}
                  valueLabel={`${p.qty_sold} terjual · ${rupiah(p.revenue)}`}
                  pct={(p.qty_sold / maxOf(reports.top_products, "qty_sold")) * 100}
                />
              ))
            )}
          </Card>

          <Card icon={PackageSearch} title="Penjualan per Kategori">
            {reports.by_category.map((c) => (
              <BarRow
                key={c.category}
                label={c.category}
                valueLabel={rupiah(c.revenue)}
                pct={(c.revenue / maxOf(reports.by_category, "revenue")) * 100}
                accent="sky"
              />
            ))}
          </Card>

          <Card icon={TrendingUp} title="Tren Penjualan Harian">
            {reports.by_day.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Belum ada data.</p>
            ) : (
              reports.by_day.map((d) => (
                <BarRow
                  key={d.order_date}
                  label={formatDateLabel(d.order_date)}
                  valueLabel={`${rupiah(d.revenue)} (${d.order_count} order)`}
                  pct={(d.revenue / maxOf(reports.by_day, "revenue")) * 100}
                />
              ))
            )}
          </Card>

          <Card icon={CreditCard} title="Metode Pembayaran">
            {reports.by_payment_method.map((pm) => (
              <BarRow
                key={pm.payment_method}
                label={pm.payment_method.toUpperCase()}
                valueLabel={`${rupiah(pm.revenue)} (${pm.order_count} order)`}
                pct={(pm.revenue / maxOf(reports.by_payment_method, "revenue")) * 100}
                accent="sky"
              />
            ))}
          </Card>

          <Card icon={Clock} title="Jam Paling Ramai">
            <p className="-mt-2 mb-3 text-[12px] text-ink-soft">Berguna untuk atur jadwal staff dapur.</p>
            {reports.by_hour.length === 0 ? (
              <p className="text-[13px] text-ink-soft">Belum ada data.</p>
            ) : (
              reports.by_hour.map((h) => (
                <BarRow
                  key={h.hour}
                  label={`${h.hour}:00`}
                  valueLabel={`${h.order_count} order`}
                  pct={(h.order_count / maxOf(reports.by_hour, "order_count")) * 100}
                />
              ))
            )}
          </Card>

          {reports.customers && (
            <Card icon={Users} title="Pelanggan Paling Royal">
              <p className="-mt-2 mb-3 text-[12px] text-ink-soft">
                Berdasarkan total belanja pada rentang laporan ini.
              </p>
              {reports.customers.top_customers.length === 0 ? (
                <p className="text-[13px] text-ink-soft">Belum ada data pelanggan pada rentang ini.</p>
              ) : (
                reports.customers.top_customers.map((c, idx) => (
                  <BarRow
                    key={c.phone}
                    rank={idx + 1}
                    label={`${c.name} (${c.phone})`}
                    valueLabel={`${c.order_count} order · ${rupiah(c.total_spent)}`}
                    pct={(c.total_spent / maxOf(reports.customers.top_customers, "total_spent")) * 100}
                    accent="sky"
                  />
                ))
              )}
            </Card>
          )}

          {reports.customers && (
            <Card icon={UserPlus} title="Customer Baru Mendaftar">
              <p className="-mt-2 mb-3 text-[12px] text-ink-soft">
                {reports.customers.new_customers} customer baru mendaftar pada rentang laporan ini.
              </p>
              {reports.customers.new_customer_list.length === 0 ? (
                <p className="text-[13px] text-ink-soft">Belum ada customer baru pada rentang ini.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-ink-soft">
                        <th className="pb-2 font-semibold">Nama</th>
                        <th className="pb-2 font-semibold">No. HP</th>
                        <th className="pb-2 font-semibold">Tanggal Daftar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.customers.new_customer_list.map((c) => (
                        <tr key={c.phone} className="border-t border-ink/5">
                          <td className="py-1.5 pr-2 font-medium text-ink">{c.name}</td>
                          <td className="py-1.5 pr-2 text-ink-soft">{c.phone}</td>
                          <td className="py-1.5 text-ink-soft">{formatDateTimeLabelWIB(c.registered_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
