"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Wallet, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate, todayISO } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { payPurchases } from "../purchases/actions";

export type HutangPurchase = {
  id: string; distributor_name: string; purchase_date: string;
  due_date: string | null; total: number; invoice_no: string | null;
};

function daysOverdue(due: string | null): number | null {
  if (!due) return null;
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86_400_000);
}

export function HutangClient({
  hutangs, walletItems,
}: { hutangs: HutangPurchase[]; walletItems: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState(false);
  const [payWallet, setPayWallet] = useState("");
  const [payDate, setPayDate] = useState(todayISO());

  // Kelompokkan per distributor (untuk "pilih semua distributor").
  const groups = useMemo(() => {
    const m = new Map<string, HutangPurchase[]>();
    for (const h of hutangs) {
      const arr = m.get(h.distributor_name) ?? [];
      arr.push(h);
      m.set(h.distributor_name, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [hutangs]);

  const total = hutangs.reduce((s, h) => s + Number(h.total), 0);
  const selectedTotal = hutangs
    .filter((h) => selected.has(h.id))
    .reduce((s, h) => s + Number(h.total), 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleGroup(rows: HutangPurchase[], on: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const r of rows) { if (on) n.add(r.id); else n.delete(r.id); }
      return n;
    });
  }

  function pay() {
    startTransition(async () => {
      const res = await payPurchases({
        ids: [...selected], wallet_id: payWallet, paid_date: payDate,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Hutang terbayar. Saldo wallet berkurang.");
      setSelected(new Set());
      setPayOpen(false);
      router.refresh();
    });
  }

  if (hutangs.length === 0) {
    return (
      <EmptyState icon={CheckCircle2} title="Tidak ada hutang"
        description="Semua pembelian sudah lunas." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total Hutang" icon={HandCoins} tone="orange" accent="text-amber-600"
          value={formatIDR(total)} hint={`${hutangs.length} nota belum dibayar`} />
        <StatCard label="Dipilih" icon={Wallet} tone="sky"
          value={formatIDR(selectedTotal)} hint={`${selected.size} nota dipilih`} />
      </div>

      <div className="flex justify-end">
        <Button disabled={selected.size === 0} onClick={() => setPayOpen(true)}>
          <Wallet className="h-4 w-4" /> Bayar Terpilih ({selected.size})
        </Button>
      </div>

      {groups.map(([dist, rows]) => {
        const allOn = rows.every((r) => selected.has(r.id));
        const subtotal = rows.reduce((s, r) => s + Number(r.total), 0);
        return (
          <Card key={dist}>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-4 py-2.5">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4 accent-primary"
                    checked={allOn} onChange={(e) => toggleGroup(rows, e.target.checked)} />
                  {dist}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {rows.length} nota
                  </span>
                </label>
                <span className="text-sm font-semibold">{formatIDR(subtotal)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Nota / Tanggal</TableHead>
                    <TableHead>Jatuh Tempo</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const od = daysOverdue(r.due_date);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <input type="checkbox" className="h-4 w-4 accent-primary"
                            checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{r.invoice_no || "Tanpa nota"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.purchase_date)}</p>
                        </TableCell>
                        <TableCell>
                          {r.due_date ? (
                            <div>
                              <p className="text-sm">{formatDate(r.due_date)}</p>
                              {od !== null && od > 0 ? (
                                <span className="text-xs font-medium text-destructive">Lewat {od} hari</span>
                              ) : od !== null ? (
                                <span className="text-xs text-muted-foreground">
                                  {od === 0 ? "Jatuh tempo hari ini" : `${-od} hari lagi`}
                                </span>
                              ) : null}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatIDR(r.total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog bayar */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Bayar Hutang</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Melunasi <b>{selected.size}</b> nota · total{" "}
              <b className="text-foreground">{formatIDR(selectedTotal)}</b>.
            </p>
            <div className="space-y-1.5">
              <Label>Wallet Pembayar *</Label>
              <Select items={walletItems} value={payWallet || null}
                onValueChange={(v) => setPayWallet(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih wallet" /></SelectTrigger>
                <SelectContent>
                  {walletItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Bayar</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Batal</Button>
            <Button onClick={pay} disabled={pending || !payWallet}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Bayar {formatIDR(selectedTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
