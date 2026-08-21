"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil, Trash2, Loader2, AlertTriangle, Lock, Plus, Package, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/shared/currency-input";
import { formatIDR } from "@/lib/utils/currency";
import { toNumber } from "@/lib/utils/number";
import type { InvoiceStatus } from "@/types/phase4";
import { deleteInvoiceItem, updateInvoiceItem, addInvoiceItem } from "../actions";

export type InvoiceLineRow = {
  saleItemId: string;
  dateLabel: string;
  name: string;
  isService: boolean;
  isMaintenance: boolean;
  qty: number;
  price: number;
  subtotal: number;
};

export type InvoiceProductOption = {
  id: string;
  name: string;
  current_stock: number;
  default_selling_price: number;
  default_warranty_months: number;
};

export function InvoiceLines({
  invoiceId, status, total, rows, products,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  total: number;
  rows: InvoiceLineRow[];
  products: InvoiceProductOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Hanya invoice BELUM LUNAS yang boleh diubah isinya.
  const editable = status !== "paid";

  const [editRow, setEditRow] = useState<InvoiceLineRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [delRow, setDelRow] = useState<InvoiceLineRow | null>(null);

  // ── Tambah baris ─────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<"product" | "service">("product");
  const [selProduct, setSelProduct] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addName, setAddName] = useState("");
  const [addWarranty, setAddWarranty] = useState("12");
  const [addSerial, setAddSerial] = useState("");

  const productItems = useMemo(
    () => products.map((p) => ({
      value: p.id, label: `${p.name} · stok ${p.current_stock}`,
    })),
    [products]
  );
  const selectedProduct = products.find((p) => p.id === selProduct) ?? null;
  const addQtyNum = toNumber(addQty);
  const stockShort =
    addKind === "product" && selectedProduct != null && addQtyNum > selectedProduct.current_stock;

  function openAdd() {
    setAddKind("product");
    setSelProduct("");
    setAddQty("1");
    setAddPrice("");
    setAddName("");
    setAddWarranty("12");
    setAddSerial("");
    setAddOpen(true);
  }

  function pickProduct(id: string) {
    setSelProduct(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setAddPrice(String(p.default_selling_price || ""));
      setAddWarranty(String(p.default_warranty_months || 12));
    }
  }

  function handleAdd() {
    const qty = toNumber(addQty);
    const price = toNumber(addPrice);
    if (!(qty > 0)) { toast.error("Qty harus lebih dari 0."); return; }
    if (!(price >= 0)) { toast.error("Harga tidak valid."); return; }
    if (addKind === "product" && !selProduct) { toast.error("Pilih barang."); return; }
    if (addKind === "service" && !addName.trim()) { toast.error("Isi nama jasa."); return; }
    if (stockShort) { toast.error("Stok tidak cukup."); return; }
    startTransition(async () => {
      const res = await addInvoiceItem({
        invoice_id: invoiceId,
        is_service: addKind === "service",
        product_id: addKind === "product" ? selProduct : null,
        item_name: addKind === "service" ? addName : null,
        qty,
        price,
        warranty_months: addKind === "product" ? toNumber(addWarranty) || 12 : undefined,
        serial: addKind === "product" ? addSerial : null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Baris ditambahkan.");
      setAddOpen(false);
      router.refresh();
    });
  }

  function openEdit(r: InvoiceLineRow) {
    setEditRow(r);
    setEditName(r.name);
    setEditPrice(String(r.price));
  }

  function handleSaveEdit() {
    if (!editRow) return;
    const price = toNumber(editPrice);
    if (!(price >= 0)) { toast.error("Harga tidak valid."); return; }
    startTransition(async () => {
      const res = await updateInvoiceItem({
        sale_item_id: editRow.saleItemId,
        invoice_id: invoiceId,
        item_name: editRow.isService ? editName : null,
        price,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Baris diperbarui.");
      setEditRow(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!delRow) return;
    startTransition(async () => {
      const res = await deleteInvoiceItem({
        sale_item_id: delRow.saleItemId,
        invoice_id: invoiceId,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        delRow.isService ? "Baris jasa dihapus." : "Baris dihapus, stok dikembalikan."
      );
      setDelRow(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Rincian Penjualan</CardTitle>
        {editable && (
          <Button size="sm" variant="outline" onClick={openAdd} disabled={pending}>
            <Plus className="h-4 w-4" /> Tambah Baris
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {status === "sent" && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Invoice ini sudah ditandai terkirim. Mengubah isinya akan
              berbeda dari yang sudah diterima client — kirim ulang bila perlu.</span>
          </div>
        )}
        {!editable && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Invoice terkunci karena sudah lunas. Batalkan lunas dulu untuk
              mengedit atau menghapus baris.</span>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Barang</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {editable && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.saleItemId}>
                <TableCell>{r.dateLabel}</TableCell>
                <TableCell>
                  {r.name}
                  {r.isMaintenance && (
                    <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      maintenance
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">{r.qty}</TableCell>
                <TableCell className="text-right">{formatIDR(r.price)}</TableCell>
                <TableCell className="text-right">{formatIDR(r.subtotal)}</TableCell>
                {editable && (
                  <TableCell className="text-right">
                    {r.isMaintenance ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEdit(r)} disabled={pending}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDelRow(r)} disabled={pending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell colSpan={4} className="text-right font-bold">Grand Total</TableCell>
              <TableCell className="text-right text-lg font-bold">{formatIDR(total)}</TableCell>
              {editable && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>

      {/* Dialog Tambah baris */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Baris ke Invoice</DialogTitle>
            <DialogDescription>
              Baris baru langsung masuk ke invoice ini. Barang mengurangi stok &
              membuat aset garansi; jasa tanpa stok.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Pilih jenis */}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button"
                variant={addKind === "product" ? "default" : "outline"}
                onClick={() => setAddKind("product")}>
                <Package className="h-4 w-4" /> Barang
              </Button>
              <Button type="button"
                variant={addKind === "service" ? "default" : "outline"}
                onClick={() => setAddKind("service")}>
                <Wrench className="h-4 w-4" /> Jasa
              </Button>
            </div>

            {addKind === "product" ? (
              <div className="space-y-2">
                <Label>Barang *</Label>
                <Select items={productItems} value={selProduct || null}
                  onValueChange={(v) => pickProduct(v ?? "")}>
                  <SelectTrigger className="w-full min-w-0 flex-1">
                    <SelectValue placeholder="Pilih barang" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} <span className="text-muted-foreground">· stok {p.current_stock}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nama Jasa *</Label>
                <Input value={addName} onChange={(e) => setAddName(e.target.value)}
                  placeholder="mis. Install ulang laptop" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Qty *</Label>
                <Input type="number" min={1} value={addQty}
                  className={stockShort ? "border-destructive" : ""}
                  onChange={(e) => setAddQty(e.target.value)} />
                {stockShort && selectedProduct && (
                  <p className="text-xs text-destructive">
                    Stok tidak cukup (tersedia {selectedProduct.current_stock}).
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Harga *</Label>
                <CurrencyInput value={addPrice} onValueChange={setAddPrice} />
              </div>
            </div>

            {addKind === "product" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Garansi (bulan)</Label>
                  <Input type="number" min={0} value={addWarranty}
                    onChange={(e) => setAddWarranty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Serial number</Label>
                  <Input value={addSerial} onChange={(e) => setAddSerial(e.target.value)}
                    placeholder="opsional" />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Subtotal: </span>
              <span className="font-semibold">
                {formatIDR(addQtyNum * toNumber(addPrice))}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={pending || stockShort}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit baris */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Baris</DialogTitle>
            <DialogDescription>
              {editRow?.isService
                ? "Ubah nama dan/atau harga jasa. Tidak memengaruhi stok."
                : "Ubah harga jual. Qty & stok tidak berubah. Untuk mengganti barang, hapus baris lalu jual ulang."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editRow?.isService ? (
              <div className="space-y-2">
                <Label>Nama Jasa</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Barang</Label>
                <Input value={editRow?.name ?? ""} disabled />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Qty</Label>
                <Input value={editRow?.qty ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Harga *</Label>
                <CurrencyInput value={editPrice} onValueChange={setEditPrice} />
              </div>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Subtotal baru: </span>
              <span className="font-semibold">
                {formatIDR((editRow?.qty ?? 0) * toNumber(editPrice))}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus baris */}
      <Dialog open={!!delRow} onOpenChange={(o) => !o && setDelRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Baris</DialogTitle>
            <DialogDescription>
              {delRow?.isService
                ? `Hapus baris jasa "${delRow?.name}" dari invoice ini?`
                : `Hapus "${delRow?.name}" dari invoice ini? Stok barang akan dikembalikan.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelRow(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus Baris
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
