import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RabEditor } from "../rab-editor";
import type { Client } from "@/types/db";

export const metadata = { title: "RAB Baru" };

export default async function NewRabPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients").select("*").eq("status", "active").order("company_name");

  return (
    <div className="space-y-6">
      <PageHeader title="RAB Baru" description="Susun rencana anggaran biaya proyek.">
        <Button variant="outline" nativeButton={false} render={<Link href="/rab" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>
      <RabEditor clients={(clients ?? []) as Client[]} />
    </div>
  );
}
