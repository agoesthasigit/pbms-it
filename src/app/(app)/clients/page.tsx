import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClientManager } from "./client-manager";
import type { Client, Category } from "@/types/db";

export const metadata = { title: "Client" };

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: categories }] = await Promise.all([
    supabase.from("clients").select("*").order("company_name"),
    supabase.from("categories").select("*")
      .eq("type", "client").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Client"
        description="Kelola semua client Anda: villa, kantor, hotel, sekolah, toko, dan lainnya."
      />
      <ClientManager
        clients={(clients ?? []) as Client[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
