// ============================================================
// Tipe laporan keuangan (Laba Rugi & Analisa Margin).
// Dipakai bersama oleh halaman, route export Excel, dan route export PDF
// supaya angka di layar dan di file unduhan selalu identik.
// ============================================================

export type Period = { from: string; to: string };

export type PlLine = { name: string; amount: number };

/** Proyek RAB yang BELUM selesai — labanya tidak boleh diakui. */
export type OngoingProject = {
  id: string;
  project_name: string;
  company_name: string;
  status: string;
  received: number;   // Σ termin diterima dari client
  spent: number;      // Σ biaya proyek yang sudah keluar
  remaining: number;  // sisa uang muka = kewajiban ke client
};

export type InventoryLine = {
  name: string;
  qty: number;
  unit: string;
  value: number;
};

export type ProfitLoss = {
  period: Period;

  // A. Pendapatan usaha (barang, jasa, dan proyek yang SUDAH selesai)
  revenue: PlLine[];
  revenue_total: number;

  // B. Harga pokok penjualan
  cogs: PlLine[];
  cogs_total: number;

  gross_profit: number;
  gross_margin: number; // fraksi 0..1

  // C. Biaya operasional (termasuk pengeluaran pribadi & PPh 23)
  opex: PlLine[];
  personal_total: number;
  pph_total: number;
  opex_total: number;   // opex + pribadi + pph

  net_profit: number;

  // D. Proyek berjalan — belum diakui sebagai laba
  ongoing: OngoingProject[];
  ongoing_received: number;
  ongoing_spent: number;
  ongoing_remaining: number;

  // E. Persediaan — aset, belum jadi biaya
  inventory: InventoryLine[];
  inventory_total: number;
};

/** Satu baris di Riwayat Transaksi. */
export type TxRow = {
  key: string;
  source: "sale" | "purchase" | "op" | "personal"
    | "invoice" | "rab_payment" | "rab_expense";
  direction: "in" | "out";
  date: string;
  party: string;
  walletId: string | null;
  walletName: string;
  categoryId: string | null;
  labelId: string | null;
  labelName?: string | null;
  labelColor?: string | null;
  description: string;
  amount: number;
  isPiutang: boolean;
  /**
   * false = baris ini TIDAK ikut dijumlahkan di kartu ringkasan.
   * Dipakai untuk penjualan metode Invoice Bulanan: uangnya baru benar-benar
   * masuk lewat baris "Pelunasan invoice", jadi kalau keduanya dihitung
   * nilainya jadi dobel. Barisnya tetap tampil supaya rinciannya terlihat.
   */
  countInTotal?: boolean;
};

export const TX_SOURCE_LABEL: Record<TxRow["source"], string> = {
  sale: "Penjualan", purchase: "Pembelian", op: "Operasional", personal: "Pribadi",
  invoice: "Invoice", rab_payment: "Termin Proyek", rab_expense: "Biaya Proyek",
};

/** Satu baris analisa margin (item penjualan atau proyek selesai). */
export type MarginRow = {
  group: string;      // client / nama proyek
  item: string;
  qty: number;
  cost: number;       // modal total (bukan per unit)
  revenue: number;    // harga jual total
  margin: number;     // revenue - cost
  margin_pct: number; // fraksi 0..1
  kind: "sale" | "project";
};

export type MarginReport = {
  period: Period;
  rows: MarginRow[];
  total_cost: number;
  total_revenue: number;
  total_margin: number;
  total_margin_pct: number;
};
