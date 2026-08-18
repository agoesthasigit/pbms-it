"use client";

// Transaksi Cepat — "Beli & Jual Sekaligus" (audit 3.1).
// Satu dialog untuk pola reseller: beli barang dari distributor lalu langsung
// jual ke client. Di belakang layar memanggil RPC create_quick_deal yang
// menjalankan create_purchase + create_sale dalam SATU transaksi atomik.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, SlidersHorizontal, Plus, ShoppingCart, ReceiptText, Clock, FileText } from "lucide-react";
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
import { CurrencyInput } from "@/components/shared/currency-input";
import { formatIDR } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import type { ProductWithStock, Client, Distributor, WalletWithBalance } from "@/types/db";
import { type PaymentMethod, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { InlineCreate } from "@/components/shared/inline-create";
import { quickAddClient } from "../clients/actions";
import { quickAddDistributor } from "../distributors/actions";
import { createQuickDeal } from "./actions";

type Line = {
  name: string; qty: string; buyPrice: string; sellPrice: string;
  warranty: string; showAdv: boolean;
};
const newLine = (): Line => ({
  name: "", qty: "1", buyPrice: "", sellPrice: "", warranty: "12", showAdv: false,
});

function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0);
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuickDealForm({
  open, onOpenChange, products, distributors, wallets, clients,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductWithStock[];
  distributors: Distributor[];
  wallets: WalletWithBalance[];
  clients: Client[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Pembelian
  const [distributorId, setDistributorId] = useState("");
  const [buyWalletId, setBuyWalletId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [invoiceNo, setInvoiceNo] = useState("");
  // Penjualan
  const [clientId, setClientId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [saleWalletId, setSaleWalletId] = useState("");
  const [period, setPeriod] = useState(thisMonth);
  const [dueDate, setDueDate] = useState(endOfMonth(thisMonth));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const [extraDistributors, setExtraDistributors] = useState<{ value: string; label: string }[]>([]);
  const [extraClients, setExtraClients] = useState<{ value: string; label: string }[]>([]);
  const distributorItems = useMemo(
    () => [...distributors.map((d) => ({ value: d.id, label: d.name })), ...extraDistributors],
    [distributors, extraDistributors]);
  const clientItems = useMemo(
    () => [...clients.map((c) => ({ value: c.id, label: c.company_name })), ...extraClients],
    [clients, extraClients]);
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })), [wallets]);
  const methodItems = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
    .map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));
  const existingNames = useMemo(() => products.map((p) => p.name), [products]);

  const paysNow = method === "cash" || method === "transfer";
  const totalBuy = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.buyPrice), 0);
  const totalSell = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.sellPrice), 0);
  const margin = totalSell - totalBuy;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }
  function onChangePeriod(ym: string) { setPeriod(ym); setDueDate(endOfMonth(ym)); }

  function reset() {
    setDistributorId(""); setBuyWalletId(""); setDate(todayISO()); setInvoiceNo("");
    setClientId(""); setMethod("cash"); setSaleWalletId("");
    setPeriod(thisMonth); setDueDate(endOfMonth(thisMonth));
    setNotes(""); setLines([newLine()]);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await createQuickDeal({
        distributor_id: distributorId || null,
        buy_wallet_id: buyWalletId,
        deal_date: date,
        invoice_no: invoiceNo,
        client_id: clientId,
        sale_method: method,
        sale_wallet_id: paysNow ? saleWalletId : null,
        notes,
        items: lines.map((l) => ({
          name: l.name.trim(),
          qty: toNumber(l.qty),
          buy_price: toNumber(l.buyPrice),
          sell_price: toNumber(l.sellPrice),
          warranty_months: l.warranty ? toNumber(l.warranty) : undefined,
        })),
        period_month: method === "monthly_invoice" ? period : null,
        due_date: (method === "monthly_invoice" || method === "terhutang") ? dueDate : null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Transaksi cepat tersimpan: barang dibeli & langsung terjual.");
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Beli &amp; Jual Sekaligus</DialogTitle>
        </DialogHeader>

        <datalist id="qd-product-suggestions">
          {existingNames.map((n) => <option key={n} value={n} />)}
        </datalist>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* ===== Pembelian ===== */}
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5" /> Pembelian
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Distributor</Label>
                <div className="flex gap-2">
                  <Select items={distributorItems} value={distributorId || null}
                    onValueChange={(v) => setDistributorId(v ?? "")}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih distributor" /></SelectTrigger>
                    <SelectContent>
                      {distributorItems.map((it) => (
                        <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InlineCreate title="Distributor Baru" fieldLabel="Nama distributor"
                    placeholder="mis. Bhinneka" onCreate={quickAddDistributor}
                    onCreated={(it) => { setExtraDistributors((p) => [...p, it]); setDistributorId(it.value); }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Wallet Pembayar *</Label>
                <Select items={walletItems} value={buyWalletId || null}
                  onValueChange={(v) => setBuyWalletId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih wallet" /></SelectTrigger>
                  <SelectContent>
                    {walletItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>No. Nota <span className="text-muted-foreground">(opsional)</span></Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ===== Barang (beli & jual) ===== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Barang</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Tambah Barang
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="hidden grid-cols-12 gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:grid">
                <span className="col-span-4">Nama barang</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Harga beli</span>
                <span className="col-span-3 text-right">Harga jual</span>
                <span className="col-span-1" />
              </div>
              <div className="divide-y">
                {lines.map((l, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-12 sm:col-span-4">
                        <Input list="qd-product-suggestions" className="min-w-0"
                          placeholder="Nama barang (mis. Printer Epson L3250)"
                          value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Input type="number" min={1} placeholder="Qty" className="text-center"
                          value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <CurrencyInput placeholder="Beli" className="text-right"
                          value={l.buyPrice} onValueChange={(v) => setLine(i, { buyPrice: v })} />
                      </div>
                      <div className="col-span-4 sm:col-span-3">
                        <CurrencyInput placeholder="Jual" className="text-right"
                          value={l.sellPrice} onValueChange={(v) => setLine(i, { sellPrice: v })} />
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm"
                          className={l.showAdv ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                          aria-label="Atur garansi" onClick={() => setLine(i, { showAdv: !l.showAdv })}>
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Hapus baris" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* margin per baris + garansi */}
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Margin: <span className={toNumber(l.sellPrice) - toNumber(l.buyPrice) >= 0
                          ? "font-medium text-emerald-600" : "font-medium text-destructive"}>
                          {formatIDR((toNumber(l.sellPrice) - toNumber(l.buyPrice)) * toNumber(l.qty))}
                        </span>
                      </span>
                    </div>
                    {l.showAdv && (
                      <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Garansi (bulan)</Label>
                          <Input type="number" min={0} placeholder="12"
                            value={l.warranty} onChange={(e) => setLine(i, { warranty: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Qty yang dibeli langsung terjual semua (stok bersih 0). Harga jual otomatis jadi harga jual default barang.
            </p>
          </div>

          {/* ===== Penjualan ===== */}
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ReceiptText className="h-3.5 w-3.5" /> Penjualan
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <div className="flex gap-2">
                  <Select items={clientItems} value={clientId || null}
                    onValueChange={(v) => setClientId(v ?? "")}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih client" /></SelectTrigger>
                    <SelectContent>
                      {clientItems.map((it) => (
                        <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InlineCreate title="Client Baru" fieldLabel="Nama perusahaan"
                    placeholder="mis. Rob Peetoom Canggu" onCreate={quickAddClient}
                    onCreated={(it) => { setExtraClients((p) => [...p, it]); setClientId(it.value); }} />
                </div>
              </div>
              <div className="space-y-1.5">
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
              {paysNow && (
                <div className="space-y-1.5">
                  <Label>Wallet Penerima *</Label>
                  <Select items={walletItems} value={saleWalletId || null}
                    onValueChange={(v) => setSaleWalletId(v ?? "")}>
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

            {method === "terhutang" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                <div className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 space-y-2.5">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Jadi <b>piutang (terhutang)</b>, belum menambah saldo wallet.
                    </p>
                    <div className="space-y-1.5 sm:max-w-56">
                      <Label className="text-xs text-amber-800 dark:text-amber-300">Jatuh Tempo (opsional)</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {method === "monthly_invoice" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                <div className="flex gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 space-y-2.5">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Jadi <b>piutang</b> & otomatis masuk invoice bulanan.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-amber-800 dark:text-amber-300">Periode *</Label>
                        <Input type="month" value={period}
                          onChange={(e) => onChangePeriod(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-amber-800 dark:text-amber-300">Jatuh Tempo *</Label>
                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Catatan <span className="text-muted-foreground">(opsional)</span></Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer: modal / jual / margin + aksi */}
        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between gap-3 border-t bg-muted px-5 py-3.5 sm:justify-between">
          <div className="flex gap-4 text-xs">
            <div>
              <div className="text-muted-foreground">Modal</div>
              <div className="font-semibold">{formatIDR(totalBuy)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Jual</div>
              <div className="font-semibold">{formatIDR(totalSell)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Margin</div>
              <div className={`font-bold ${margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {formatIDR(margin)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !buyWalletId || !clientId || totalSell <= 0 || (paysNow && !saleWalletId)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Transaksi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
