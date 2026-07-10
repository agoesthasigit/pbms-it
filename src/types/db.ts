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
