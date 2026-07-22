import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils/date";
import {
  MOVEMENT_TYPE_LABELS, type MovementType, type StockMovement,
} from "@/types/db";

export const metadata = { title: "Riwayat Stok" };

export default async function ProductHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("v_product_stock")
    .select("*")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("product_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`Riwayat pergerakan stok · Stok saat ini: ${product.current_stock} ${product.unit}`}
      >
        <Button variant="outline" nativeButton={false}
          render={<Link href="/products" />}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {!movements || movements.length === 0 ? (
            <EmptyState icon={History} title="Belum ada pergerakan stok"
              description="Pergerakan akan tercatat otomatis saat ada pembelian, penjualan, atau penyesuaian." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-center">Jumlah</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements as StockMovement[]).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {MOVEMENT_TYPE_LABELS[m.type as MovementType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={m.qty >= 0
                        ? "font-medium text-success-strong"
                        : "font-medium text-destructive"}>
                        {m.qty >= 0 ? `+${m.qty}` : m.qty}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.note ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
