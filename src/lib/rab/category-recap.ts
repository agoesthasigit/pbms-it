// Rekap pengeluaran RAB per kategori — dipakai bersama layar (rab-editor)
// dan PDF (rab-pdf) agar angka & urutannya identik.

export const RAB_UNCATEGORIZED = "Lain-lain";

export type RabExpenseLine = {
  category_id: string | null;
  amount: number;
};

export type RabCategoryRecapRow = {
  /** id kategori, atau "" untuk yang belum berkategori */
  key: string;
  name: string;
  total: number;
  /** persentase terhadap total pengeluaran (0..100) */
  pct: number;
};

/**
 * Kelompokkan pengeluaran per kategori, urut dari TERBESAR ke terkecil.
 * Baris tanpa kategori (category_id null / tak dikenal) digabung ke "Lain-lain".
 */
export function rabCategoryRecap(
  lines: RabExpenseLine[],
  categoryNames: Record<string, string>
): RabCategoryRecapRow[] {
  const totals = new Map<string, number>();
  for (const l of lines) {
    const amount = Number(l.amount) || 0;
    if (amount === 0) continue;
    const known = l.category_id && categoryNames[l.category_id];
    const key = known ? (l.category_id as string) : "";
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  const grand = [...totals.values()].reduce((s, v) => s + v, 0);

  return [...totals.entries()]
    .map(([key, total]) => ({
      key,
      name: key ? categoryNames[key] : RAB_UNCATEGORIZED,
      total,
      pct: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
