export type WarrantyStatus = "active" | "expiring" | "expired";
export type RepairTarget = "asset" | "network" | "cctv";

export type ClientAsset = {
  id: string;
  client_id: string;
  sale_item_id: string | null;
  product_name: string;
  serial_number: string | null;
  purchase_date: string;
  warranty_end: string;
  notes: string | null;
  created_at: string;
  // dari view v_client_assets:
  company_name?: string;
  warranty_status?: WarrantyStatus;
  days_left?: number;
};

export type RepairLog = {
  id: string;
  target: RepairTarget;
  target_id: string;
  client_id: string;
  repair_date: string;
  problem: string;
  action_taken: string | null;
  cost: number;
  notes: string | null;
  created_at: string;
};

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  active: "Garansi Aktif",
  expiring: "Akan Habis",
  expired: "Garansi Habis",
};

export const WARRANTY_STATUS_STYLE: Record<WarrantyStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  expiring: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  expired: "bg-red-100 text-red-700 hover:bg-red-100",
};
