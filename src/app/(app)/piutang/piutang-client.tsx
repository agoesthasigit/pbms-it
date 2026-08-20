"use client";

import { useMemo, useState } from "react";
import { FileText, ReceiptText, Wallet, Search, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { SOFT_TONES } from "@/lib/utils/soft-tone";

export type PiutangInvoice = {
  id: string; invoice_no: string; company_name: string;
  total: number; due_date: string | null; period_month: string; effective_status: string;
};
export type PiutangSale = {
  id: string; company_name: string; sale_date: string;
  due_date: string | null; total: number;
};

type Row = {
  id: string; client: string; jenis: "Invoice" | "Terhutang";
  ref: string; tanggal: string; dueDate: string | null; amount: number;
};

/** Selisih hari terhadap jatuh tempo (positif = sudah lewat / terlambat). */
function daysOverdue(due: string | null): number | null {
  if (!due) return null;
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86_400_000);
}

export function PiutangClient({
  invoices, sales,
}: { invoices: PiutangInvoice[]; sales: PiutangSale[] }) {
  const [q, setQ] = useState("");

  const rows: Row[] = useMemo(() => {
    const inv: Row[] = invoices.map((i) => ({
      id: `inv-${i.id}`, client: i.company_name, jenis: "Invoice",
      ref: i.invoice_no, tanggal: i.period_month, dueDate: i.due_date, amount: Number(i.total),
    }));
    const ter: Row[] = sales.map((s) => ({
      id: `sale-${s.id}`, client: s.company_name, jenis: "Terhutang",
      ref: "Penjualan", tanggal: s.sale_date, dueDate: s.due_date, amount: Number(s.total),
    }));
    // Urut dari jatuh tempo paling dekat; yang tanpa jatuh tempo di akhir.
    return [...inv, ...ter].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [invoices, sales]);

  const filtered = rows.filter(
    (r) => r.client.toLowerCase().includes(q.toLowerCase())
      || r.ref.toLowerCase().includes(q.toLowerCase())
  );

  const totalInvoice = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalTerhutang = sales.reduce((s, x) => s + Number(x.total), 0);
  const total = totalInvoice + totalTerhutang;

  if (rows.length === 0) {
    return (
      <EmptyState icon={CheckCircle2} title="Tidak ada piutang"
        description="Semua tagihan sudah lunas." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Piutang" icon={Wallet} tone="amber" accent="text-amber-600"
          value={formatIDR(total)} hint={`${rows.length} tagihan belum diterima`} />
        <StatCard label="Invoice Belum Lunas" icon={FileText} tone="sky"
          value={formatIDR(totalInvoice)} hint={`${invoices.length} invoice`} />
        <StatCard label="Penjualan Terhutang" icon={ReceiptText} tone="orange"
          value={formatIDR(totalTerhutang)} hint={`${sales.length} nota`} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Cari client / nomor…" className="pl-8" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const od = daysOverdue(r.dueDate);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{r.client}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.ref} · {formatDate(r.tanggal)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline"
                        className={r.jenis === "Invoice" ? SOFT_TONES.sky : SOFT_TONES.amber}>
                        {r.jenis}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.dueDate ? (
                        <div>
                          <p className="text-sm">{formatDate(r.dueDate)}</p>
                          {od !== null && od > 0 ? (
                            <span className="text-xs font-medium text-destructive">
                              Lewat {od} hari
                            </span>
                          ) : od !== null ? (
                            <span className="text-xs text-muted-foreground">
                              {od === 0 ? "Jatuh tempo hari ini" : `${-od} hari lagi`}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatIDR(r.amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
