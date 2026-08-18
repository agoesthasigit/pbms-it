"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Wrench, Package, SlidersHorizontal, Clock, FileText } from "lucide-react";
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
import { CurrencyInput } from "@/components/shared/currency-input";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import { type PaymentMethod, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { InlineCreate } from "@/components/shared/inline-create";
import { quickAddClient } from "../clients/actions";
import { createSale } from "./actions";

type Line = {
  kind: "product" | "service";
  product_id: string; qty: string; price: string;
  warranty_months: string; serial_number: string;
  name: string; // nama jasa (bebas) — hanya dipakai saat kind === "service"
  showAdv: boolean; // strip lanjutan (garansi + serial) terbuka?
};
const newLine = (): Line => ({
  kind: "product",
  product_id: "", qty: "1", price: "", warranty_months: "12", serial_number: "", name: "",
  showAdv: false,
});
const newServiceLine = (): Line => ({
  kind: "service",
  product_id: "", qty: "1", price: "", warranty_months: "0", serial_number: "", name: "",
  showAdv: false,
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

  const [extraClients, setExtraClients] = useState<{ value: string; label: string }[]>([]);
  const clientItems = useMemo(
    () => [...clients.map((c) => ({ value: c.id, label: c.company_name })), ...extraClients],
    [clients, extraClients]
  );
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );
  const methodItems = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
    .map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));
  const productItems = useMemo(
    // produk jasa (is_service, mis. "Jasa") disembunyikan dari dropdown barang;
    // barang stok habis (≤0) juga disembunyikan agar dropdown tak kepanjangan —
    // yang muncul hanya barang yang masih bisa dijual. Jasa tetap lewat "Tambah Jasa".
    // Label = NAMA saja (stok ditampilkan terpisah: badge di trigger + teks di dropdown)
    // supaya nama panjang tidak menabrak stok/panah di trigger.
    () => products
      .filter((p) => !p.is_service && Number(p.current_stock) > 0)
      .map((p) => ({ value: p.id, label: p.name })),
    [products]
  );

  // tunai & transfer = uang diterima saat itu juga (butuh wallet)
  const paysNow = method === "cash" || method === "transfer";

  const total = lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.price), 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function addServiceLine() { setLines((prev) => [...prev, newServiceLine()]); }
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
      if (l.kind === "product" && l.product_id && toNumber(l.qty) > stockOf(l.product_id)) {
        const p = products.find((x) => x.id === l.product_id);
        toast.error(`Stok "${p?.name}" tidak cukup (tersedia ${stockOf(l.product_id)}).`);
        return;
      }
      if (l.kind === "service" && toNumber(l.price) > 0 && l.name.trim() === "") {
        toast.error("Nama jasa belum diisi.");
        return;
      }
    }
    startTransition(async () => {
      const res = await createSale({
        client_id: clientId,
        wallet_id: paysNow ? walletId : null,
        sale_date: date,
        payment_method: method,
        notes,
        items: lines.map((l) =>
          l.kind === "service"
            ? {
                is_service: true as const, name: l.name.trim(),
                qty: toNumber(l.qty), price: toNumber(l.price),
              }
            : {
                product_id: l.product_id, qty: toNumber(l.qty), price: toNumber(l.price),
                warranty_months: toNumber(l.warranty_months),
                serial_number: l.serial_number || undefined,
              }
        ),
        period_month: method === "monthly_invoice" ? period : null,
        due_date: (method === "monthly_invoice" || method === "terhutang") ? dueDate : null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        paysNow
          ? "Penjualan tersimpan & saldo wallet bertambah."
          : method === "monthly_invoice"
            ? "Penjualan piutang tersimpan & otomatis masuk invoice bulanan."
            : "Penjualan terhutang tersimpan. Lunasi lewat tombol Tandai Lunas saat dibayar."
      );
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Penjualan Baru (Barang / Jasa)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Info penjualan */}
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
              <Label>Tanggal Jual</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

          {/* Jatuh tempo untuk penjualan terhutang (piutang non-invoice) */}
          {method === "terhutang" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <div className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 space-y-2.5">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Jadi <b>piutang (terhutang)</b>, belum menambah saldo wallet.
                    Tandai lunas saat client membayar.
                  </p>
                  <div className="space-y-1.5 sm:max-w-56">
                    <Label className="text-xs text-amber-800 dark:text-amber-300">Jatuh Tempo (opsional)</Label>
                    <Input type="date" value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Periode & jatuh tempo hanya untuk invoice bulanan */}
          {method === "monthly_invoice" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <div className="flex gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 space-y-2.5">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Jadi <b>piutang</b> & otomatis masuk invoice bulanan. Penjualan dengan
                    <b> client + periode + jatuh tempo yang sama</b> digabung ke satu invoice.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-amber-800 dark:text-amber-300">Periode (bulan tagihan) *</Label>
                      <Input type="month" value={period}
                        onChange={(e) => onChangePeriod(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-amber-800 dark:text-amber-300">Jatuh Tempo *</Label>
                      <Input type="date" value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Baris item — tabel padat: barang (stok/garansi) & jasa (tanpa modal/stok) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daftar Barang &amp; Jasa</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Package className="h-3.5 w-3.5" /> Tambah Barang
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addServiceLine}>
                  <Wrench className="h-3.5 w-3.5" /> Tambah Jasa
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {/* Header kolom (sm ke atas) */}
              <div className="hidden grid-cols-12 gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:grid">
                <span className="col-span-5">Barang / jasa</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Harga</span>
                <span className="col-span-2 text-right">Subtotal</span>
                <span className="col-span-1" />
              </div>

              <div className="divide-y">
                {lines.map((l, i) => {
                  const sub = toNumber(l.qty) * toNumber(l.price);

                  // ---- Baris JASA: nama bebas + qty + harga, tanpa stok/garansi ----
                  if (l.kind === "service") {
                    return (
                      <div key={i} className="bg-sky-50/60 px-3 py-2.5 dark:bg-sky-500/10">
                        <div className="grid grid-cols-12 items-center gap-2">
                          <div className="col-span-12 sm:col-span-5">
                            <div className="flex items-center gap-1.5">
                              <Wrench className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                              <Input className="min-w-0 flex-1"
                                placeholder="Nama jasa (mis. Install ulang laptop)"
                                value={l.name}
                                onChange={(e) => setLine(i, { name: e.target.value })} />
                            </div>
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <Input type="number" min={1} placeholder="Qty"
                              className="text-center" value={l.qty}
                              onChange={(e) => setLine(i, { qty: e.target.value })} />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <CurrencyInput placeholder="Harga"
                              className="text-right" value={l.price}
                              onValueChange={(v) => setLine(i, { price: v })} />
                          </div>
                          <div className="col-span-3 truncate text-right text-xs font-medium sm:col-span-2">
                            {sub > 0 ? formatIDR(sub) : "—"}
                          </div>
                          <div className="col-span-2 flex items-center justify-end sm:col-span-1">
                            <Button type="button" variant="ghost" size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Hapus baris"
                              onClick={() => removeLine(i)} disabled={lines.length === 1}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ---- Baris BARANG: produk + stok + garansi + serial ----
                  const over = l.product_id && toNumber(l.qty) > stockOf(l.product_id);
                  return (
                    <div key={i} className="px-3 py-2.5">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-12 sm:col-span-5">
                          <div className="flex items-center gap-1.5">
                            <Select items={productItems} value={l.product_id || null}
                              onValueChange={(v) => onPickProduct(i, v ?? "")}>
                              <SelectTrigger className="w-full min-w-0 flex-1"
                                title={products.find((p) => p.id === l.product_id)?.name || undefined}>
                                <SelectValue placeholder="Pilih barang" />
                              </SelectTrigger>
                              <SelectContent>
                                {productItems.map((it) => (
                                  <SelectItem key={it.value} value={it.value}>
                                    {it.label}
                                    <span className="text-xs text-muted-foreground">· stok {stockOf(it.value)}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {l.product_id && (
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${over ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"}`}>
                                stok {stockOf(l.product_id)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <Input type="number" min={1} placeholder="Qty"
                            className={`text-center ${over ? "border-destructive" : ""}`}
                            value={l.qty}
                            onChange={(e) => setLine(i, { qty: e.target.value })} />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <CurrencyInput placeholder="Harga"
                            className="text-right" value={l.price}
                            onValueChange={(v) => setLine(i, { price: v })} />
                        </div>
                        <div className="col-span-3 truncate text-right text-xs font-medium sm:col-span-2">
                          {sub > 0 ? formatIDR(sub) : "—"}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-0.5 sm:col-span-1">
                          <Button type="button" variant="ghost" size="icon-sm"
                            className={l.showAdv ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                            aria-label="Atur garansi & serial"
                            onClick={() => setLine(i, { showAdv: !l.showAdv })}>
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Hapus baris"
                            onClick={() => removeLine(i)} disabled={lines.length === 1}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {over && (
                        <p className="mt-1 text-xs text-destructive">
                          Stok tidak cukup (tersedia {stockOf(l.product_id)}).
                        </p>
                      )}

                      {/* Opsi lanjutan (garansi & serial) */}
                      {l.showAdv && (
                        <div className="mt-2.5 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Garansi (bulan)</Label>
                            <Input type="number" min={0} placeholder="12"
                              value={l.warranty_months}
                              onChange={(e) => setLine(i, { warranty_months: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Serial number (opsional)</Label>
                            <Input placeholder="Serial number"
                              value={l.serial_number}
                              onChange={(e) => setLine(i, { serial_number: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3" /> Ikon ini membuka garansi &amp; serial (barang) — baris jasa tak perlu keduanya.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Catatan <span className="text-muted-foreground">(opsional)</span></Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer menempel: total + aksi */}
        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between gap-3 border-t bg-muted px-5 py-3.5 sm:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total Penjualan</div>
            <div className="text-lg font-bold">{formatIDR(total)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !clientId || total <= 0 || (paysNow && !walletId)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Penjualan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
