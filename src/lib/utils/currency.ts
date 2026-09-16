export const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

// Versi ringkas untuk ruang sempit (hero/pill mobile): "Rp 21,4jt", "Rp 950rb".
// Angka utuh tetap pakai formatIDR. Menjaga tanda minus.
export const formatIDRShort = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const oneDp = (x: number) =>
    x.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${sign}Rp ${oneDp(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${oneDp(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}Rp ${oneDp(abs / 1_000)}rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
};