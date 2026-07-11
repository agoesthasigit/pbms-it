// ---------- Kategori & Label ----------
export type CategoryType =
  | "client"
  | "product"
  | "operational_expense"
  | "personal_expense"
  | "income_source";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  client: "Kategori Client",
  product: "Kategori Produk",
  operational_expense: "Pengeluaran Operasional",
  personal_expense: "Pengeluaran Pribadi",
  income_source: "Sumber Pemasukan",
};

// ---------- Wallet ----------
export type WalletType = "cash" | "bank" | "ewallet";

export type Wallet = {
  id: string;
  name: string;
  type: WalletType;
  initial_balance: number;
  is_active: boolean;
  created_at: string;
};

export type WalletWithBalance = Wallet & { balance: number };

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: "Tunai",
  bank: "Bank",
  ewallet: "E-Wallet",
};

// ---------- Client ----------
export type ClientStatus = "active" | "inactive";

export type Client = {
  id: string;
  company_name: string;
  contact_name: string | null;
  category_id: string | null;
  email: string | null;
  address: string | null;
  phone: string | null;
  status: ClientStatus;
  joined_date: string | null;
  notes: string | null;
  created_at: string;
};

// ---------- Distributor ----------
export type Distributor = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

// ---------- Produk & Stok ----------
export type Product = {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  unit: string;
  last_purchase_price: number;
  default_selling_price: number;
  min_stock: number;
  default_warranty_months: number;
  is_active: boolean;
  created_at: string;
};

export type ProductWithStock = Product & { current_stock: number };

export type MovementType = "purchase_in" | "sale_out" | "adjustment";

export type StockMovement = {
  id: string;
  product_id: string;
  type: MovementType;
  qty: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase_in: "Pembelian",
  sale_out: "Penjualan",
  adjustment: "Penyesuaian",
};
