"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, Search, Boxes, Wrench, ShieldCheck,
  FileDown, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDate, todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import { EmptyState } from "@/components/shared/empty-state";
import { RepairDialog } from "@/components/shared/repair-dialog";
import { RepairHistory } from "@/components/shared/repair-history";
import {
  AssetPhotoUpload, type PendingPhoto,
} from "@/components/shared/asset-photo-upload";
import { formatFileSize } from "@/lib/utils/image-compress";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import {
  type ClientAsset, type RepairLog, type WarrantyStatus,
  WARRANTY_STATUS_LABELS, WARRANTY_STATUS_STYLE,
} from "@/types/phase5";
import type { AssetPhoto } from "@/types/asset-photo";
import { addManualAsset, updateAsset, deleteAsset } from "./actions";
import { uploadAssetPhoto, deleteAssetPhoto, getAssetPhotos } from "./photo-actions";

// ringkasan foto untuk thumbnail di tabel (dari page)
export type AssetPhotoBrief = {
  asset_id: string;
  count: number;
  first_url: string | null;
  total_size: number;
};

export function AssetManager({
  assets, clients, wallets, categories, repairLogsByAsset, photoBrief,
}: {
  assets: ClientAsset[];
  clients: Client[];
  wallets: WalletWithBalance[];
  categories: Category[];
  repairLogsByAsset: Record<string, RepairLog[]>;
  photoBrief: Record<string, AssetPhotoBrief>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [fClient, setFClient] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  // tambah/edit
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientAsset | null>(null);
  const [form, setForm] = useState({
    client_id: "", product_name: "", serial_number: "",
    purchase_date: todayISO(), warranty_months: "12", warranty_end: "", notes: "",
  });
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);

  // repair & history
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairAsset, setRepairAsset] = useState<ClientAsset | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAsset, setHistoryAsset] = useState<ClientAsset | null>(null);

  // export pdf
  const [exportOpen, setExportOpen] = useState(false);
  const [exportClient, setExportClient] = useState("");

  const clientFilterItems = useMemo(
    () => [{ value: "all", label: "Semua Client" },
      ...clients.map((c) => ({ value: c.id, label: c.company_name }))],
    [clients]
  );
  const statusFilterItems = [
    { value: "all", label: "Semua Status" },
    { value: "active", label: "Garansi Aktif" },
    { value: "expiring", label: "Akan Habis" },
    { value: "expired", label: "Garansi Habis" },
  ];
  const clientFormItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const text = `${a.product_name} ${a.serial_number ?? ""} ${a.company_name ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (fClient !== "all" && a.client_id !== fClient) return false;
      if (fStatus !== "all" && a.warranty_status !== fStatus) return false;
      return true;
    });
  }, [assets, q, fClient, fStatus]);

  const expiringCount = assets.filter((a) => a.warranty_status === "expiring").length;

  // buang object URL saat dialog ditutup (hindari memory leak)
  useEffect(() => {
    if (!formOpen) {
      photos.forEach((p) => {
        if (p.blob && p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });
      setPhotos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  function openAdd() {
    setEditing(null);
    setForm({
      client_id: "", product_name: "", serial_number: "",
      purchase_date: todayISO(), warranty_months: "12", warranty_end: "", notes: "",
    });
    setPhotos([]);
    setFormOpen(true);
  }

  async function openEdit(a: ClientAsset) {
    setEditing(a);
    setForm({
      client_id: a.client_id, product_name: a.product_name,
      serial_number: a.serial_number ?? "", purchase_date: a.purchase_date,
      warranty_months: "12", warranty_end: a.warranty_end, notes: a.notes ?? "",
    });
    setPhotos([]);
    setFormOpen(true);
    // muat foto lama
    setLoadingPhotos(true);
    try {
      const existing = await getAssetPhotos(a.id);
      setPhotos(
        (existing as AssetPhoto[]).map((p) => ({
          key: p.id,
          id: p.id,
          previewUrl: p.signed_url ?? "",
          size: p.file_size,
        }))
      );
    } catch {
      toast.error("Gagal memuat foto aset.");
    } finally {
      setLoadingPhotos(false);
    }
  }

  function openRepair(a: ClientAsset) { setRepairAsset(a); setRepairOpen(true); }
  function openHistory(a: ClientAsset) { setHistoryAsset(a); setHistoryOpen(true); }

  // sinkronkan foto: upload yang baru, hapus yang ditandai
  async function syncPhotos(assetId: string): Promise<boolean> {
    let allOk = true;
    // hapus foto lama yang ditandai
    for (const p of photos.filter((x) => x.markedDelete && x.id)) {
      const res = await deleteAssetPhoto(p.id!);
      if (res.error) { allOk = false; toast.error(res.error); }
    }
    // upload foto baru
    for (const p of photos.filter((x) => x.blob && !x.markedDelete)) {
      const ext = p.ext ?? "jpg";
      const fd = new FormData();
      fd.append("file", p.blob!, `photo.${ext}`);
      fd.append("asset_id", assetId);
      fd.append("file_size", String(p.size));
      fd.append("ext", ext);
      fd.append("mime", p.mime ?? "image/jpeg");
      const res = await uploadAssetPhoto(fd);
      if (res.error) { allOk = false; toast.error(`Foto gagal diupload: ${res.error}`); }
    }
    return allOk;
  }

  function handleSave() {
    startTransition(async () => {
      // 1) simpan aset dulu
      const res = editing
        ? await updateAsset(editing.id, {
            product_name: form.product_name, serial_number: form.serial_number,
            purchase_date: form.purchase_date, warranty_end: form.warranty_end,
            notes: form.notes,
          })
        : await addManualAsset({
            client_id: form.client_id, product_name: form.product_name,
            serial_number: form.serial_number, purchase_date: form.purchase_date,
            warranty_months: toNumber(form.warranty_months), notes: form.notes,
          });
      if (res.error) { toast.error(res.error); return; }

      const assetId = res.id;
      // 2) urus foto (kegagalan foto TIDAK membatalkan simpan aset)
      const hasPhotoWork = photos.some((p) => p.blob || p.markedDelete);
      if (assetId && hasPhotoWork) {
        setSavingPhotos(true);
        const ok = await syncPhotos(assetId);
        setSavingPhotos(false);
        if (ok) {
          toast.success(editing ? "Asset & foto diperbarui." : "Asset & foto tersimpan.");
        } else {
          toast.warning("Asset tersimpan, tapi sebagian foto gagal. Bisa ditambahkan lagi lewat Edit.");
        }
      } else {
        toast.success(editing ? "Asset diperbarui." : "Asset ditambahkan.");
      }

      setFormOpen(false);
      router.refresh();
    });
  }

  function handleDelete(a: ClientAsset) {
    if (!confirm(`Hapus asset "${a.product_name}"?\n\nFoto aset ikut terhapus.`)) return;
    startTransition(async () => {
      const res = await deleteAsset(a.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Asset dihapus.");
      router.refresh();
    });
  }

  function handleExport() {
    if (!exportClient) { toast.error("Pilih client dulu."); return; }
    window.open(`/api/assets/pdf?client_id=${exportClient}`, "_blank");
    setExportOpen(false);
  }

  const busy = pending || savingPhotos;

  return (
    <div className="space-y-4">
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {expiringCount} asset garansinya akan habis dalam 30 hari ke depan.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari barang, serial, atau client..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select items={clientFilterItems} value={fClient}
          onValueChange={(v) => setFClient(v ?? "all")}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {clientFilterItems.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={statusFilterItems} value={fStatus}
          onValueChange={(v) => setFStatus(v ?? "all")}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilterItems.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => { setExportClient(fClient !== "all" ? fClient : ""); setExportOpen(true); }}>
          <FileDown className="h-4 w-4" /> Export PDF
        </Button>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Asset Manual</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Boxes} title="Tidak ada asset"
              description={assets.length === 0
                ? "Asset otomatis terbentuk saat penjualan. Atau tambahkan manual untuk barang lama."
                : "Tidak ada hasil untuk filter ini."} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Tgl Beli</TableHead>
                  <TableHead>Garansi s/d</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const st = (a.warranty_status ?? "active") as WarrantyStatus;
                  const logCount = repairLogsByAsset[a.id]?.length ?? 0;
                  const pb = photoBrief[a.id];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        {pb && pb.first_url ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-10 w-12 overflow-hidden rounded border bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={pb.first_url} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div className="text-[11px] leading-tight text-muted-foreground">
                              {pb.count > 1 && <div>{pb.count} foto</div>}
                              <div>{formatFileSize(pb.total_size)}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-10 w-12 items-center justify-center rounded border bg-muted text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{a.product_name}</TableCell>
                      <TableCell>{a.company_name ?? "-"}</TableCell>
                      <TableCell>{a.serial_number ?? "-"}</TableCell>
                      <TableCell>{formatDate(a.purchase_date)}</TableCell>
                      <TableCell>{formatDate(a.warranty_end)}</TableCell>
                      <TableCell>
                        <Badge className={WARRANTY_STATUS_STYLE[st]}>
                          {WARRANTY_STATUS_LABELS[st]}
                        </Badge>
                        {st !== "expired" && typeof a.days_left === "number" && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({a.days_left} hari)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Log perbaikan"
                          onClick={() => openRepair(a)}>
                          <Wrench className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Riwayat perbaikan"
                          className="relative" onClick={() => openHistory(a)}>
                          <span className="text-xs font-semibold">{logCount}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(a)}>
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

      {/* Dialog tambah/edit asset + foto */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Asset" : "Tambah Asset Manual"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select items={clientFormItems} value={form.client_id || null}
                  onValueChange={(v) => setForm({ ...form, client_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                  <SelectContent>
                    {clientFormItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nama Barang *</Label>
              <Input value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Beli</Label>
                <Input type="date" value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
              </div>
            </div>
            {editing ? (
              <div className="space-y-2">
                <Label>Garansi Berakhir</Label>
                <Input type="date" value={form.warranty_end}
                  onChange={(e) => setForm({ ...form, warranty_end: e.target.value })} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Masa Garansi (bulan)</Label>
                <Input type="number" min={0} value={form.warranty_months}
                  onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {/* Upload foto */}
            <div className="border-t pt-4">
              {loadingPhotos ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat foto…
                </div>
              ) : (
                <AssetPhotoUpload photos={photos} onChange={setPhotos} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={busy || !form.product_name.trim() || (!editing && !form.client_id)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {savingPhotos ? "Menyimpan foto…" : editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog log perbaikan */}
      {repairAsset && (
        <RepairDialog open={repairOpen} onOpenChange={setRepairOpen}
          target="asset" targetId={repairAsset.id} clientId={repairAsset.client_id}
          targetLabel={repairAsset.product_name}
          wallets={wallets} categories={categories} />
      )}

      {/* Dialog riwayat perbaikan */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Perbaikan — {historyAsset?.product_name}</DialogTitle>
          </DialogHeader>
          <RepairHistory logs={historyAsset ? repairLogsByAsset[historyAsset.id] ?? [] : []} />
        </DialogContent>
      </Dialog>

      {/* Dialog export PDF */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export PDF Asset Klien</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pilih client. PDF berisi seluruh aset client tersebut beserta foto & status garansi,
              siap dikirim ke client.
            </p>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select items={clientFormItems} value={exportClient || null}
                onValueChange={(v) => setExportClient(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clientFormItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Batal</Button>
            <Button onClick={handleExport} disabled={!exportClient}>
              <FileDown className="h-4 w-4" /> Buka PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
