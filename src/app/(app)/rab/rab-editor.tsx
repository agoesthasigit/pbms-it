"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Save } from "lucide-react";
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
import type { Client } from "@/types/db";
import {
  type RabProject, type RabItem, type RabStatus, type RabItemType,
  RAB_STATUS_LABELS,
} from "@/types/phase7";
import { saveRab } from "./actions";

type Row = { item_name: string; qty: string; price: string };
const newRow = (): Row => ({ item_name: "", qty: "1", price: "" });

const sumRows = (rows: Row[]) =>
  rows.reduce((s, r) => s + toNumber(r.qty) * toNumber(r.price), 0);

// ---- ItemTable DIDEFINISIKAN DI LUAR RabEditor (tidak remount saat mengetik) ----
function ItemTable({
  title, rows, onChange, accent,
}: {
  title: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  accent: string;
}) {
  const total = sumRows(rows);

  function updateRow(i: number, patch: Partial<Row>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { onChange([...rows, newRow()]); }
  function removeRow(i: number) {
    onChange(rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
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
        {rows.map((r, i) => {
          const sub = toNumber(r.qty) * toNumber(r.price);
          return (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-12 sm:col-span-5">
                <Input placeholder="Nama barang" value={r.item_name}
                  onChange={(e) => updateRow(i, { item_name: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="number" min={0} placeholder="Qty" value={r.qty}
                  className="text-center"
                  onChange={(e) => updateRow(i, { qty: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input type="number" min={0} placeholder="Harga" value={r.price}
                  className="text-right"
                  onChange={(e) => updateRow(i, { price: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right text-sm font-medium">
                {formatIDR(sub)}
              </div>
              <div className="col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${accent}`}>
          <span className="font-medium">Grand Total</span>
          <span className="text-lg font-bold">{formatIDR(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function RabEditor({
  clients, existing, existingItems,
}: {
  clients: Client[];
  existing?: RabProject | null;
  existingItems?: RabItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState(existing?.client_id ?? "");
  const [projectName, setProjectName] = useState(existing?.project_name ?? "");
  const [projectDate, setProjectDate] = useState(existing?.project_date ?? todayISO());
  const [status, setStatus] = useState<RabStatus>(existing?.status ?? "draft");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const initBudget = (existingItems ?? []).filter((i) => i.item_type === "budget")
    .map((i) => ({ item_name: i.item_name, qty: String(i.qty), price: String(i.price) }));
  const initExpense = (existingItems ?? []).filter((i) => i.item_type === "expense")
    .map((i) => ({ item_name: i.item_name, qty: String(i.qty), price: String(i.price) }));

  const [budget, setBudget] = useState<Row[]>(initBudget.length ? initBudget : [newRow()]);
  const [expense, setExpense] = useState<Row[]>(initExpense.length ? initExpense : [newRow()]);

  const clientItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );
  const statusItems = (Object.keys(RAB_STATUS_LABELS) as RabStatus[])
    .map((s) => ({ value: s, label: RAB_STATUS_LABELS[s] }));

  const grandRab = sumRows(budget);
  const grandExpense = sumRows(expense);
  const netProfit = grandRab - grandExpense;

  function handleSave() {
    startTransition(async () => {
      const items = [
        ...budget.map((r, idx) => ({
          item_type: "budget" as RabItemType, item_name: r.item_name,
          qty: toNumber(r.qty), price: toNumber(r.price), sort_order: idx,
        })),
        ...expense.map((r, idx) => ({
          item_type: "expense" as RabItemType, item_name: r.item_name,
          qty: toNumber(r.qty), price: toNumber(r.price), sort_order: idx,
        })),
      ];
      const res = await saveRab({
        id: existing?.id ?? null,
        client_id: clientId, project_name: projectName,
        project_date: projectDate, status, notes, items,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("RAB tersimpan.");
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
            <Input value={projectName} placeholder="mis. Instalasi CCTV Villa Sunset"
              onChange={(e) => setProjectName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Input type="date" value={projectDate}
              onChange={(e) => setProjectDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select items={statusItems} value={status}
              onValueChange={(v) => setStatus((v ?? "draft") as RabStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusItems.map((it) => (
                  <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Catatan</Label>
            <Textarea rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <ItemTable title="Detail RAB (Penawaran)" rows={budget} onChange={setBudget}
        accent="bg-sky-50 text-sky-800" />

      <ItemTable title="Detail Pengeluaran (Realisasi)" rows={expense} onChange={setExpense}
        accent="bg-amber-50 text-amber-800" />

      {/* Laba bersih */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Laba Bersih = Grand Total RAB − Grand Total Pengeluaran
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatIDR(grandRab)} − {formatIDR(grandExpense)}
              </p>
            </div>
            <p className={`text-3xl font-bold ${
              netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatIDR(netProfit)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Batal</Button>
        <Button onClick={handleSave}
          disabled={pending || !clientId || !projectName.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan RAB
        </Button>
      </div>
    </div>
  );
}
