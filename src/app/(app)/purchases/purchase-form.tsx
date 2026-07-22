"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pembelian Barang Baru</DialogTitle>
        </DialogHeader>

        <datalist id="product-name-suggestions">
          {existingNames.map((n) => <option key={n} value={n} />)}
        </datalist>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>No. Nota (opsional)</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
          </div>

          {/* Baris item — NAMA DIKETIK BEBAS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Daftar Barang yang Dibeli</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" /> Tambah Baris
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ketik nama barang bebas. Jika namanya sudah ada di stok, stok akan
              digabung otomatis. Jika baru, barang otomatis ditambahkan ke stok.
            </p>
            <div className="space-y-2">
              {lines.map((l, i) => {
                const sub = toNumber(l.qty) * toNumber(l.price);
                const matched = matchedProduct(l.name);
                return (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-5">
                        <Input list="product-name-suggestions"
                          placeholder="Nama barang (mis. Router TP-Link C6)"
                          value={l.name}
                          onChange={(e) => setLine(i, { name: e.target.value })} />
                        {matched && (
                          <p className="mt-1 text-xs text-success-strong">
                            Sudah ada di stok ({matched.current_stock} {matched.unit}) — akan digabung
                          </p>
                        )}
                        {!matched && l.name.trim() && (
                          <p className="mt-1 text-xs text-primary">
                            Barang baru — akan ditambahkan ke stok
                          </p>
                        )}
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Input type="number" min={1} placeholder="Qty" value={l.qty}
                          onChange={(e) => setLine(i, { qty: e.target.value })} />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <Input type="number" min={0} placeholder="Harga beli" value={l.price}
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

                    {/* Opsi lanjutan (harga jual & garansi) — berguna untuk barang baru */}
                    <div>
                      <button type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setLine(i, { showAdv: !l.showAdv })}>
                        {l.showAdv ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Atur harga jual & garansi {matched ? "(opsional)" : "(untuk barang baru)"}
                      </button>
                      {l.showAdv && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Harga Jual Default (Rp)</Label>
                            <Input type="number" min={0} placeholder="Harga jual"
                              value={l.selling_price}
                              onChange={(e) => setLine(i, { selling_price: e.target.value })} />
                          </div>
                          <div>
                            <Label className="text-xs">Garansi (bulan)</Label>
                            <Input type="number" min={0} placeholder="12"
                              value={l.warranty_months}
                              onChange={(e) => setLine(i, { warranty_months: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>

                    {sub > 0 && (
                      <p className="text-right text-xs text-muted-foreground">
                        Subtotal: <b>{formatIDR(sub)}</b>
                      </p>
                    )}
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
            <span className="font-medium">Total Pembelian</span>
            <span className="text-lg font-bold">{formatIDR(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={pending || !walletId || total <= 0}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Pembelian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
