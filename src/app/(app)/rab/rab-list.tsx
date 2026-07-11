"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Eye, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import {
  type RabProject, type RabStatus, RAB_STATUS_LABELS, RAB_STATUS_STYLE,
} from "@/types/phase7";
import { deleteRab } from "./actions";

export function RabList({ projects }: { projects: RabProject[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return projects;
    const key = q.toLowerCase();
    return projects.filter((p) =>
      `${p.project_name} ${p.company_name ?? ""}`.toLowerCase().includes(key));
  }, [projects, q]);

  function handleDelete(p: RabProject) {
    if (!confirm(`Hapus RAB "${p.project_name}"? Semua item ikut terhapus.`)) return;
    startTransition(async () => {
      const res = await deleteRab(p.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("RAB dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama proyek atau client..."
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Calculator} title="Belum ada RAB"
              description="Buat rencana anggaran biaya proyek pertama Anda." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyek</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total RAB</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Laba</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const profit = Number(p.net_profit ?? 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.project_name}</TableCell>
                      <TableCell>{p.company_name ?? "-"}</TableCell>
                      <TableCell>{formatDate(p.project_date)}</TableCell>
                      <TableCell>
                        <Badge className={RAB_STATUS_STYLE[p.status as RabStatus]}>
                          {RAB_STATUS_LABELS[p.status as RabStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIDR(Number(p.grand_total_rab ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIDR(Number(p.grand_total_expense ?? 0))}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatIDR(profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" nativeButton={false}
                          render={<Link href={`/rab/${p.id}`} />}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(p)} disabled={pending}>
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
