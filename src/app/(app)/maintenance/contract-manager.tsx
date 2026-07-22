"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatIDR } from "@/lib/utils/currency";
import { formatDate, todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import type { Client } from "@/types/db";
import { type MaintenanceContract, DEFAULT_DUE_DAY } from "@/types/maintenance";
import { saveContract, deleteContract } from "./actions";

type Item = { value: string; label: string };

const STATUS_ITEMS: Item[] = [
  { value: "active", label: "Aktif" },
  { value: "stopped", label: "Berhenti" },
];

// tanggal jatuh tempo 1..28
const DUE_ITEMS: Item[] = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `Tanggal ${i + 1}`,
}));

export function ContractManager({
  contracts, clients,
}: {
  contracts: MaintenanceContract[];
  clients: Client[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceContract | null>(null);

  // form
  const [clientId, setClientId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDay, setDueDay] = useState(String(DEFAULT_DUE_DAY));
  const [status, setStatus] = useState<"active" | "stopped">("active");
  const [notes, setNotes] = useState("");

  const clientItems = useMemo<Item[]>(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })),
    [clients]
  );

  const totalPerMonth = contracts
    .filter((c) => c.is_active)
    .reduce((s, c) => s + Number(c.monthly_amount), 0);

  function openAdd() {
    setEditing(null);
    setClientId(""); setServiceName(""); setAmount("");
    setStartDate(todayISO()); setDueDay(String(DEFAULT_DUE_DAY));
    setStatus("active"); setNotes("");
    setOpen(true);
  }

  function openEdit(c: MaintenanceContract) {
    setEditing(c);
    setClientId(c.client_id);
    setServiceName(c.service_name);
    setAmount(String(c.monthly_amount));
    setStartDate(c.start_date);
    setDueDay(String(c.due_day));
    setStatus(c.is_active ? "active" : "stopped");
    setNotes(c.notes ?? "");
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveContract({
        id: editing?.id ?? null,
        client_id: clientId,
        service_name: serviceName,
        monthly_amount: toNumber(amount),
        start_date: startDate,
        due_day: toNumber(dueDay) || DEFAULT_DUE_DAY,
        is_active: status === "active",
        notes,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Kontrak diperbarui." : "Kontrak dibuat.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(c: MaintenanceContract) {
    if (!confirm(
      `Hapus kontrak "${c.service_name}" untuk ${c.company_name ?? "client ini"}?\n\n` +
      `Tagihan yang sudah terbit TIDAK ikut terhapus.`
    )) return;
    startTransition(async () => {
      const res = await deleteContract(c.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Kontrak dihapus.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Total kontrak aktif:{" "}
          <span className="font-semibold text-foreground">{formatIDR(totalPerMonth)}</span>
          {" "}per bulan
        </p>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false}
            render={<a href="/maintenance/issue" />}>
            <Receipt className="h-4 w-4" /> Terbitkan Tagihan
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Kontrak Baru
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <EmptyState icon={FileText} title="Belum ada kontrak maintenance"
              description="Buat kontrak untuk client yang membayar biaya maintenance rutin tiap bulan." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Layanan</TableHead>
                  <TableHead className="text-right">Biaya / Bulan</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.company_name ?? "-"}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-sm">{c.service_name}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(Number(c.monthly_amount))}
                    </TableCell>
                    <TableCell>Tgl {c.due_day}</TableCell>
                    <TableCell>{formatDate(c.start_date)}</TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <Badge className="bg-success-tint text-success-strong">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Berhenti</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(c)} disabled={pending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Kontrak" : "Kontrak Maintenance Baru"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select items={clientItems} value={clientId || null}
                onValueChange={(v) => setClientId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clientItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nama Layanan *</Label>
              <Textarea rows={2} value={serviceName}
                placeholder="mis. Maintenance Computer, Printer, Network, CCTV, Audio"
                onChange={(e) => setServiceName(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Teks ini yang muncul sebagai nama barang di invoice.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Biaya per Bulan (Rp) *</Label>
                <Input type="number" min={0} value={amount} placeholder="1000000"
                  onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jatuh Tempo Bawaan</Label>
                <Select items={DUE_ITEMS} value={dueDay}
                  onValueChange={(v) => setDueDay(v ?? String(DEFAULT_DUE_DAY))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DUE_ITEMS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Dipakai bila invoice periode itu belum ada. Tanggal ini di bulan
                  berikutnya.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select items={STATUS_ITEMS} value={status}
                  onValueChange={(v) => setStatus((v ?? "active") as "active" | "stopped")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Kontrak berhenti tidak muncul saat menerbitkan tagihan.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={notes}
                onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave}
              disabled={pending || !clientId || !serviceName.trim() || toNumber(amount) <= 0}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Kontrak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
