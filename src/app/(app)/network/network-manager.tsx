"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Search, Wifi, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EmptyState } from "@/components/shared/empty-state";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { PasswordCell } from "@/components/shared/password-cell";
import { RepairDialog } from "@/components/shared/repair-dialog";
import { RepairHistory } from "@/components/shared/repair-history";
import type { Client, WalletWithBalance, Category } from "@/types/db";
import type { NetworkCredential } from "@/types/phase6";
import type { RepairLog } from "@/types/phase5";
import { upsertNetwork, deleteNetwork } from "./actions";

const emptyForm = {
  client_id: "", ssid: "", wifi_password: "", username: "", password: "",
  device_name: "", ip_address: "", location: "", notes: "",
};

export function NetworkManager({
  items, clients, wallets, categories, repairLogsByTarget,
}: {
  items: NetworkCredential[];
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
  const [editing, setEditing] = useState<NetworkCredential | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [repairOpen, setRepairOpen] = useState(false);
  const [repairItem, setRepairItem] = useState<NetworkCredential | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<NetworkCredential | null>(null);

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
    return items.filter((n) => {
      const text = `${n.ssid} ${n.device_name ?? ""} ${n.company_name ?? ""} ${n.location ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (fClient !== "all" && n.client_id !== fClient) return false;
      return true;
    });
  }, [items, q, fClient]);

  const pg = usePagination(filtered, 10, `${q}|${fClient}`);

  function openAdd() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(n: NetworkCredential) {
    setEditing(n);
    setForm({
      client_id: n.client_id, ssid: n.ssid, wifi_password: "",
      username: n.username ?? "", password: "",
      device_name: n.device_name ?? "", ip_address: n.ip_address ?? "",
      location: n.location ?? "", notes: n.notes ?? "",
    });
    setFormOpen(true);
  }
  function openRepair(n: NetworkCredential) { setRepairItem(n); setRepairOpen(true); }
  function openHistory(n: NetworkCredential) { setHistoryItem(n); setHistoryOpen(true); }

  function handleSave() {
    startTransition(async () => {
      const res = await upsertNetwork({
        id: editing?.id ?? null,
        client_id: form.client_id, ssid: form.ssid,
        wifi_password: form.wifi_password,
        username: form.username, password: form.password,
        device_name: form.device_name, ip_address: form.ip_address,
        location: form.location, notes: form.notes,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Credential diperbarui." : "Credential ditambahkan.");
      setFormOpen(false);
      router.refresh();
    });
  }
  function handleDelete(n: NetworkCredential) {
    if (!confirm(`Hapus credential "${n.ssid}"?`)) return;
    startTransition(async () => {
      const res = await deleteNetwork(n.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Credential dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari SSID, perangkat, lokasi, client..."
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
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah WiFi</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Wifi} title="Belum ada credential network"
              description="Simpan data WiFi client: SSID + password WiFi, dan username + password perangkat." />
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SSID</TableHead>
                  <TableHead>Password WiFi</TableHead>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>User Perangkat</TableHead>
                  <TableHead>Pass Perangkat</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((n) => {
                  const logCount = repairLogsByTarget[n.id]?.length ?? 0;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.ssid}</TableCell>
                      <TableCell>
                        <PasswordCell kind="wifi" id={n.id} hasPassword={n.has_wifi_password} />
                      </TableCell>
                      <TableCell>{n.device_name ?? "-"}</TableCell>
                      <TableCell>{n.username ?? "-"}</TableCell>
                      <TableCell>
                        <PasswordCell kind="network" id={n.id} hasPassword={n.has_password} />
                      </TableCell>
                      <TableCell>{n.company_name ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Log perbaikan"
                          onClick={() => openRepair(n)}>
                          <Wrench className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Riwayat perbaikan"
                          onClick={() => openHistory(n)}>
                          <span className="text-xs font-semibold">{logCount}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(n)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(n)}>
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
              onPageChange={pg.setPage} unit="WiFi" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog tambah/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah WiFi" : "Tambah WiFi"}</DialogTitle>
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

            {/* Bagian 1: WiFi (SSID + password wifi) */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jaringan WiFi</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nama WiFi (SSID) *</Label>
                  <Input value={form.ssid}
                    onChange={(e) => setForm({ ...form, ssid: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Password WiFi {editing && <span className="text-xs text-muted-foreground">(kosong = tetap)</span>}</Label>
                  <Input type="text" value={form.wifi_password}
                    placeholder={editing ? "••••••" : ""}
                    onChange={(e) => setForm({ ...form, wifi_password: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Bagian 2: Perangkat (username + password login router) */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login Perangkat / Router</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nama Perangkat</Label>
                  <Input value={form.device_name} placeholder="mis. TP-Link Archer"
                    onChange={(e) => setForm({ ...form, device_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>IP Address</Label>
                  <Input value={form.ip_address} placeholder="192.168.1.1"
                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Username Perangkat</Label>
                  <Input value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Password Perangkat {editing && <span className="text-xs text-muted-foreground">(kosong = tetap)</span>}</Label>
                  <Input type="text" value={form.password}
                    placeholder={editing ? "••••••" : ""}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Lokasi Pemasangan</Label>
                <Input value={form.location} placeholder="mis. Lobby lantai 1"
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea rows={2} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !form.ssid.trim() || (!editing && !form.client_id)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {repairItem && (
        <RepairDialog open={repairOpen} onOpenChange={setRepairOpen}
          target="network" targetId={repairItem.id} clientId={repairItem.client_id}
          targetLabel={repairItem.ssid} wallets={wallets} categories={categories} />
      )}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riwayat Perbaikan — {historyItem?.ssid}</DialogTitle>
          </DialogHeader>
          <RepairHistory logs={historyItem ? repairLogsByTarget[historyItem.id] ?? [] : []} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
