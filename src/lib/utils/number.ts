// Parse input angka yang mungkin berisi titik/koma ribuan.
export const toNumber = (v: string | number): number => {
  if (typeof v === "number") return v;
  const clean = v.replace(/[^\d.-]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};
