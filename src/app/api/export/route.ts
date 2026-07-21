import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
// ^ sesuaikan bila helper server Supabase Anda beda nama/lokasi

export const runtime = "nodejs";        // exceljs butuh Node runtime (bukan edge)
export const dynamic = "force-dynamic";

// ---------- Helper konversi nilai ----------
const num = (v: unknown) => (v == null ? null : Number(v));
const d = (v: unknown) => (v ? new Date(v as string) : null);

// ---------- Ambil SEMUA baris (paginasi 1000-an, aman untuk data 20 tahun) ----------
async function fetchAll<T = Record<string, unknown>>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  orderCol?: string,
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (orderCol) q = q.order(orderCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ---------- Definisi kolom & pembuat sheet ----------
type ColType = "text" | "money" | "date" | "int";
type Col = { header: string; key: string; width?: number; type?: ColType };

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  cols: Col[],
  rows: Record<string, unknown>[],
) {
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }], // header selalu terlihat saat scroll
  });

  ws.columns = cols.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));

  // Style header (tema teal Athaya)
  const headerRow = ws.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  rows.forEach((r) => ws.addRow(r));

  // Format angka/tanggal per kolom
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.type === "money") col.numFmt = '"Rp"#,##0';
    else if (c.type === "date") col.numFmt = "dd/mm/yyyy";
    else if (c.type === "int") col.numFmt = "#,##0";
  });

  return ws;
}

