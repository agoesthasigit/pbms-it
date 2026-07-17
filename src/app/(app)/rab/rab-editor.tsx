"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Save, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import type { Client, WalletWithBalance } from "@/types/db";
import {
  type RabProject, type RabItem, type RabPayment, type RabStatus,
  type RabItemType, RAB_STATUS_LABELS,
} from "@/types/phase7";
import { saveRab } from "./actions";

// ============ TIPE BARIS ============
type BudgetRow = { item_name: string; qty: string; price: string };
type ExpenseRow = BudgetRow & { paid_date: string; paid_wallet_id: string };
type PaymentRow = {
  payment_date: string; description: string; amount: string; wallet_id: string;
};

const newBudget = (): BudgetRow => ({ item_name: "", qty: "1", price: "" });
const newExpense = (): ExpenseRow => ({
  item_name: "", qty: "1", price: "", paid_date: todayISO(), paid_wallet_id: "",
});
const newPayment = (): PaymentRow => ({
  payment_date: todayISO(), description: "", amount: "", wallet_id: "",
});

const sumRows = (rows: BudgetRow[]) =>
  rows.reduce((s, r) => s + toNumber(r.qty) * toNumber(r.price), 0);
const sumPayments = (rows: PaymentRow[]) =>
  rows.reduce((s, r) => s + toNumber(r.amount), 0);

type WalletItem = { value: string; label: string };

