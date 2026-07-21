import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryManager } from "./category-manager";
import { LabelManager } from "./label-manager";
import { ExportAllButton } from "./export-button";
import type { Category, Label } from "@/types/db";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: labels }] = await Promise.all([
    supabase.from("categories").select("*").order("created_at"),
    supabase.from("labels").select("*").order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Kelola kategori, label, dan backup data aplikasi."
      />

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Kategori</TabsTrigger>
          <TabsTrigger value="labels">Label</TabsTrigger>
          <TabsTrigger value="backup">Backup &amp; Data</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoryManager data={(categories ?? []) as Category[]} />
        </TabsContent>
        <TabsContent value="labels">
          <LabelManager data={(labels ?? []) as Label[]} />
        </TabsContent>
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Export Semua Data</CardTitle>
              <CardDescription>
                Unduh seluruh data aplikasi dalam satu file Excel (.xlsx) —
                tiap tabel jadi satu sheet. Berguna sebagai arsip yang mudah
                dibaca. Password WiFi/CCTV tidak ikut diekspor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportAllButton />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
