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
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
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

  const pg = usePagination(filtered, 10, q);

  function handleDelete(p: RabProject) {
    if (!confirm(
      `Hapus RAB "${p.project_name}"?\n\nSemua item, termin, dan efeknya di wallet akan ikut dibatalkan.`
    )) return;
    startTransition(async () => {
      const res = await deleteRab(p.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("RAB dihapus & efek wallet dibatalkan.");
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
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyek</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead className="text-right">Diterima</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead className="text-right">Laba</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((p) => {
                  const profit = Number(p.net_profit ?? 0);
                  const value = Number(p.grand_total_rab ?? 0);
                  const paid = Number(p.total_paid ?? 0);
                  const remaining = Number(p.remaining ?? 0);
                  const lunas = value > 0 && remaining <= 0;
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
                      <TableCell className="text-right">{formatIDR(value)}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatIDR(paid)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lunas ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Lunas
                          </Badge>
                        ) : (
                          <span className="font-medium text-amber-600">
                            {formatIDR(Math.max(remaining, 0))}
                          </span>
                        )}
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
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="RAB" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
