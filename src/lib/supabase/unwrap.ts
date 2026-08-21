// ============================================================
//  Bantu memunculkan error query Supabase, bukan menelannya.
//
//  Latar: bug 2026-08-22 — query `purchases` gagal (embed wallets ambigu)
//  tapi kode memakai `data ?? []` sehingga error TERSEMBUNYI dan daftar
//  tampak kosong tanpa peringatan apa pun. `unwrap` membuat kegagalan
//  LANTANG: melempar Error (ditangkap error boundary Next + ter-log),
//  jadi query yang rusak langsung kelihatan, bukan tampil "data kosong".
//
//  Pakai:
//    const res = await supabase.from("x").select("...");
//    const rows = unwrap(res, "x");   // rows: T (bukan T | null)
// ============================================================

export function unwrap<T>(
  res: { data: T | null; error: { message: string } | null },
  label: string,
): T {
  if (res.error) {
    throw new Error(`Query "${label}" gagal: ${res.error.message}`);
  }
  // data hanya null bila error; di sini error null → kembalikan (fallback array
  // kosong bila memang null tanpa error, agar pemanggil tetap aman).
  return (res.data ?? ([] as unknown as T));
}
