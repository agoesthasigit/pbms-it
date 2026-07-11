"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import type { WalletWithBalance, Category, Label as LabelType } from "@/types/db";
import type { ExpenseRow } from "@/types/phase3";
import { createExpense, deleteExpense } from "./expense-actions";

type Kind = "operational" | "personal";

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

  const totalThisList = expenses.reduce((s, e) => s + Number(e.amount), 0);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="sm:min-w-64">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total (tampil di daftar)</p>
            <p className="mt-1 text-2xl font-bold">{formatIDR(totalThisList)}</p>
          </CardContent>
        </Card>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah Pengeluaran
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState icon={WalletIcon} title="Belum ada pengeluaran"
              description="Catat pengeluaran Anda. Saldo wallet berkurang otomatis." />
          ) : (
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
                {expenses.map((e) => (
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
