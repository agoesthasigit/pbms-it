// Tipe tambahan Phase 3 — gabungkan ke src/types/db.ts atau import terpisah.
export type PaymentMethod = "cash" | "transfer" | "monthly_invoice" | "terhutang";

export type PurchaseRow = {
  id: string;
  distributor_id: string | null;
  wallet_id: string;
  purchase_date: string;
  invoice_no: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  distributor?: { name: string } | null;
  wallet?: { name: string } | null;
};

export type SaleRow = {
  id: string;
  client_id: string;
  wallet_id: string | null;
  sale_date: string;
  payment_method: PaymentMethod;
  total: number;
  monthly_invoice_id: string | null;
  notes: string | null;
  created_at: string;
  due_date?: string | null;
  paid_date?: string | null;
  paid_wallet_id?: string | null;
  nota_no?: string | null;
  email_sent_at?: string | null;
  email_sent_to?: string | null;
  client?: { company_name: string; email?: string | null } | null;
  wallet?: { name: string } | null;
};

export type ExpenseRow = {
  id: string;
  wallet_id: string;
  category_id: string | null;
  label_id: string | null;
  expense_date: string;
  amount: number;
  description: string | null;
  created_at: string;
  wallet?: { name: string } | null;
  category?: { name: string } | null;
  label?: { name: string; color: string } | null;
};

export type LineItem = {
  product_id: string;
  qty: string;
  price: string;
  warranty_months?: string;
  serial_number?: string;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  monthly_invoice: "Invoice Bulanan",
  terhutang: "Terhutang",
};