// ---------- Label enum → Bahasa Indonesia ----------
const walletType: Record<string, string> = { cash: "Tunai", bank: "Bank", ewallet: "E-Wallet" };
const txType: Record<string, string> = {
  income: "Masuk", expense: "Keluar", transfer_in: "Transfer Masuk", transfer_out: "Transfer Keluar",
};
const moveType: Record<string, string> = {
  purchase_in: "Masuk (Beli)", sale_out: "Keluar (Jual)", adjustment: "Penyesuaian",
};
const payMethod: Record<string, string> = { cash: "Tunai", monthly_invoice: "Invoice Bulanan" };
const invStatus: Record<string, string> = {
  draft: "Draft", sent: "Terkirim", paid: "Lunas", overdue: "Jatuh Tempo",
};
const warrStatus: Record<string, string> = { active: "Aktif", expiring: "Akan Habis", expired: "Habis" };
const rabStatus: Record<string, string> = { draft: "Draft", ongoing: "Berjalan", done: "Selesai" };
const repairTarget: Record<string, string> = { asset: "Asset", network: "Network", cctv: "CCTV" };
const rabItemType: Record<string, string> = { budget: "RAB", expense: "Pengeluaran" };

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // ---- Tabel referensi untuk terjemahkan id → nama ----
    const [clients, products, wallets, categories, distributors, rabProjects] =
      await Promise.all([
        fetchAll(supabase, "clients"),
        fetchAll(supabase, "products"),
        fetchAll(supabase, "wallets"),
        fetchAll(supabase, "categories"),
        fetchAll(supabase, "distributors"),
        fetchAll(supabase, "rab_projects"),
      ]);

    const clientName = new Map(clients.map((c: any) => [c.id, c.company_name]));
    const productName = new Map(products.map((p: any) => [p.id, p.name]));
    const walletName = new Map(wallets.map((w: any) => [w.id, w.name]));
    const categoryName = new Map(categories.map((c: any) => [c.id, c.name]));
    const distributorName = new Map(distributors.map((x: any) => [x.id, x.name]));
    const rabName = new Map(rabProjects.map((r: any) => [r.id, r.project_name]));

    // ---- Ambil data transaksional ----
    const [
      walletBal, walletTx, prodStock, stockMoves,
      purchases, purchaseItems, sales, saleItems,
      opEx, persEx, assets, invoices, repairs,
      network, cctv, rabSummary, rabItems,
    ] = await Promise.all([
      fetchAll(supabase, "v_wallet_balances"),
      fetchAll(supabase, "wallet_transactions", "tx_date"),
      fetchAll(supabase, "v_product_stock"),
      fetchAll(supabase, "stock_movements", "created_at"),
      fetchAll(supabase, "purchases", "purchase_date"),
      fetchAll(supabase, "purchase_items"),
      fetchAll(supabase, "sales", "sale_date"),
      fetchAll(supabase, "sale_items"),
      fetchAll(supabase, "operational_expenses", "expense_date"),
      fetchAll(supabase, "personal_expenses", "expense_date"),
      fetchAll(supabase, "v_client_assets"),
      fetchAll(supabase, "monthly_invoices", "period_month"),
      fetchAll(supabase, "repair_logs", "repair_date"),
      fetchAll(supabase, "network_credentials"),
      fetchAll(supabase, "cctv_systems"),
      fetchAll(supabase, "v_rab_summary"),
      fetchAll(supabase, "rab_items"),
    ]);

    // Peta bantu tanggal/nama untuk sheet "item"
    const purchaseInfo = new Map(
      purchases.map((p: any) => [p.id, { date: p.purchase_date, dist: distributorName.get(p.distributor_id) ?? "-" }]),
    );
    const saleInfo = new Map(
      sales.map((s: any) => [s.id, { date: s.sale_date, client: clientName.get(s.client_id) ?? "-" }]),
    );

    const wb = new ExcelJS.Workbook();
    wb.creator = "Athaya Computer — PBMS-IT";
    wb.created = new Date();

    // ===== 1. Wallet =====
    addSheet(wb, "Wallet", [
      { header: "Nama", key: "nama", width: 22 },
      { header: "Tipe", key: "tipe" },
      { header: "Saldo", key: "saldo", type: "money", width: 18 },
      { header: "Status", key: "status" },
    ], walletBal.map((w: any) => ({
      nama: w.name, tipe: walletType[w.type] ?? w.type,
      saldo: num(w.balance), status: w.is_active ? "Aktif" : "Nonaktif",
    })));

    // ===== 2. Transaksi Wallet =====
    addSheet(wb, "Transaksi Wallet", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Wallet", key: "wallet", width: 20 },
      { header: "Jenis", key: "jenis" },
      { header: "Jumlah", key: "jumlah", type: "money", width: 18 },
      { header: "Referensi", key: "ref" },
      { header: "Keterangan", key: "ket", width: 30 },
    ], walletTx.map((t: any) => ({
      tgl: d(t.tx_date), wallet: walletName.get(t.wallet_id) ?? "-",
      jenis: txType[t.type] ?? t.type, jumlah: num(t.amount),
      ref: t.ref_type ?? "", ket: t.description ?? "",
    })));

    // ===== 3. Client =====
    addSheet(wb, "Client", [
      { header: "Perusahaan", key: "perusahaan", width: 24 },
      { header: "PIC", key: "pic", width: 20 },
      { header: "Kategori", key: "kategori" },
      { header: "Email", key: "email", width: 24 },
      { header: "Telepon", key: "telepon" },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "Status", key: "status" },
      { header: "Bergabung", key: "gabung", type: "date" },
      { header: "Catatan", key: "catatan", width: 30 },
    ], clients.map((c: any) => ({
      perusahaan: c.company_name, pic: c.contact_name ?? "",
      kategori: categoryName.get(c.category_id) ?? "", email: c.email ?? "",
      telepon: c.phone ?? "", alamat: c.address ?? "",
      status: c.status === "active" ? "Aktif" : "Nonaktif",
      gabung: d(c.joined_date), catatan: c.notes ?? "",
    })));

    // ===== 4. Distributor =====
    addSheet(wb, "Distributor", [
      { header: "Nama", key: "nama", width: 24 },
      { header: "Kontak", key: "kontak", width: 20 },
      { header: "Telepon", key: "telepon" },
      { header: "Email", key: "email", width: 24 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "Catatan", key: "catatan", width: 30 },
    ], distributors.map((x: any) => ({
      nama: x.name, kontak: x.contact_name ?? "", telepon: x.phone ?? "",
      email: x.email ?? "", alamat: x.address ?? "", catatan: x.notes ?? "",
    })));

    // ===== 5. Produk & Stok =====
    addSheet(wb, "Produk & Stok", [
      { header: "Nama", key: "nama", width: 24 },
      { header: "SKU", key: "sku" },
      { header: "Kategori", key: "kategori" },
      { header: "Satuan", key: "satuan" },
      { header: "Harga Beli Terakhir", key: "hbeli", type: "money", width: 20 },
      { header: "Harga Jual", key: "hjual", type: "money", width: 18 },
      { header: "Stok", key: "stok", type: "int" },
      { header: "Stok Min", key: "min", type: "int" },
      { header: "Garansi (bln)", key: "gar", type: "int" },
    ], prodStock.map((p: any) => ({
      nama: p.name, sku: p.sku ?? "", kategori: categoryName.get(p.category_id) ?? "",
      satuan: p.unit, hbeli: num(p.last_purchase_price), hjual: num(p.default_selling_price),
      stok: num(p.current_stock), min: num(p.min_stock), gar: num(p.default_warranty_months),
    })));

    // ===== 6. Pergerakan Stok =====
    addSheet(wb, "Pergerakan Stok", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Barang", key: "barang", width: 24 },
      { header: "Jenis", key: "jenis", width: 16 },
      { header: "Qty", key: "qty", type: "int" },
      { header: "Catatan", key: "catatan", width: 30 },
    ], stockMoves.map((m: any) => ({
      tgl: d(m.created_at), barang: productName.get(m.product_id) ?? "-",
      jenis: moveType[m.type] ?? m.type, qty: num(m.qty), catatan: m.note ?? "",
    })));

    // ===== 7. Pembelian =====
    addSheet(wb, "Pembelian", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Distributor", key: "dist", width: 22 },
      { header: "No Nota", key: "nota" },
      { header: "Wallet", key: "wallet", width: 18 },
      { header: "Total", key: "total", type: "money", width: 18 },
      { header: "Catatan", key: "catatan", width: 30 },
    ], purchases.map((p: any) => ({
      tgl: d(p.purchase_date), dist: distributorName.get(p.distributor_id) ?? "-",
      nota: p.invoice_no ?? "", wallet: walletName.get(p.wallet_id) ?? "-",
      total: num(p.total), catatan: p.notes ?? "",
    })));

    // ===== 8. Item Pembelian =====
    addSheet(wb, "Item Pembelian", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Distributor", key: "dist", width: 22 },
      { header: "Barang", key: "barang", width: 24 },
      { header: "Qty", key: "qty", type: "int" },
      { header: "Harga", key: "harga", type: "money", width: 16 },
      { header: "Subtotal", key: "sub", type: "money", width: 18 },
    ], purchaseItems.map((it: any) => {
      const info: any = purchaseInfo.get(it.purchase_id) ?? {};
      return {
        tgl: d(info.date), dist: info.dist ?? "-",
        barang: productName.get(it.product_id) ?? "-", qty: num(it.qty),
        harga: num(it.price), sub: num(it.subtotal),
      };
    }));

    // ===== 9. Penjualan =====
    addSheet(wb, "Penjualan", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Client", key: "client", width: 24 },
      { header: "Metode", key: "metode", width: 16 },
      { header: "Wallet", key: "wallet", width: 18 },
      { header: "Total", key: "total", type: "money", width: 18 },
      { header: "Catatan", key: "catatan", width: 30 },
    ], sales.map((s: any) => ({
      tgl: d(s.sale_date), client: clientName.get(s.client_id) ?? "-",
      metode: payMethod[s.payment_method] ?? s.payment_method,
      wallet: s.wallet_id ? walletName.get(s.wallet_id) ?? "-" : "-",
      total: num(s.total), catatan: s.notes ?? "",
    })));

    // ===== 10. Item Penjualan =====
    addSheet(wb, "Item Penjualan", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Client", key: "client", width: 22 },
      { header: "Barang", key: "barang", width: 24 },
      { header: "Qty", key: "qty", type: "int" },
      { header: "Harga", key: "harga", type: "money", width: 16 },
      { header: "Garansi (bln)", key: "gar", type: "int" },
      { header: "Serial", key: "serial", width: 18 },
      { header: "Subtotal", key: "sub", type: "money", width: 18 },
    ], saleItems.map((it: any) => {
      const info: any = saleInfo.get(it.sale_id) ?? {};
      return {
        tgl: d(info.date), client: info.client ?? "-",
        barang: productName.get(it.product_id) ?? "-", qty: num(it.qty),
        harga: num(it.price), gar: num(it.warranty_months),
        serial: it.serial_number ?? "", sub: num(it.subtotal),
      };
    }));

    // ===== 11. Pengeluaran Operasional =====
    addSheet(wb, "Pengeluaran Operasional", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Kategori", key: "kategori", width: 20 },
      { header: "Wallet", key: "wallet", width: 18 },
      { header: "Jumlah", key: "jumlah", type: "money", width: 18 },
      { header: "Keterangan", key: "ket", width: 32 },
    ], opEx.map((e: any) => ({
      tgl: d(e.expense_date), kategori: categoryName.get(e.category_id) ?? "",
      wallet: walletName.get(e.wallet_id) ?? "-", jumlah: num(e.amount), ket: e.description ?? "",
    })));

    // ===== 12. Pengeluaran Pribadi =====
    addSheet(wb, "Pengeluaran Pribadi", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Kategori", key: "kategori", width: 20 },
      { header: "Wallet", key: "wallet", width: 18 },
      { header: "Jumlah", key: "jumlah", type: "money", width: 18 },
      { header: "Keterangan", key: "ket", width: 32 },
    ], persEx.map((e: any) => ({
      tgl: d(e.expense_date), kategori: categoryName.get(e.category_id) ?? "",
      wallet: walletName.get(e.wallet_id) ?? "-", jumlah: num(e.amount), ket: e.description ?? "",
    })));

    // ===== 13. Asset & Garansi =====
    addSheet(wb, "Asset & Garansi", [
      { header: "Client", key: "client", width: 24 },
      { header: "Barang", key: "barang", width: 24 },
      { header: "Serial", key: "serial", width: 18 },
      { header: "Tgl Beli", key: "beli", type: "date" },
      { header: "Garansi Berakhir", key: "akhir", type: "date" },
      { header: "Status", key: "status" },
      { header: "Sisa Hari", key: "sisa", type: "int" },
      { header: "Catatan", key: "catatan", width: 28 },
    ], assets.map((a: any) => ({
      client: a.company_name ?? clientName.get(a.client_id) ?? "-",
      barang: a.product_name, serial: a.serial_number ?? "",
      beli: d(a.purchase_date), akhir: d(a.warranty_end),
      status: warrStatus[a.warranty_status] ?? a.warranty_status,
      sisa: num(a.days_left), catatan: a.notes ?? "",
    })));

    // ===== 14. Invoice Bulanan =====
    addSheet(wb, "Invoice Bulanan", [
      { header: "No Invoice", key: "no", width: 20 },
      { header: "Client", key: "client", width: 24 },
      { header: "Periode", key: "periode", type: "date" },
      { header: "Status", key: "status" },
      { header: "Total", key: "total", type: "money", width: 18 },
      { header: "Jatuh Tempo", key: "due", type: "date" },
      { header: "Tgl Bayar", key: "bayar", type: "date" },
    ], invoices.map((v: any) => ({
      no: v.invoice_no, client: clientName.get(v.client_id) ?? "-",
      periode: d(v.period_month), status: invStatus[v.status] ?? v.status,
      total: num(v.total), due: d(v.due_date), bayar: d(v.paid_date),
    })));

    // ===== 15. Log Perbaikan =====
    addSheet(wb, "Log Perbaikan", [
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Client", key: "client", width: 22 },
      { header: "Target", key: "target" },
      { header: "Masalah", key: "masalah", width: 30 },
      { header: "Tindakan", key: "tindakan", width: 30 },
      { header: "Biaya", key: "biaya", type: "money", width: 16 },
      { header: "Catatan", key: "catatan", width: 24 },
    ], repairs.map((r: any) => ({
      tgl: d(r.repair_date), client: clientName.get(r.client_id) ?? "-",
      target: repairTarget[r.target] ?? r.target, masalah: r.problem,
      tindakan: r.action_taken ?? "", biaya: num(r.cost), catatan: r.notes ?? "",
    })));

    // ===== 16. Network (TANPA password) =====
    addSheet(wb, "Network", [
      { header: "Client", key: "client", width: 22 },
      { header: "SSID", key: "ssid", width: 20 },
      { header: "Username", key: "user" },
      { header: "Perangkat", key: "device", width: 20 },
      { header: "IP", key: "ip" },
      { header: "Lokasi", key: "lokasi", width: 20 },
      { header: "Catatan", key: "catatan", width: 24 },
    ], network.map((n: any) => ({
      client: clientName.get(n.client_id) ?? "-", ssid: n.ssid,
      user: n.username ?? "", device: n.device_name ?? "", ip: n.ip_address ?? "",
      lokasi: n.location ?? "", catatan: n.notes ?? "",
    })));

    // ===== 17. CCTV (TANPA password) =====
    addSheet(wb, "CCTV", [
      { header: "Client", key: "client", width: 22 },
      { header: "Merk NVR", key: "merk", width: 18 },
      { header: "Channel", key: "ch", type: "int" },
      { header: "Username", key: "user" },
      { header: "IP", key: "ip" },
      { header: "Lokasi", key: "lokasi", width: 20 },
      { header: "Catatan", key: "catatan", width: 24 },
    ], cctv.map((c: any) => ({
      client: clientName.get(c.client_id) ?? "-", merk: c.nvr_brand,
      ch: num(c.channel_count), user: c.username ?? "", ip: c.ip_address ?? "",
      lokasi: c.location ?? "", catatan: c.notes ?? "",
    })));

    // ===== 18. RAB =====
    addSheet(wb, "RAB", [
      { header: "Client", key: "client", width: 22 },
      { header: "Proyek", key: "proyek", width: 24 },
      { header: "Tanggal", key: "tgl", type: "date" },
      { header: "Status", key: "status" },
      { header: "Total RAB", key: "trab", type: "money", width: 18 },
      { header: "Total Pengeluaran", key: "tex", type: "money", width: 18 },
      { header: "Laba", key: "laba", type: "money", width: 18 },
      { header: "Catatan", key: "catatan", width: 24 },
    ], rabSummary.map((r: any) => ({
      client: r.company_name ?? clientName.get(r.client_id) ?? "-", proyek: r.project_name,
      tgl: d(r.project_date), status: rabStatus[r.status] ?? r.status,
      trab: num(r.grand_total_rab), tex: num(r.grand_total_expense),
      laba: num(r.net_profit), catatan: r.notes ?? "",
    })));

    // ===== 19. Item RAB =====
    addSheet(wb, "Item RAB", [
      { header: "Proyek", key: "proyek", width: 24 },
      { header: "Jenis", key: "jenis", width: 14 },
      { header: "Nama", key: "nama", width: 28 },
      { header: "Qty", key: "qty", type: "int" },
      { header: "Harga", key: "harga", type: "money", width: 16 },
      { header: "Total", key: "total", type: "money", width: 18 },
    ], rabItems.map((it: any) => ({
      proyek: rabName.get(it.rab_id) ?? "-", jenis: rabItemType[it.item_type] ?? it.item_type,
      nama: it.item_name, qty: num(it.qty), harga: num(it.price), total: num(it.total),
    })));

    const buffer = await wb.xlsx.writeBuffer();
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="athaya-backup-${today}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}