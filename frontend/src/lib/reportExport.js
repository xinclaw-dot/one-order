import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { rupiah, formatDateLabel, formatDateTimeLabelWIB } from "./format";

const BUSINESS_NAME = "Orderin Aja";
const LOGO_URL = "/logo.png";
const LOGO_RATIO = 713 / 827; // rasio asli lebar/tinggi logo.png (logo baru OrderinAja, maskot + tulisan)

// Warna brand hijau (samakan dengan --color-ink / --color-chili-dark di index.css)
// Dipakai sebagai "plate" warna solid di belakang logo, supaya logo dengan elemen putih
// tetap terlihat jelas walau ditaruh di atas kertas/sheet putih.
const BRAND_RGB = [0, 122, 61]; // #007a3d
const BRAND_HEX = "FF007A3D";
const BRAND_HEX_DARK = "FF00873D";

const RANGE_LABELS = {
  today: "Hari Ini",
  week: "7 Hari Terakhir",
  month: "30 Hari Terakhir",
  all: "Semua Waktu",
};

function generatedAtLabel() {
  const now = new Date();
  return now.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }) + " WIB";
}

function todayFileDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// ============================================
// LOGO: dimuat sekali sebagai data URL & di-cache,
// supaya export berikutnya tidak perlu fetch ulang.
// Kalau logo gagal dimuat, export tetap lanjut tanpa logo (tidak menggagalkan proses export).
// ============================================
let logoDataUrlPromise = null;
function loadLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(LOGO_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Logo tidak ditemukan");
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoDataUrlPromise;
}

