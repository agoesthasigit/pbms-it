"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Wallet as WalletIcon, Receipt, Boxes, Search, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SummaryCard } from "@/components/shared/summary-card";
import { StatCard } from "@/components/shared/stat-card";
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
import { toNumber } from "@/lib/utils/number";
import { EmptyState } from "@/components/shared/empty-state";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import type { WalletWithBalance, Category, Label as LabelType } from "@/types/db";
import type { ExpenseRow } from "@/types/phase3";
import { createExpense, deleteExpense } from "./expense-actions";

type Kind = "operational" | "personal";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function monthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function lastMonthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) };
}

export function ExpenseManager({
  kind, expenses, wallets, categories, labels,
}: {
  kind: Kind;
  expenses: ExpenseRow[];
  wallets: WalletWithBalance[];
  categories: Category[];
  labels: LabelType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [labelId, setLabelId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );
  const categoryItems = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const labelItems = useMemo(
    () => labels.map((l) => ({ value: l.id, label: l.name })),
    [labels]
  );

  // Ringkasan bulan berjalan — dihitung dari data yang sudah dimuat, tanpa query baru.
  const { totalMonth, countMonth, avgMonth, compareTotal, percent } = useMemo(() => {
    const mr = monthRange();
    const lm = lastMonthRange();
    const inRange = (a: string, b: string) =>
      expenses.filter((e) => e.expense_date >= a && e.expense_date <= b);
    const thisMonth = inRange(mr.from, mr.to);
    const total = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
    const count = thisMonth.length;
    const lastM = inRange(lm.from, lm.to).reduce((s, e) => s + Number(e.amount), 0);
    const pct = lastM > 0 ? ((total - lastM) / lastM) * 100 : (total > 0 ? 100 : null);
    return {
      totalMonth: total,
      countMonth: count,
      avgMonth: count > 0 ? total / count : 0,
      compareTotal: lastM,
      percent: pct,
    };
  }, [expenses]);

  // Filter daftar: rentang tanggal (default bulan berjalan) + kata kunci.
  const def = monthRange();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  const filtered = useMemo(() => {
    const key = q.toLowerCase();
    return expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      if (key) {
        const hay = [
          e.description ?? "", e.category?.name ?? "",
          e.label?.name ?? "", e.wallet?.name ?? "",
        ].join(" ").toLowerCase();
        if (!hay.includes(key)) return false;
      }
      return true;
    });
  }, [expenses, q, from, to]);

  const pg = usePagination(filtered, 10, `${kind}|${q}|${from}|${to}`);

  function resetFilter() { setFrom(def.from); setTo(def.to); setQ(""); }

  function reset() {
    setWalletId(""); setCategoryId(""); setLabelId("");
    setDate(todayISO()); setAmount(""); setDescription("");
  }

  function handleSave() {
    startTransition(async () => {
      const res = await createExpense(kind, {
        wallet_id: walletId,
        category_id: categoryId || null,
        label_id: labelId || null,
        expense_date: date,
        amount: toNumber(amount),
        description,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pengeluaran tersimpan & saldo wallet dikurangi.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(e: ExpenseRow) {
    if (!confirm("Hapus pengeluaran ini? Saldo wallet akan dikembalikan.")) return;
    startTransition(async () => {
      const res = await deleteExpense(kind, e.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pengeluaran dihapus & saldo dikembalikan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan bulan berjalan */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title="Total Pengeluaran Bulan Ini"
          value={totalMonth}
          icon={WalletIcon}
          compareLabel="Dari bulan lalu"
          compareValue={compareTotal}
          percent={percent}
          invertColor
        />
        <StatCard
          label="Jumlah Pengeluaran"
          value={String(countMonth)}
          icon={Receipt}
          hint={countMonth > 0 ? "transaksi bulan ini" : "Belum ada transaksi bulan ini"}
        />
        <StatCard
          label="Rata-rata Pengeluaran"
          value={formatIDR(avgMonth)}
          icon={Boxes}
          hint={countMonth > 0 ? "Total dibagi jumlah transaksi" : "Belum ada transaksi"}
        />
      </div>

      {/* Toolbar: cari + rentang tanggal */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Keterangan / kategori / label / wallet..."
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFilter} title="Kembali ke bulan ini">
            <RotateCcw className="h-4 w-4" /> Bulan Ini
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah Pengeluaran
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={WalletIcon}
              title={expenses.length === 0 ? "Belum ada pengeluaran" : "Tidak ada hasil"}
              description={expenses.length === 0
                ? "Catat pengeluaran Anda. Saldo wallet berkurang otomatis."
                : "Tidak ada pengeluaran pada rentang tanggal / kata kunci ini. Ubah filter atau klik Bulan Ini."} />
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.expense_date)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.category?.name ?? "-"}</Badge>
                    </TableCell>
                    <TableCell className="max-w-52 truncate">
                      {e.description ?? "-"}
                    </TableCell>
                    <TableCell>
                      {e.label ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <span className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: e.label.color }} />
                          {e.label.name}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{e.wallet?.name ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatIDR(Number(e.amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(e)} disabled={pending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="pengeluaran" />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Tambah Pengeluaran {kind === "operational" ? "Operasional" : "Pribadi"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nominal (Rp) *</Label>
                <Input type="number" min={0} value={amount}
                  onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Wallet Pembayar *</Label>
              <Select items={walletItems} value={walletId || null}
                onValueChange={(v) => setWalletId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih wallet" /></SelectTrigger>
                <SelectContent>
                  {walletItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select items={categoryItems} value={categoryId || null}
                  onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label (opsional)</Label>
                <Select items={labelItems} value={labelId || null}
                  onValueChange={(v) => setLabelId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih label" /></SelectTrigger>
                  <SelectContent>
                    {labelItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={description}
                onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !walletId || toNumber(amount) <= 0}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
