"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, Loader2, Search, Package, SlidersHorizontal, History,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import type { ProductWithStock, Category } from "@/types/db";
import { addProduct, updateProduct, deleteProduct, adjustStock } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

const emptyForm = {
  name: "", sku: "", category_id: "", unit: "pcs",
  default_selling_price: "", min_stock: "0", default_warranty_months: "12",
  is_active: true,
};

export function ProductManager({
  products, categories,
}: {
  products: ProductWithStock[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");

  // penyesuaian stok
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjProduct, setAdjProduct] = useState<ProductWithStock | null>(null);
  const [adj, setAdj] = useState({ mode: "in", qty: "", note: "" });

  const lowStockCount = products.filter(
    (p) => p.is_active && p.current_stock <= p.min_stock
  ).length;

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase())
      ),
    [products, q]
  );

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "-";

  // Base UI Select butuh prop `items` (value→label) agar trigger menampilkan
  // label, bukan value mentah (UUID/kode). Lihat catatan di AGENTS.md.
  const categoryItems = categories.map((c) => ({ value: c.id, label: c.name }));
  const adjModeItems = [
    { value: "in", label: "Tambah Stok (+)" },
    { value: "out", label: "Kurangi Stok (−)" },
  ];

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: ProductWithStock) {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku ?? "", category_id: p.category_id ?? "",
      unit: p.unit, default_selling_price: String(p.default_selling_price),
      min_stock: String(p.min_stock),
      default_warranty_months: String(p.default_warranty_months),
      is_active: p.is_active,
    });
    setOpen(true);
  }

  function openAdjust(p: ProductWithStock) {
    setAdjProduct(p);
    setAdj({ mode: "in", qty: "", note: "" });
    setAdjOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const input = {
        name: form.name, sku: form.sku, category_id: form.category_id || null,
        unit: form.unit,
        default_selling_price: Number(form.default_selling_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        default_warranty_months: Number(form.default_warranty_months) || 0,
        is_active: form.is_active,
      };
      const res = editing
        ? await updateProduct(editing.id, input)
        : await addProduct(input);
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Barang diperbarui." : "Barang ditambahkan.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(p: ProductWithStock) {
    if (!confirm(`Hapus barang "${p.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteProduct(p.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Barang "${p.name}" dihapus.`);
      router.refresh();
    });
  }

  function handleAdjust() {
    if (!adjProduct) return;
    const qty = (adj.mode === "in" ? 1 : -1) * (Number(adj.qty) || 0);
    startTransition(async () => {
      const res = await adjustStock({
        product_id: adjProduct.id, qty, note: adj.note,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Stok "${adjProduct.name}" disesuaikan.`);
      setAdjOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {lowStockCount} barang mencapai batas stok minimum. Segera lakukan pembelian.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama barang atau SKU..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah Barang</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Package} title="Tidak ada barang"
              description="Tambahkan barang yang biasa Anda jual: router, kamera CCTV, kabel, dan lainnya." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-right">Harga Beli Terakhir</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-center">Garansi</TableHead>
                  <TableHead className="w-36 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const low = p.current_stock <= p.min_stock;
                  return (
                    <TableRow key={p.id} className={!p.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sku ?? "Tanpa SKU"}{!p.is_active && " · Nonaktif"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{catName(p.category_id)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={low ? "destructive" : "outline"}
                          className={low ? "" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          {p.current_stock} {p.unit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIDR(Number(p.last_purchase_price))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatIDR(Number(p.default_selling_price))}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.default_warranty_months} bln
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Sesuaikan stok"
                          onClick={() => openAdjust(p)}>
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" nativeButton={false}
                          title="Riwayat stok"
                          render={<Link href={`/products/${p.id}`} />}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog tambah/edit barang */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Barang" : "Tambah Barang"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Barang *</Label>
              <Input value={form.name} placeholder="Contoh: Router TP-Link Archer C6"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SKU (opsional)</Label>
                <Input value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select items={categoryItems} value={form.category_id || undefined}
                  onValueChange={(v) => setForm({ ...form, category_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input value={form.unit} placeholder="pcs / meter / roll"
                  onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Stok Minimum</Label>
                <Input type="number" min={0} value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Garansi (bulan)</Label>
                <Input type="number" min={0} value={form.default_warranty_months}
                  onChange={(e) => setForm({ ...form, default_warranty_months: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Harga Jual Default (Rp)</Label>
              <Input type="number" min={0} value={form.default_selling_price}
                onChange={(e) => setForm({ ...form, default_selling_price: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Harga beli terakhir terisi otomatis dari transaksi pembelian.
              </p>
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Barang aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Barang nonaktif tidak muncul di form pembelian/penjualan.
                  </p>
                </div>
                <Switch checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={pending || !form.name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog penyesuaian stok */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penyesuaian Stok</DialogTitle>
          </DialogHeader>
          {adjProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <span className="font-medium">{adjProduct.name}</span>
                <span className="text-muted-foreground">
                  {" "}· stok saat ini: {adjProduct.current_stock} {adjProduct.unit}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <Select items={adjModeItems} value={adj.mode}
                    onValueChange={(v) => setAdj({ ...adj, mode: v ?? "in" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {adjModeItems.map((it) => (
                        <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <Input type="number" min={1} value={adj.qty}
                    onChange={(e) => setAdj({ ...adj, qty: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alasan (wajib, untuk audit)</Label>
                <Input value={adj.note}
                  placeholder="Contoh: stok opname, barang rusak, salah input"
                  onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleAdjust}
              disabled={pending || !adj.qty || !adj.note.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Penyesuaian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
