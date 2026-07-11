"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Search, Truck } from "lucide-react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Distributor } from "@/types/db";
import { addDistributor, updateDistributor, deleteDistributor } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

const emptyForm = {
  name: "", contact_name: "", phone: "", email: "", address: "", notes: "",
};

export function DistributorManager({ distributors }: { distributors: Distributor[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      distributors.filter((d) =>
        `${d.name} ${d.contact_name ?? ""} ${d.phone ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [distributors, q]
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(d: Distributor) {
    setEditing(d);
    setForm({
      name: d.name, contact_name: d.contact_name ?? "", phone: d.phone ?? "",
      email: d.email ?? "", address: d.address ?? "", notes: d.notes ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const res = editing
        ? await updateDistributor(editing.id, form)
        : await addDistributor(form);
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Distributor diperbarui." : "Distributor ditambahkan.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(d: Distributor) {
    if (!confirm(`Hapus distributor "${d.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteDistributor(d.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Distributor "${d.name}" dihapus.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari distributor..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah Distributor</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Truck} title="Tidak ada distributor"
              description="Tambahkan tempat Anda biasa membeli barang." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.contact_name ?? "-"}</TableCell>
                    <TableCell>{d.phone ?? "-"}</TableCell>
                    <TableCell>{d.email ?? "-"}</TableCell>
                    <TableCell className="max-w-52 truncate">{d.address ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(d)}>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Distributor" : "Tambah Distributor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Distributor *</Label>
              <Input value={form.name} placeholder="Contoh: CV Sumber Jaya Komputer"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nama Kontak</Label>
                <Input value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Textarea rows={2} value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={pending || !form.name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
