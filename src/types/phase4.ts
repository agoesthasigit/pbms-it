export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export type MonthlyInvoice = {
  id: string;
  client_id: string;
  invoice_no: string;
  period_month: string;
  status: InvoiceStatus;
  total: number;
  due_date: string | null;
  paid_date: string | null;
  paid_wallet_id: string | null;
  notes: string | null;
  created_at: string;
  // dari view v_monthly_invoices:
  company_name?: string;
  contact_name?: string | null;
  client_address?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  effective_status?: InvoiceStatus;
};

export type InvoiceSaleLine = {
  id: string;
  sale_date: string;
  total: number;
  notes: string | null;
  items: {
    product_id: string;
    qty: number;
    price: number;
    subtotal: number;
    product_name?: string;
  }[];
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Terkirim",
  paid: "Lunas",
  overdue: "Jatuh Tempo",
};

// Data identitas usaha untuk kop invoice (edit sesuai usaha Anda)
export const BUSINESS_IDENTITY = {
  name: "PBMS-IT",
  tagline: "IT Solution & Network Service",
  address: "Jl Mahendradata Gg Puputan Baru II No 19b Denpasar, Bali",
  phone: "083-1199-56442",
  email: "athaya.it@gmail.com",
};
