"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import { type PaymentMethod, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { createSale } from "./actions";

type Line = {
  product_id: string; qty: string; price: string;
  warranty_months: string; serial_number: string;
};
const newLine = (): Line => ({
  product_id: "", qty: "1", price: "", warranty_months: "12", serial_number: "",
});

// akhir bulan dari string "YYYY-MM" → "YYYY-MM-DD"
function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0); // hari ke-0 bulan berikutnya = akhir bulan ini
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SaleForm({
  open, onOpenChange, products, clients, wallets,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductWithStock[];
  clients: Client[];
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [clientId, setClientId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [period, setPeriod] = useState(thisMonth);
  const [dueDate, setDueDate] = useState(endOfMonth(thisMonth));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const clientItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );
  const methodItems = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
    .map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));
  const productItems = useMemo(
    () => products.map((p) => ({
      value: p.id, label: `${p.name} (stok ${p.current_stock})`,
    })),
    [products]
  );

  const total = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.price), 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function onPickProduct(i: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLine(i, {
      product_id: productId,
      price: p && Number(p.default_selling_price) > 0 ? String(p.default_selling_price) : "",
      warranty_months: p ? String(p.default_warranty_months) : "12",
    });
  }
  function stockOf(productId: string) {
    return products.find((p) => p.id === productId)?.current_stock ?? 0;
  }
  // saat ganti periode, jatuh tempo default ikut ke akhir bulan periode
  function onChangePeriod(ym: string) {
    setPeriod(ym);
    setDueDate(endOfMonth(ym));
  }

  function reset() {
    setClientId(""); setWalletId(""); setDate(todayISO());
    setMethod("cash"); setPeriod(thisMonth); setDueDate(endOfMonth(thisMonth));
    setNotes(""); setLines([newLine()]);
  }

  function handleSave() {
    for (const l of lines) {
      if (l.product_id && toNumber(l.qty) > stockOf(l.product_id)) {
        const p = products.find((x) => x.id === l.product_id);
        toast.error(`Stok "${p?.name}" tidak cukup (tersedia ${stockOf(l.product_id)}).`);
        return;
      }
    }
    startTransition(async () => {
      const res = await createSale({
        client_id: clientId,
        wallet_id: method === "cash" ? walletId : null,
        sale_date: date,
        payment_method: method,
        notes,
        items: lines.map((l) => ({
          product_id: l.product_id, qty: toNumber(l.qty), price: toNumber(l.price),
          warranty_months: toNumber(l.warranty_months),
          serial_number: l.serial_number || undefined,
        })),
        period_month: method === "monthly_invoice" ? period : null,
        due_date: method === "monthly_invoice" ? dueDate : null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        method === "cash"
          ? "Penjualan tersimpan. Stok turun, asset dibuat, wallet bertambah."
          : "Penjualan piutang tersimpan & otomatis masuk invoice bulanan."
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Penjualan Barang Baru</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label>Tanggal Jual</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Metode Bayar *</Label>
              <Select items={methodItems} value={method}
                onValueChange={(v) => setMethod((v ?? "cash") as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {methodItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {method === "cash" && (
              <div className="space-y-2">
                <Label>Wallet Penerima *</Label>
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
            )}
          </div>

          {/* Periode & jatuh tempo hanya untuk invoice bulanan */}
          {method === "monthly_invoice" && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                Penjualan ini menjadi <b>piutang</b> & otomatis masuk invoice bulanan.
                Penjualan dengan <b>client + periode + jatuh tempo yang sama</b> akan
                digabung ke satu invoice.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Periode (bulan tagihan) *</Label>
                  <Input type="month" value={period}
                    onChange={(e) => onChangePeriod(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Jatuh Tempo *</Label>
                  <Input type="date" value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Baris item */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daftar Barang</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Tambah Baris
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => {
                const sub = toNumber(l.qty) * toNumber(l.price);
                const over = l.product_id && toNumber(l.qty) > stockOf(l.product_id);
                return (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-5">
                        <Select items={productItems} value={l.product_id || null}
                          onValueChange={(v) => onPickProduct(i, v ?? "")}>
                          <SelectTrigger><SelectValue placeholder="Pilih barang" /></SelectTrigger>
                          <SelectContent>
                            {productItems.map((it) => (
                              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Input type="number" min={1} placeholder="Qty" value={l.qty}
                          className={over ? "border-destructive" : ""}
                          onChange={(e) => setLine(i, { qty: e.target.value })} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input type="number" min={0} placeholder="Harga jual" value={l.price}
                          onChange={(e) => setLine(i, { price: e.target.value })} />
                      </div>
                      <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                        <Button type="button" variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(i)} disabled={lines.length === 1}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-6 sm:col-span-3">
                        <Input type="number" min={0} placeholder="Garansi (bln)"
                          value={l.warranty_months}
                          onChange={(e) => setLine(i, { warranty_months: e.target.value })} />
                      </div>
                      <div className="col-span-6 sm:col-span-5">
                        <Input placeholder="Serial number (opsional)"
                          value={l.serial_number}
                          onChange={(e) => setLine(i, { serial_number: e.target.value })} />
                      </div>
                      <div className="col-span-12 sm:col-span-4 flex items-center justify-end text-sm">
                        {over ? <span className="text-destructive">Stok tidak cukup</span>
                          : sub > 0 ? <span className="text-muted-foreground">Subtotal: <b>{formatIDR(sub)}</b></span>
                          : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
            <span className="font-medium">Total Penjualan</span>
            <span className="text-lg font-bold">{formatIDR(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave}
            disabled={pending || !clientId || total <= 0 || (method === "cash" && !walletId)}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Penjualan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
