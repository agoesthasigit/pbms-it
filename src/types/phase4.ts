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
  email_sent_at?: string | null;
  email_sent_to?: string | null;
  // PPh 23 atas jasa — diisi saat pelunasan (invoice tetap ditagih bruto)
  pph_base?: number;    // dasar kena pajak = nilai jasa saja
  pph_rate?: number;    // tarif persen, default 2,5
  pph_amount?: number;  // yang dipotong client
  brand?: Brand; // 'athaya' | 'cetak_ide' — penerbit invoice
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

// Brand penerbit invoice/nota. Entitas & rekening sama; beda hanya kop & tema warna.
export type Brand = "athaya" | "cetak_ide";

export const BRAND_LABELS: Record<Brand, string> = {
  athaya: "Athaya Computer",
  cetak_ide: "Cetak Ide",
};

// Nama tone (kunci SOFT_TONES) untuk badge brand — Athaya teal, Cetak Ide oranye.
export const BRAND_TONE: Record<Brand, "teal" | "amber"> = {
  athaya: "teal",
  cetak_ide: "amber",
};

/** Normalisasi nilai brand mentah (dari DB) ke Brand yang valid. */
export function toBrand(v?: string | null): Brand {
  return v === "cetak_ide" ? "cetak_ide" : "athaya";
}

// Data identitas usaha untuk kop invoice/nota, per brand.
// Rekening bank, alamat, kontak SAMA (satu entitas) — yang berbeda hanya
// nama, tagline, dan tema warna (teal untuk Athaya, oranye untuk Cetak Ide).
export const BUSINESS_IDENTITIES = {
  athaya: {
    name: "ATHAYA COMPUTER",
    tagline: "IT - Solution & Network Service",
    address: "Jl Mahendradata Gg Puputan Baru II No 19b Denpasar - Bali",
    phone: "083119956442",
    email: "athaya.it@gmail.com",
    website: "www.athayacomputer.com",
    bankName: "BCA",
    bankAccount: "6110823876",
    bankHolder: "Agusta Sigit Dewantoro",
    theme: "#0f766e", // teal
  },
  cetak_ide: {
    name: "CETAK IDE",
    tagline: "Creative Advertising - Design - Printing",
    address: "Jl Mahendradata Gg Puputan Baru II No 19b Denpasar - Bali",
    phone: "083119956442",
    email: "athaya.it@gmail.com",
    website: "www.athayacomputer.com",
    bankName: "BCA",
    bankAccount: "6110823876",
    bankHolder: "Agusta Sigit Dewantoro",
    theme: "#F8AB01", // oranye
  },
} as const;

/** Ambil identitas usaha untuk brand tertentu (default Athaya bila tak dikenal). */
export function businessIdentity(brand?: string | null) {
  return brand === "cetak_ide" ? BUSINESS_IDENTITIES.cetak_ide : BUSINESS_IDENTITIES.athaya;
}

// Kompatibilitas mundur: default Athaya (dipakai export/report/tanda tangan email).
export const BUSINESS_IDENTITY = BUSINESS_IDENTITIES.athaya;

export type BusinessIdentity = typeof BUSINESS_IDENTITY;