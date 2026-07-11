"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, Search, Camera, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/shared/empty-state";
import { PasswordCell } from "@/components/shared/password-cell";
import { RepairDialog } from "@/components/shared/repair-dialog";
import { RepairHistory } from "@/components/shared/repair-history";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import type { CctvSystem } from "@/types/phase6";
import type { RepairLog } from "@/types/phase5";
import { upsertCctv, deleteCctv } from "./actions";

const emptyForm = {
  client_id: "", nvr_brand: "", channel_count: "4", username: "", password: "",
  ip_address: "", location: "", notes: "",
};

export function CctvManager({
  items, clients, wallets, categories, repairLogsByTarget,
}: {
  items: CctvSystem[];
  clients: Client[];
  wallets: WalletWithBalance[];
  categories: Category[];
  repairLogsByTarget: Record<string, RepairLog[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [fClient, setFClient] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CctvSystem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [repairOpen, setRepairOpen] = useState(false);
  const [repairItem, setRepairItem] = useState<CctvSystem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<CctvSystem | null>(null);

  const clientFilterItems = useMemo(
    () => [{ value: "all", label: "Semua Client" },
      ...clients.map((c) => ({ value: c.id, label: c.company_name }))],
    [clients]
  );
  const clientFormItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const text = `${c.nvr_brand} ${c.company_name ?? ""} ${c.location ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (fClient !== "all" && c.client_id !== fClient) return false;
      return true;
    });
  }, [items, q, fClient]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }
  function openEdit(c: CctvSystem) {
    setEditing(c);
    setForm({
      client_id: c.client_id, nvr_brand: c.nvr_brand,
      channel_count: String(c.channel_count), username: c.username ?? "",
      password: "", ip_address: c.ip_address ?? "",
      location: c.location ?? "", notes: c.notes ?? "",
    });
    setFormOpen(true);
  }
  function openRepair(c: CctvSystem) { setRepairItem(c); setRepairOpen(true); }
  function openHistory(c: CctvSystem) { setHistoryItem(c); setHistoryOpen(true); }

  function handleSave() {
    startTransition(async () => {
      const res = await upsertCctv({
        id: editing?.id ?? null,
        client_id: form.client_id, nvr_brand: form.nvr_brand,
        channel_count: Number(form.channel_count) || 4,
        username: form.username, password: form.password,
        ip_address: form.ip_address, location: form.location, notes: form.notes,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "CCTV diperbarui." : "CCTV ditambahkan.");
      setFormOpen(false);
      router.refresh();
    });
  }

  function handleDelete(c: CctvSystem) {
    if (!confirm(`Hapus CCTV "${c.nvr_brand}"?`)) return;
    startTransition(async () => {
      const res = await deleteCctv(c.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("CCTV dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari merk, lokasi, client..."
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
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah CCTV</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Camera} title="Belum ada data CCTV"
              description="Simpan data NVR/DVR client: merk, jumlah channel, dan kredensial (terenkripsi)." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merk NVR/DVR</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-center">Channel</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const logCount = repairLogsByTarget[c.id]?.length ?? 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nvr_brand}</TableCell>
                      <TableCell>{c.company_name ?? "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{c.channel_count} CH</Badge>
                      </TableCell>
                      <TableCell>{c.username ?? "-"}</TableCell>
                      <TableCell>
                        <PasswordCell kind="cctv" id={c.id} hasPassword={c.has_password} />
                      </TableCell>
                      <TableCell>{c.location ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Log perbaikan"
                          onClick={() => openRepair(c)}>
                          <Wrench className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Riwayat perbaikan"
                          onClick={() => openHistory(c)}>
                          <span className="text-xs font-semibold">{logCount}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(c)}>
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

      {/* Dialog tambah/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah CCTV" : "Tambah CCTV"}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Merk NVR/DVR *</Label>
                <Input value={form.nvr_brand} placeholder="mis. Hikvision, Dahua"
                  onChange={(e) => setForm({ ...form, nvr_brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Channel</Label>
                <Input type="number" min={1} value={form.channel_count}
                  onChange={(e) => setForm({ ...form, channel_count: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password {editing && <span className="text-xs text-muted-foreground">(kosongkan jika tidak diubah)</span>}</Label>
                <Input type="text" value={form.password}
                  placeholder={editing ? "••••••" : ""}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>IP / Alamat Akses</Label>
                <Input value={form.ip_address} placeholder="192.168.1.108"
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input value={form.location} placeholder="mis. Ruang server"
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !form.nvr_brand.trim() || (!editing && !form.client_id)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {repairItem && (
        <RepairDialog open={repairOpen} onOpenChange={setRepairOpen}
          target="cctv" targetId={repairItem.id} clientId={repairItem.client_id}
          targetLabel={repairItem.nvr_brand} wallets={wallets} categories={categories} />
      )}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Perbaikan — {historyItem?.nvr_brand}</DialogTitle>
          </DialogHeader>
          <RepairHistory logs={historyItem ? repairLogsByTarget[historyItem.id] ?? [] : []} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