// ============================================
// EXPORT PDF
// Setiap bagian laporan dipisah ke halaman tersendiri, dan logo tampil
// di header setiap halaman dengan plate warna solid agar tetap kontras/jelas.
// ============================================
export async function exportReportsPdf(reports, range) {
  if (!reports) return;
  const rangeLabel = RANGE_LABELS[range] || range;
  const logoDataUrl = await loadLogoDataUrl();

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 0;
  let pageIndex = 0;

  function drawHeader() {
    y = 40;
    // ---- Plate logo (warna solid supaya logo tetap jelas di atas kertas putih) ----
    const plateSize = 44;
    doc.setFillColor(...BRAND_RGB);
    doc.roundedRect(marginX, y - 28, plateSize, plateSize, 6, 6, "F");
    if (logoDataUrl) {
      const pad = 6;
      const avail = plateSize - pad * 2; // logo lebih lebar dari tinggi (LOGO_RATIO > 1), jadi lebar jadi batasan
      const imgW = avail;
      const imgH = imgW / LOGO_RATIO;
      doc.addImage(
        logoDataUrl,
        "PNG",
        marginX + (plateSize - imgW) / 2,
        y - 28 + (plateSize - imgH) / 2,
        imgW,
        imgH
      );
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...BRAND_RGB);
    doc.text(BUSINESS_NAME, marginX + plateSize + 12, y - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Laporan Penjualan & Pelanggan — ${rangeLabel}`, marginX + plateSize + 12, y + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Dicetak: ${generatedAtLabel()}`, pageWidth - marginX, y - 12, { align: "right" });
    doc.setTextColor(0);

    y += 22;
    doc.setDrawColor(...BRAND_RGB);
    doc.setLineWidth(1.2);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 26;
  }

  function newPage(sectionTitle) {
    if (pageIndex > 0) doc.addPage();
    pageIndex += 1;
    drawHeader();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text(sectionTitle, marginX, y);
    y += 10;
    doc.setDrawColor(225);
    doc.setLineWidth(0.7);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;
  }

  function noteText(lines) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(80);
    const wrapped = doc.splitTextToSize(lines, pageWidth - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 12 + 4;
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
  }

  function table(opts) {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "striped",
      headStyles: { fillColor: BRAND_RGB, textColor: 255 },
      styles: { fontSize: 9 },
      ...opts,
    });
    y = doc.lastAutoTable.finalY + 16;
  }

  // ============================================
  // HALAMAN 1 — Ringkasan Umum
  // ============================================
  newPage("Ringkasan Penjualan");
  const s = reports.summary;
  noteText(
    `Rangkuman performa penjualan untuk rentang "${rangeLabel}". Total ${s.completed_orders + s.cancelled_orders} order tercatat, ` +
      `dengan ${s.completed_orders} order selesai/aktif dan ${s.cancelled_orders} order dibatalkan. ` +
      `Rata-rata nilai belanja per order adalah ${rupiah(s.avg_order_value)}.`
  );
  table({
    head: [["Total Penjualan", "Order Selesai/Aktif", "Rata-rata / Order", "Order Dibatalkan"]],
    body: [[rupiah(s.total_revenue), String(s.completed_orders), rupiah(s.avg_order_value), String(s.cancelled_orders)]],
  });

  // ============================================
  // HALAMAN 2 — Produk Terlaris
  // ============================================
  newPage("Produk Terlaris");
  if (reports.top_products.length) {
    const best = reports.top_products[0];
    noteText(
      `Menampilkan hingga 10 produk dengan penjualan (qty) tertinggi pada rentang ini. ` +
        `Produk paling laris adalah "${best.name}" dengan ${best.qty_sold} unit terjual senilai ${rupiah(best.revenue)}.`
    );
  } else {
    noteText("Belum ada produk terjual pada rentang laporan ini.");
  }
  table({
    head: [["#", "Produk", "Qty Terjual", "Pendapatan"]],
    body: reports.top_products.length
      ? reports.top_products.map((p, idx) => [String(idx + 1), p.name, String(p.qty_sold), rupiah(p.revenue)])
      : [["-", "Belum ada data", "-", "-"]],
  });

  // ============================================
  // HALAMAN 3 — Penjualan per Kategori
  // ============================================
  newPage("Penjualan per Kategori");
  if (reports.by_category.length) {
    const topCat = [...reports.by_category].sort((a, b) => b.revenue - a.revenue)[0];
    noteText(
      `Distribusi penjualan berdasarkan kategori menu. Kategori dengan pendapatan tertinggi adalah "${topCat.category}" ` +
        `senilai ${rupiah(topCat.revenue)} dari ${topCat.qty_sold} item terjual.`
    );
  } else {
    noteText("Belum ada data penjualan per kategori pada rentang ini.");
  }
  table({
    head: [["Kategori", "Qty Terjual", "Pendapatan"]],
    body: reports.by_category.length
      ? reports.by_category.map((c) => [c.category, String(c.qty_sold), rupiah(c.revenue)])
      : [["Belum ada data", "-", "-"]],
  });

  // ============================================
  // HALAMAN 4 — Tren Penjualan Harian
  // ============================================
  newPage("Tren Penjualan Harian");
  if (reports.by_day.length) {
    const bestDay = [...reports.by_day].sort((a, b) => b.revenue - a.revenue)[0];
    noteText(
      `Pergerakan pendapatan harian sepanjang rentang laporan. Hari dengan pendapatan tertinggi adalah ` +
        `${formatDateLabel(bestDay.order_date)} dengan ${rupiah(bestDay.revenue)} dari ${bestDay.order_count} order.`
    );
  } else {
    noteText("Belum ada data tren penjualan harian pada rentang ini.");
  }
  table({
    head: [["Tanggal", "Pendapatan", "Jumlah Order"]],
    body: reports.by_day.length
      ? reports.by_day.map((d) => [formatDateLabel(d.order_date), rupiah(d.revenue), String(d.order_count)])
      : [["Belum ada data", "-", "-"]],
  });

  // ============================================
  // HALAMAN 5 — Metode Pembayaran
  // ============================================
  newPage("Metode Pembayaran");
  if (reports.by_payment_method.length) {
    const totalPm = reports.by_payment_method.reduce((sum, pm) => sum + pm.revenue, 0);
    const topPm = [...reports.by_payment_method].sort((a, b) => b.revenue - a.revenue)[0];
    const pct = totalPm > 0 ? Math.round((topPm.revenue / totalPm) * 100) : 0;
    noteText(
      `Perbandingan pendapatan berdasarkan metode pembayaran. Metode paling banyak digunakan adalah ` +
        `${topPm.payment_method.toUpperCase()}, menyumbang sekitar ${pct}% dari total pendapatan pada rentang ini.`
    );
  } else {
    noteText("Belum ada data metode pembayaran pada rentang ini.");
  }
  table({
    head: [["Metode", "Pendapatan", "Jumlah Order"]],
    body: reports.by_payment_method.length
      ? reports.by_payment_method.map((pm) => [pm.payment_method.toUpperCase(), rupiah(pm.revenue), String(pm.order_count)])
      : [["Belum ada data", "-", "-"]],
  });

  // ============================================
  // HALAMAN 6 — Jam Paling Ramai
  // ============================================
  newPage("Jam Paling Ramai");
  if (reports.by_hour.length) {
    const peak = [...reports.by_hour].sort((a, b) => b.order_count - a.order_count)[0];
    noteText(
      `Sebaran jumlah order per jam (WIB), berguna untuk mengatur jadwal staff dapur & kasir. ` +
        `Jam tersibuk adalah pukul ${peak.hour}:00 dengan ${peak.order_count} order.`
    );
  } else {
    noteText("Belum ada data jam ramai pada rentang ini.");
  }
  table({
    head: [["Jam", "Jumlah Order"]],
    body: reports.by_hour.length
      ? reports.by_hour.map((h) => [`${h.hour}:00`, String(h.order_count)])
      : [["Belum ada data", "-"]],
  });

  // ============================================
  // HALAMAN 7 — Laporan Customer: Ringkasan & Pelanggan Royal
  // ============================================
  const c = reports.customers;
  if (c) {
    newPage("Laporan Customer — Ringkasan");
    noteText(
      `Total ${c.total_customers} customer terdaftar sepanjang waktu di aplikasi. ` +
        `Pada rentang "${rangeLabel}", terdapat ${c.new_customers} customer baru mendaftar, ` +
        `dan ${c.active_customers} customer unik yang melakukan transaksi.`
    );
    table({
      head: [["Total Customer Terdaftar", "Customer Baru Daftar", "Customer Aktif Belanja"]],
      body: [[String(c.total_customers), String(c.new_customers), String(c.active_customers)]],
    });

    if (y > pageHeight - 160) {
      doc.addPage();
      pageIndex += 1;
      drawHeader();
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Pelanggan Paling Royal", marginX, y);
    y += 16;
    if (c.top_customers.length) {
      const topC = c.top_customers[0];
      noteText(
        `Daftar pelanggan dengan total belanja tertinggi pada rentang ini. Pelanggan teratas adalah ` +
          `"${topC.name}" (${topC.phone}) dengan ${topC.order_count} order senilai ${rupiah(topC.total_spent)}.`
      );
    } else {
      noteText("Belum ada transaksi pelanggan pada rentang ini.");
    }
    table({
      head: [["#", "Nama", "No. HP", "Jumlah Order", "Total Belanja"]],
      body: c.top_customers.length
        ? c.top_customers.map((tc, idx) => [String(idx + 1), tc.name, tc.phone, String(tc.order_count), rupiah(tc.total_spent)])
        : [["-", "Belum ada data", "-", "-", "-"]],
    });

    // ============================================
    // HALAMAN 8 — Customer Baru Mendaftar
    // ============================================
    newPage("Customer Baru Mendaftar");
    noteText(
      `Daftar customer yang baru mendaftar pada rentang "${rangeLabel}" (maks. 100 data terbaru), diurutkan dari yang paling baru mendaftar.`
    );
    table({
      head: [["Nama", "No. HP", "Tanggal Daftar"]],
      body: c.new_customer_list.length
        ? c.new_customer_list.map((nc) => [nc.name, nc.phone, formatDateTimeLabelWIB(nc.registered_at)])
        : [["Belum ada customer baru", "-", "-"]],
    });
  }

  // ---- Nomor halaman di setiap halaman ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - marginX, pageHeight - 24, { align: "right" });
    doc.text(BUSINESS_NAME, marginX, pageHeight - 24);
  }

  doc.save(`laporan-${range}-${todayFileDate()}.pdf`);
}

