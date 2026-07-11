export type FinanceSummary = {
  total_income: number;
  total_op_expense: number;
  total_personal_expense: number;
  total_purchase: number;
  net_profit: number;
};

export type MonthlyTrend = {
  month_start: string;
  income: number;
  op_expense: number;
  net_profit: number;
};

export type IncomeBreakdown = { source: string; total: number };
export type OpExpenseBreakdown = { category: string; total: number };

export type DashboardCounts = {
  active_clients: number;
  pending_invoices: number;
  expiring_warranty: number;
  total_receivable: number;
};
