import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { RabList } from "./rab-list";
import { Plus } from "lucide-react";
import type { RabProject } from "@/types/phase7";

export const metadata = { title: "Rencana Anggaran (RAB)" };

export default async function RabPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("v_rab_summary").select("*").order("project_date", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rencana Anggaran Biaya (RAB)"
        description="Susun anggaran proyek, catat realisasi pengeluaran, dan lihat laba otomatis."
      >
        <Button nativeButton={false} render={<Link href="/rab/new" />}>
          <Plus className="h-4 w-4" /> RAB Baru
        </Button>
      </PageHeader>
      <RabList projects={(projects ?? []) as RabProject[]} />
    </div>
  );
}
