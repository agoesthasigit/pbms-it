import { createClient } from "@/lib/supabase/server";

/**
 * Konteks akun portal distributor untuk uid yang sedang login.
 *
 * Memanggil RPC `portal_my_context()` (SECURITY DEFINER) yang mengembalikan baris
 * hanya bila uid pemanggil terdaftar & aktif di `distributor_accounts`. Untuk uid
 * pemilik (admin) hasilnya kosong → null. Dipakai layout untuk memisahkan peran:
 * distributor diarahkan ke `/portal`, pemilik ke app biasa.
 */
export type PortalContext = {
  distributorId: string;
  distributorName: string;
  ownerUserId: string;
};

export async function getPortalContext(): Promise<PortalContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_context");
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as {
    distributor_id: string;
    distributor_name: string;
    owner_user_id: string;
  };
  return {
    distributorId: row.distributor_id,
    distributorName: row.distributor_name,
    ownerUserId: row.owner_user_id,
  };
}
