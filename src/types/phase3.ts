// Tipe tambahan Phase 3 — gabungkan ke src/types/db.ts atau import terpisah.
export type PaymentMethod = "cash" | "monthly_invoice";

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
  client?: { company_name: string } | null;
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
  monthly_invoice: "Invoice Bulanan",
};