// ============ TABEL 1: PENAWARAN (module-level, jangan dipindah ke dalam) ============
function BudgetTable({
  rows, onChange,
}: {
  rows: BudgetRow[];
  onChange: (rows: BudgetRow[]) => void;
}) {
  const total = sumRows(rows);
  const update = (i: number, patch: Partial<BudgetRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rows, newBudget()]);
  const remove = (i: number) =>
    onChange(rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">1. Detail RAB (Penawaran)</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah Item
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
          <div className="col-span-5">Nama Barang</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Harga</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1"></div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-12 sm:col-span-5">
              <Input placeholder="Nama barang" value={r.item_name}
                onChange={(e) => update(i, { item_name: e.target.value })} />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input type="number" min={0} placeholder="Qty" value={r.qty}
                className="text-center"
                onChange={(e) => update(i, { qty: e.target.value })} />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Input type="number" min={0} placeholder="Harga" value={r.price}
                className="text-right"
                onChange={(e) => update(i, { price: e.target.value })} />
            </div>
            <div className="col-span-3 sm:col-span-2 text-right text-sm font-medium">
              {formatIDR(toNumber(r.qty) * toNumber(r.price))}
            </div>
            <div className="col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)} disabled={rows.length === 1}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-sky-50 px-4 py-2.5 text-sky-800">
          <span className="font-medium">Grand Total RAB (Nilai Proyek)</span>
          <span className="text-lg font-bold">{formatIDR(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TABEL 2: PENGELUARAN (+ wallet & tanggal) ============
function ExpenseTable({
  rows, onChange, walletItems,
}: {
  rows: ExpenseRow[];
  onChange: (rows: ExpenseRow[]) => void;
  walletItems: WalletItem[];
}) {
  const total = sumRows(rows);
  const update = (i: number, patch: Partial<ExpenseRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => onChange([...rows, newExpense()]);
  const remove = (i: number) =>
    onChange(rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">2. Detail Pengeluaran (Realisasi)</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah Item
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pilih wallet bila uang benar-benar sudah keluar — saldo wallet otomatis berkurang
          sesuai tanggal. Kosongkan wallet bila baru rencana/belum dibayar.
        </p>
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 sm:col-span-5">
                <Input placeholder="Nama barang / jasa" value={r.item_name}
                  onChange={(e) => update(i, { item_name: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="number" min={0} placeholder="Qty" value={r.qty}
                  className="text-center"
                  onChange={(e) => update(i, { qty: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="number" min={0} placeholder="Harga" value={r.price}
                  className="text-right"
                  onChange={(e) => update(i, { price: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right text-sm font-medium">
                {formatIDR(toNumber(r.qty) * toNumber(r.price))}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(i)} disabled={rows.length === 1}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 sm:col-span-5">
                <Select items={walletItems} value={r.paid_wallet_id || null}
                  onValueChange={(v) => update(i, { paid_wallet_id: v ?? "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bayar dari wallet (opsional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {walletItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-8 sm:col-span-4">
                <Input type="date" value={r.paid_date}
                  onChange={(e) => update(i, { paid_date: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-3 text-right text-xs">
                {r.paid_wallet_id ? (
                  <span className="font-medium text-emerald-600">✓ Keluar dari wallet</span>
                ) : (
                  <span className="text-muted-foreground">Belum dibayar</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5 text-amber-800">
          <span className="font-medium">Grand Total Pengeluaran</span>
          <span className="text-lg font-bold">{formatIDR(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TABEL 3: TERMIN PEMBAYARAN ============
function PaymentTable({
  rows, onChange, walletItems, projectValue,
}: {
  rows: PaymentRow[];
  onChange: (rows: PaymentRow[]) => void;
  walletItems: WalletItem[];
  projectValue: number;
}) {
  const total = sumPayments(rows);
  const remaining = projectValue - total;
  const update = (i: number, patch: Partial<PaymentRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () =>
    onChange([...rows, { ...newPayment(), description: `Termin ${rows.length + 1}` }]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">3. Termin Pembayaran</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah Termin
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Setiap termin yang disimpan langsung masuk ke wallet sesuai tanggalnya.
          Catat semua pembayaran client di sini (deposit, cicilan, pelunasan).
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Belum ada termin. Klik &quot;Tambah Termin&quot; saat client membayar.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <div className="col-span-3">Tanggal</div>
              <div className="col-span-3">Keterangan</div>
              <div className="col-span-3">Wallet Penerima</div>
              <div className="col-span-2 text-right">Nominal</div>
              <div className="col-span-1"></div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-6 sm:col-span-3">
                  <Input type="date" value={r.payment_date}
                    onChange={(e) => update(i, { payment_date: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input placeholder="mis. Deposit 1 (50%)" value={r.description}
                    onChange={(e) => update(i, { description: e.target.value })} />
                </div>
                <div className="col-span-8 sm:col-span-3">
                  <Select items={walletItems} value={r.wallet_id || null}
                    onValueChange={(v) => update(i, { wallet_id: v ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="Pilih wallet *" /></SelectTrigger>
                    <SelectContent>
                      {walletItems.map((it) => (
                        <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Input type="number" min={0} placeholder="Nominal" value={r.amount}
                    className="text-right"
                    onChange={(e) => update(i, { amount: e.target.value })} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5 text-emerald-800">
          <span className="font-medium">Total Diterima</span>
          <span className="text-lg font-bold">{formatIDR(total)}</span>
        </div>
        {remaining > 0 && projectValue > 0 && (
          <p className="text-right text-xs text-amber-700">
            Sisa tagihan: <b>{formatIDR(remaining)}</b>
          </p>
        )}
        {remaining < 0 && (
          <p className="text-right text-xs text-destructive">
            Kelebihan bayar {formatIDR(Math.abs(remaining))} — cek kembali nominal termin.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============ EDITOR UTAMA ============
export function RabEditor({
  clients, wallets, existing, existingItems, existingPayments,
}: {
  clients: Client[];
  wallets: WalletWithBalance[];
  existing?: RabProject | null;
  existingItems?: RabItem[];
  existingPayments?: RabPayment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState(existing?.client_id ?? "");
  const [projectName, setProjectName] = useState(existing?.project_name ?? "");
  const [projectDate, setProjectDate] = useState(existing?.project_date ?? todayISO());
  const [status, setStatus] = useState<RabStatus>(existing?.status ?? "draft");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const initBudget = (existingItems ?? [])
    .filter((i) => i.item_type === "budget")
    .map((i) => ({ item_name: i.item_name, qty: String(i.qty), price: String(i.price) }));
  const initExpense = (existingItems ?? [])
    .filter((i) => i.item_type === "expense")
    .map((i) => ({
      item_name: i.item_name, qty: String(i.qty), price: String(i.price),
      paid_date: i.paid_date ?? todayISO(),
      paid_wallet_id: i.paid_wallet_id ?? "",
    }));
  const initPayments = (existingPayments ?? []).map((p) => ({
    payment_date: p.payment_date, description: p.description,
    amount: String(p.amount), wallet_id: p.wallet_id,
  }));

  const [budget, setBudget] = useState<BudgetRow[]>(
    initBudget.length ? initBudget : [newBudget()]
  );
  const [expense, setExpense] = useState<ExpenseRow[]>(
    initExpense.length ? initExpense : [newExpense()]
  );
  const [payments, setPayments] = useState<PaymentRow[]>(initPayments);

  const clientItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );
  const statusItems = (Object.keys(RAB_STATUS_LABELS) as RabStatus[])
    .map((s) => ({ value: s, label: RAB_STATUS_LABELS[s] }));

  const grandRab = sumRows(budget);
  const grandExpense = sumRows(expense);
  const netProfit = grandRab - grandExpense;
  const totalPaid = sumPayments(payments);
  const remaining = grandRab - totalPaid;

  function handleSave() {
    startTransition(async () => {
      const items = [
        ...budget.map((r, idx) => ({
          item_type: "budget" as RabItemType, item_name: r.item_name,
          qty: toNumber(r.qty), price: toNumber(r.price), sort_order: idx,
          paid_date: null, paid_wallet_id: null,
        })),
        ...expense.map((r, idx) => ({
          item_type: "expense" as RabItemType, item_name: r.item_name,
          qty: toNumber(r.qty), price: toNumber(r.price), sort_order: idx,
          paid_date: r.paid_wallet_id ? r.paid_date : null,
          paid_wallet_id: r.paid_wallet_id || null,
        })),
      ];
      const pays = payments.map((p, idx) => ({
        payment_date: p.payment_date,
        description: p.description || `Termin ${idx + 1}`,
        amount: toNumber(p.amount),
        wallet_id: p.wallet_id,
        sort_order: idx,
      }));

      const res = await saveRab({
        id: existing?.id ?? null,
        client_id: clientId, project_name: projectName,
        project_date: projectDate, status, notes,
        items, payments: pays,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("RAB tersimpan. Termin & pengeluaran tercatat di wallet.");
      router.push(res.rabId ? `/rab/${res.rabId}` : "/rab");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Info proyek */}
      <Card>
        <CardHeader><CardTitle className="text-base">Informasi Proyek</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select items={clientItems} value={clientId || null}
              onValueChange={(v) => setClientId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
              <SelectContent>
                {clientItems.map((it) => (
                  <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nama Proyek *</Label>
            <Input value={projectName} placeholder="mis. Pemasangan CCTV Villa Sunset"
              onChange={(e) => setProjectName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Input type="date" value={projectDate}
              onChange={(e) => setProjectDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status Pekerjaan</Label>
            <Select items={statusItems} value={status}
              onValueChange={(v) => setStatus((v ?? "draft") as RabStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusItems.map((it) => (
                  <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set &quot;Selesai&quot; saat pekerjaan kelar.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Catatan</Label>
            <Textarea rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <BudgetTable rows={budget} onChange={setBudget} />
      <ExpenseTable rows={expense} onChange={setExpense} walletItems={walletItems} />
      <PaymentTable rows={payments} onChange={setPayments}
        walletItems={walletItems} projectValue={grandRab} />

      {/* 3 kartu ringkasan */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-teal-600/40">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">LABA PROYEK</p>
            <p className={`mt-1 text-2xl font-bold ${
              netProfit >= 0 ? "text-teal-700" : "text-destructive"}`}>
              {formatIDR(netProfit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Nilai − Pengeluaran</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-600/40">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">TOTAL DITERIMA</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatIDR(totalPaid)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Jumlah semua termin</p>
          </CardContent>
        </Card>
        <Card className="border-amber-600/40">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">SISA TAGIHAN</p>
            <p className={`mt-1 text-2xl font-bold ${
              remaining <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {formatIDR(Math.max(remaining, 0))}
            </p>
            <p className="mt-1 text-xs">
              {remaining <= 0 && grandRab > 0
                ? <span className="font-semibold text-emerald-600">LUNAS ✓</span>
                : <span className="text-muted-foreground">Nilai − Diterima</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WalletIcon className="h-3.5 w-3.5" />
          Termin & pengeluaran berwallet otomatis tercatat di wallet.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>Batal</Button>
          <Button onClick={handleSave}
            disabled={pending || !clientId || !projectName.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan RAB
          </Button>
        </div>
      </div>
    </div>
  );
}
