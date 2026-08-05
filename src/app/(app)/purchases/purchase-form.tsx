"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, SlidersHorizontal } from "lucide-react";
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
import type { ProductWithStock, Distributor, WalletWithBalance } from "@/types/db";
import { createPurchase } from "./actions";

type Line = {
  name: string; qty: string; price: string;
  selling_price: string; warranty_months: string; showAdv: boolean;
};
const newLine = (): Line => ({
  name: "", qty: "1", price: "",
  selling_price: "", warranty_months: "12", showAdv: false,
});

export function PurchaseForm({
  open, onOpenChange, products, distributors, wallets,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: ProductWithStock[];
  distributors: Distributor[];
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [distributorId, setDistributorId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const distributorItems = useMemo(
    () => distributors.map((d) => ({ value: d.id, label: d.name })),
    [distributors]
  );
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );

  // Nama produk yang sudah ada, untuk saran autocomplete (datalist)
  const existingNames = useMemo(
    () => products.map((p) => p.name),
    [products]
  );

  const total = lines.reduce(
    (s, l) => s + toNumber(l.qty) * toNumber(l.price), 0
  );

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // Saat nama diketik & cocok produk lama, tampilkan info stok saat ini
  function matchedProduct(name: string) {
    return products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  }

  function reset() {
    setDistributorId(""); setWalletId(""); setDate(todayISO());
    setInvoiceNo(""); setNotes(""); setLines([newLine()]);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await createPurchase({
        distributor_id: distributorId || null,
        wallet_id: walletId,
        purchase_date: date,
        invoice_no: invoiceNo,
        notes,
        items: lines.map((l) => ({
          name: l.name,
          qty: toNumber(l.qty),
          price: toNumber(l.price),
          selling_price: toNumber(l.selling_price) || undefined,
          warranty_months: l.warranty_months ? toNumber(l.warranty_months) : undefined,
        })),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Pembelian tersimpan. Stok bertambah & saldo wallet berkurang.");
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Pembelian Barang Baru</DialogTitle>
        </DialogHeader>

        <datalist id="product-name-suggestions">
          {existingNames.map((n) => <option key={n} value={n} />)}
        </datalist>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Info pembelian */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Distributor</Label>
              <Select items={distributorItems} value={distributorId || null}
                onValueChange={(v) => setDistributorId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih distributor" /></SelectTrigger>
                <SelectContent>
                  {distributorItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>No. Nota <span className="text-muted-foreground">(opsional)</span></Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
          </div>

          {/* Daftar barang — tabel padat, NAMA DIKETIK BEBAS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daftar Barang yang Dibeli</Label>
              <span className="text-xs text-muted-foreground">
                Ketik nama — stok lama otomatis digabung
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border">
              {/* Header kolom (sm ke atas) */}
              <div className="hidden grid-cols-12 gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:grid">
                <span className="col-span-5">Nama barang</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Harga beli</span>
                <span className="col-span-2 text-right">Subtotal</span>
                <span className="col-span-1" />
              </div>

              <div className="divide-y">
                {lines.map((l, i) => {
                  const sub = toNumber(l.qty) * toNumber(l.price);
                  const matched = matchedProduct(l.name);
                  return (
                    <div key={i} className="px-3 py-2.5">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-12 sm:col-span-5">
                          <div className="flex items-center gap-1.5">
                            <Input list="product-name-suggestions"
                              className="min-w-0 flex-1"
                              placeholder="Nama barang (mis. Router TP-Link C6)"
                              value={l.name}
                              onChange={(e) => setLine(i, { name: e.target.value })} />
                            {matched && (
                              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                                stok {matched.current_stock}
                              </span>
                            )}
                            {!matched && l.name.trim() && (
                              <span className="shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                                baru
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <Input type="number" min={1} placeholder="Qty"
                            className="text-center" value={l.qty}
                            onChange={(e) => setLine(i, { qty: e.target.value })} />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <Input type="number" min={0} placeholder="Harga"
                            className="text-right" value={l.price}
                            onChange={(e) => setLine(i, { price: e.target.value })} />
                        </div>
                        <div className="col-span-3 truncate text-right text-xs font-medium sm:col-span-2">
                          {sub > 0 ? formatIDR(sub) : "—"}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-0.5 sm:col-span-1">
                          <Button type="button" variant="ghost" size="icon-sm"
                            className={l.showAdv ? "text-primary" : "text-muted-foreground hover:text-foreground"}
                            aria-label="Atur harga jual & garansi"
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

                      {/* Opsi lanjutan (harga jual & garansi) */}
                      {l.showAdv && (
                        <div className="mt-2.5 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Harga Jual Default (Rp)</Label>
                            <Input type="number" min={0} placeholder="Harga jual"
                              value={l.selling_price}
                              onChange={(e) => setLine(i, { selling_price: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Garansi (bulan)</Label>
                            <Input type="number" min={0} placeholder="12"
                              value={l.warranty_months}
                              onChange={(e) => setLine(i, { warranty_months: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Tambah Barang
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Catatan <span className="text-muted-foreground">(opsional)</span></Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer menempel: total + aksi */}
        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between gap-3 border-t bg-muted px-5 py-3.5 sm:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total Pembelian</div>
            <div className="text-lg font-bold">{formatIDR(total)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={pending || !walletId || total <= 0}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Pembelian
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
