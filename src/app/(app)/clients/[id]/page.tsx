import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Client360 } from "./client-360";
import type { Client } from "@/types/db";

export const metadata = { title: "Client 360" };

export default async function Client360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", id).single();
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={client.company_name}
        description={client.contact_name ? `PIC: ${client.contact_name}` : "Ringkasan 360° client"}>
        <Button variant="outline" nativeButton={false} render={<Link href="/clients" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>
      <Client360 client={client as Client} />
    </div>
  );
}
