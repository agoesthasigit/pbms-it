export type RabStatus = "draft" | "ongoing" | "done";
export type RabItemType = "budget" | "expense";

export type RabProject = {
  id: string;
  client_id: string;
  project_name: string;
  project_date: string;
  status: RabStatus;
  notes: string | null;
  created_at: string;
  // dari view v_rab_summary:
  company_name?: string;
  grand_total_rab?: number;
  grand_total_expense?: number;
  net_profit?: number;
  total_paid?: number;   // Σ termin
  remaining?: number;    // nilai proyek − Σ termin
};

export type RabItem = {
  id: string;
  rab_id: string;
  item_type: RabItemType;
  item_name: string;
  qty: number;
  price: number;
  total: number;
  sort_order: number;
  paid_date: string | null;        // hanya untuk item_type 'expense'
  paid_wallet_id: string | null;   // hanya untuk item_type 'expense'
};

export type RabPayment = {
  id: string;
  rab_id: string;
  payment_date: string;
  description: string;
  amount: number;
  wallet_id: string;
  sort_order: number;
};

export const RAB_STATUS_LABELS: Record<RabStatus, string> = {
  draft: "Draft",
  ongoing: "Berjalan",
  done: "Selesai",
};

export const RAB_STATUS_STYLE: Record<RabStatus, string> = {
  draft: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  ongoing: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  done: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};