// ============================================
// EXPORT EXCEL (ExcelJS — mendukung penyisipan logo)
// Setiap bagian laporan dipisah ke sheet tersendiri, dengan logo tampil
// di header setiap sheet di atas plate warna solid agar tetap jelas terlihat.
// ============================================
export async function exportReportsExcel(reports, range) {
  if (!reports) return;
  const rangeLabel = RANGE_LABELS[range] || range;
  const logoDataUrl = await loadLogoDataUrl();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = BUSINESS_NAME;
  workbook.created = new Date();

  let logoImageId = null;
  if (logoDataUrl) {
    const base64 = logoDataUrl.split(",")[1];
    logoImageId = workbook.addImage({ base64, extension: "png" });
  }

  const CURRENCY_FMT = '"Rp" #,##0';

  function addSheet(sheetName, title, description, columns, rows) {
    const ws = workbook.addWorksheet(sheetName.slice(0, 31));
    const colCount = Math.max(columns.length, 4);

    // ---- Plate logo (kolom A:B, baris 1-4) ----
    ws.mergeCells(1, 1, 4, 2);
    const plateCell = ws.getCell(1, 1);
    plateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_HEX } };
    if (logoImageId !== null) {
      ws.addImage(logoImageId, {
        tl: { col: 0.18, row: 0.18 },
        ext: { width: 84, height: 84 / LOGO_RATIO },
      });
    }

    // ---- Info header (kolom C dst, baris 1-4) ----
    ws.mergeCells(1, 3, 1, colCount);
    ws.getCell(1, 3).value = BUSINESS_NAME;
    ws.getCell(1, 3).font = { bold: true, size: 15, color: { argb: BRAND_HEX_DARK } };

    ws.mergeCells(2, 3, 2, colCount);
    ws.getCell(2, 3).value = `Laporan: ${title}`;
    ws.getCell(2, 3).font = { bold: true, size: 11 };

    ws.mergeCells(3, 3, 3, colCount);
    ws.getCell(3, 3).value = `Rentang: ${rangeLabel}`;
    ws.getCell(3, 3).font = { size: 10, color: { argb: "FF666666" } };

    ws.mergeCells(4, 3, 4, colCount);
    ws.getCell(4, 3).value = `Dicetak: ${generatedAtLabel()}`;
    ws.getCell(4, 3).font = { size: 10, color: { argb: "FF666666" } };

    ws.getRow(1).height = 20;
    ws.getRow(4).height = 20;

    // ---- Deskripsi/insight singkat (baris 6) ----
    let cursor = 6;
    if (description) {
      ws.mergeCells(cursor, 1, cursor, colCount);
      const dCell = ws.getCell(cursor, 1);
      dCell.value = description;
      dCell.font = { italic: true, size: 10, color: { argb: "FF444444" } };
      dCell.alignment = { wrapText: true, vertical: "top" };
      ws.getRow(cursor).height = 30;
      cursor += 2;
    } else {
      cursor += 1;
    }

    // ---- Header tabel ----
    const headerRow = ws.getRow(cursor);
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_HEX } };
      cell.alignment = { vertical: "middle", horizontal: col.format === "text" ? "left" : "right" };
    });
    headerRow.commit();
    const headerRowNumber = cursor;
    cursor += 1;

    // ---- Data ----
    const dataRows = rows.length ? rows : [columns.map(() => "-")];
    dataRows.forEach((rowValues) => {
      const row = ws.getRow(cursor);
      rowValues.forEach((val, idx) => {
        const col = columns[idx];
        const cell = row.getCell(idx + 1);
        cell.value = val;
        if (col?.format === "currency" && typeof val === "number") {
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { horizontal: "right" };
        } else if (col?.format === "number" && typeof val === "number") {
          cell.alignment = { horizontal: "right" };
        }
      });
      cursor += 1;
    });

    // ---- Lebar kolom ----
    columns.forEach((col, idx) => {
      ws.getColumn(idx + 1).width = col.width || 20;
    });

    // ---- Freeze header tabel supaya tetap terlihat saat scroll ----
    ws.views = [{ state: "frozen", ySplit: headerRowNumber }];

    return ws;
  }

  // ---- Ringkasan ----
  const s = reports.summary;
  addSheet(
    "Ringkasan",
    "Ringkasan Penjualan",
    `Total ${s.completed_orders + s.cancelled_orders} order tercatat pada rentang "${rangeLabel}", dengan ${s.completed_orders} ` +
      `order selesai/aktif dan ${s.cancelled_orders} dibatalkan. Rata-rata belanja per order: ${rupiah(s.avg_order_value)}.`,
    [
      { header: "Total Penjualan", format: "currency", width: 20 },
      { header: "Order Selesai/Aktif", format: "number", width: 20 },
      { header: "Rata-rata / Order", format: "currency", width: 20 },
      { header: "Order Dibatalkan", format: "number", width: 20 },
    ],
    [[s.total_revenue, s.completed_orders, s.avg_order_value, s.cancelled_orders]]
  );

  // ---- Produk Terlaris ----
  addSheet(
    "Produk Terlaris",
    "Produk Terlaris",
    reports.top_products.length
      ? `Produk paling laris: "${reports.top_products[0].name}" — ${reports.top_products[0].qty_sold} unit terjual, ${rupiah(reports.top_products[0].revenue)}.`
      : "Belum ada produk terjual pada rentang ini.",
    [
      { header: "#", format: "number", width: 6 },
      { header: "Produk", format: "text", width: 32 },
      { header: "Qty Terjual", format: "number", width: 16 },
      { header: "Pendapatan", format: "currency", width: 20 },
    ],
    reports.top_products.map((p, idx) => [idx + 1, p.name, p.qty_sold, p.revenue])
  );

  // ---- Penjualan per Kategori ----
  addSheet(
    "Per Kategori",
    "Penjualan per Kategori",
    "Rincian jumlah item terjual dan pendapatan yang dikelompokkan per kategori menu.",
    [
      { header: "Kategori", format: "text", width: 24 },
      { header: "Qty Terjual", format: "number", width: 16 },
      { header: "Pendapatan", format: "currency", width: 20 },
    ],
    reports.by_category.map((cat) => [cat.category, cat.qty_sold, cat.revenue])
  );

  // ---- Tren Penjualan Harian ----
  addSheet(
    "Tren Harian",
    "Tren Penjualan Harian",
    "Pergerakan pendapatan dan jumlah order per hari pada rentang laporan ini.",
    [
      { header: "Tanggal", format: "text", width: 18 },
      { header: "Pendapatan", format: "currency", width: 20 },
      { header: "Jumlah Order", format: "number", width: 16 },
    ],
    reports.by_day.map((d) => [formatDateLabel(d.order_date), d.revenue, d.order_count])
  );

  // ---- Metode Pembayaran ----
  addSheet(
    "Metode Bayar",
    "Metode Pembayaran",
    "Perbandingan pendapatan dan jumlah order berdasarkan metode pembayaran yang digunakan pelanggan.",
    [
      { header: "Metode", format: "text", width: 16 },
      { header: "Pendapatan", format: "currency", width: 20 },
      { header: "Jumlah Order", format: "number", width: 16 },
    ],
    reports.by_payment_method.map((pm) => [pm.payment_method.toUpperCase(), pm.revenue, pm.order_count])
  );

  // ---- Jam Paling Ramai ----
  addSheet(
    "Jam Ramai",
    "Jam Paling Ramai",
    "Sebaran jumlah order per jam (WIB), berguna untuk mengatur jadwal staff dapur & kasir.",
    [
      { header: "Jam", format: "text", width: 12 },
      { header: "Jumlah Order", format: "number", width: 16 },
    ],
    reports.by_hour.map((h) => [`${h.hour}:00`, h.order_count])
  );

  // ---- Laporan Customer ----
  const c = reports.customers;
  if (c) {
    addSheet(
      "Ringkasan Customer",
      "Ringkasan Customer",
      `Total ${c.total_customers} customer terdaftar sepanjang waktu. Pada rentang "${rangeLabel}": ${c.new_customers} customer baru ` +
        `mendaftar, ${c.active_customers} customer aktif bertransaksi.`,
      [
        { header: "Total Customer Terdaftar", format: "number", width: 22 },
        { header: "Customer Baru Daftar", format: "number", width: 20 },
        { header: "Customer Aktif Belanja", format: "number", width: 20 },
      ],
      [[c.total_customers, c.new_customers, c.active_customers]]
    );

    addSheet(
      "Pelanggan Royal",
      "Pelanggan Paling Royal",
      c.top_customers.length
        ? `Pelanggan dengan belanja tertinggi: "${c.top_customers[0].name}" (${c.top_customers[0].phone}) — ${rupiah(c.top_customers[0].total_spent)}.`
        : "Belum ada transaksi pelanggan pada rentang ini.",
      [
        { header: "#", format: "number", width: 6 },
        { header: "Nama", format: "text", width: 24 },
        { header: "No. HP", format: "text", width: 18 },
        { header: "Jumlah Order", format: "number", width: 16 },
        { header: "Total Belanja", format: "currency", width: 20 },
      ],
      c.top_customers.map((tc, idx) => [idx + 1, tc.name, tc.phone, tc.order_count, tc.total_spent])
    );

    addSheet(
      "Customer Baru",
      "Customer Baru Mendaftar",
      `Daftar customer yang baru mendaftar pada rentang "${rangeLabel}" (maks. 100 data terbaru), diurutkan dari yang paling baru.`,
      [
        { header: "Nama", format: "text", width: 24 },
        { header: "No. HP", format: "text", width: 18 },
        { header: "Tanggal Daftar", format: "text", width: 22 },
      ],
      c.new_customer_list.map((nc) => [nc.name, nc.phone, formatDateTimeLabelWIB(nc.registered_at)])
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-${range}-${todayFileDate()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
