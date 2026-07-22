// Tipe untuk fitur Kontrak Maintenance Bulanan.

export type MaintenanceContract = {
  id: string;
  client_id: string;
  service_name: string;
  monthly_amount: number;
  start_date: string;
  due_day: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  company_name?: string; // dari view v_maintenance_contracts
};

// Baris pada halaman penerbitan tagihan
export type ChargeRow = {
  contract_id: string;
  company_name: string;
  service_name: string;
  monthly_amount: number;
  issued_sale_id: string | null; // terisi bila periode itu sudah ditagih
  issued_amount: number | null;
  invoice_no: string | null;
};

export const DEFAULT_DUE_DAY = 10;
