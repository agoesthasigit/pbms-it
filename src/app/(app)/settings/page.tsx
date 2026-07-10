import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryManager } from "./category-manager";
import { LabelManager } from "./label-manager";
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
        description="Kelola kategori dan label yang dipakai di seluruh aplikasi."
      />

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Kategori</TabsTrigger>
          <TabsTrigger value="labels">Label</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoryManager data={(categories ?? []) as Category[]} />
        </TabsContent>
        <TabsContent value="labels">
          <LabelManager data={(labels ?? []) as Label[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
