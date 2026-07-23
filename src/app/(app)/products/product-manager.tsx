"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Pencil, Trash2, Loader2, Search, Package, SlidersHorizontal, History,
  AlertTriangle, Info,
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
import { updateProduct, deleteProduct, adjustStock } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";

export function ProductManager({
  products, categories,
}: {
  products: ProductWithStock[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false); // default: sembunyikan stok habis

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithStock | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", category_id: "", unit: "pcs",
    default_selling_price: "", min_stock: "0", default_warranty_months: "12",
    is_active: true,
  });

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjProduct, setAdjProduct] = useState<ProductWithStock | null>(null);
  const [adj, setAdj] = useState({ mode: "in", qty: "", note: "" });

  const categoryItems = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const adjModeItems = [
    { value: "in", label: "Tambah Stok (+)" },
    { value: "out", label: "Kurangi Stok (−)" },
  ];

  const emptyCount = products.filter((p) => p.current_stock <= 0).length;
  const lowStockCount = products.filter(
    (p) => p.is_active && p.current_stock > 0 && p.current_stock <= p.min_stock
  ).length;

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // REVISI: default hanya tampilkan yang masih ada stok
      if (!showEmpty && p.current_stock <= 0) return false;
      const text = `${p.name} ${p.sku ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      return true;
    });
  }, [products, q, showEmpty]);

  const pg = usePagination(filtered, 10, `${q}|${showEmpty}`);

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "-";

  function openEdit(p: ProductWithStock) {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku ?? "", category_id: p.category_id ?? "",
      unit: p.unit, default_selling_price: String(p.default_selling_price),
      min_stock: String(p.min_stock),
      default_warranty_months: String(p.default_warranty_months),
      is_active: p.is_active,
    });
    setEditOpen(true);
  }
  function openAdjust(p: ProductWithStock) {
    setAdjProduct(p);
    setAdj({ mode: "in", qty: "", note: "" });
    setAdjOpen(true);
  }

  function handleSaveEdit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await updateProduct(editing.id, {
        name: form.name, sku: form.sku, category_id: form.category_id || null,
        unit: form.unit,
        default_selling_price: Number(form.default_selling_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        default_warranty_months: Number(form.default_warranty_months) || 0,
        is_active: form.is_active,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Barang diperbarui.");
      setEditOpen(false);
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
      const res = await adjustStock({ product_id: adjProduct.id, qty, note: adj.note });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Stok "${adjProduct.name}" disesuaikan.`);
      setAdjOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Barang baru masuk otomatis lewat menu <b>Pembelian</b>. Barang yang stoknya
          habis (0) otomatis tersembunyi dari daftar ini.
        </span>
      </div>

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
        {emptyCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <Switch id="showEmpty" checked={showEmpty} onCheckedChange={setShowEmpty} />
            <Label htmlFor="showEmpty" className="cursor-pointer text-sm">
              Tampilkan stok habis ({emptyCount})
            </Label>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Package}
              title={products.length === 0 ? "Belum ada barang" : "Tidak ada barang dengan stok"}
              description={products.length === 0
                ? "Barang muncul di sini setelah Anda mencatat pembelian pertama."
                : "Semua barang stoknya habis. Aktifkan 'Tampilkan stok habis' atau catat pembelian baru."} />
          ) : (
            <>
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
                {pg.paged.map((p) => {
                  const low = p.current_stock <= p.min_stock;
                  const empty = p.current_stock <= 0;
                  return (
                    <TableRow key={p.id} className={!p.is_active || empty ? "opacity-50" : ""}>
                      <TableCell>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sku ?? "Tanpa SKU"}
                          {empty && " · Stok habis"}
                          {!p.is_active && " · Nonaktif"}
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
                          title="Riwayat stok" render={<Link href={`/products/${p.id}`} />}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Ubah data barang"
                          onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Hapus"
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
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="barang" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog EDIT */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Ubah Data Barang</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Barang *</Label>
              <Input value={form.name}
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
                <Select items={categoryItems} value={form.category_id || null}
                  onValueChange={(v) => setForm({ ...form, category_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categoryItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input value={form.unit}
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
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Barang aktif</p>
                <p className="text-xs text-muted-foreground">
                  Barang nonaktif tidak muncul di form penjualan.
                </p>
              </div>
              <Switch checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={pending || !form.name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog penyesuaian */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Penyesuaian Stok</DialogTitle></DialogHeader>
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
                  placeholder="Contoh: stok opname, barang rusak, koreksi"
                  onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>Batal</Button>
            <Button onClick={handleAdjust} disabled={pending || !adj.qty || !adj.note.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Penyesuaian
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
