import { redirect } from "next/navigation";
// Menu Pengeluaran Operasional & Pribadi kini digabung di satu halaman /expenses.
// Route lama dipertahankan sebagai redirect agar bookmark/tautan lama tetap jalan.
export default function Page() {
  redirect("/expenses");
}
