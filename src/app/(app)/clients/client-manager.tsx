"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2, Search, Users, LayoutDashboard } from "lucide-react";
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
import type { Client, ClientStatus, Category } from "@/types/db";
import { addClientData, updateClientData, deleteClientData } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";

const emptyForm = {
  company_name: "", contact_name: "", category_id: "", email: "",
  address: "", phone: "", status: "active" as ClientStatus,
  joined_date: todayISO(), notes: "",
};

export function ClientManager({
  clients, categories,
}: {
  clients: Client[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fCategory, setFCategory] = useState("all");

  const categoryFilterItems = useMemo(
    () => [{ value: "all", label: "Semua Kategori" },
      ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories]
  );
  const statusFilterItems = [
    { value: "all", label: "Semua Status" },
    { value: "active", label: "Aktif" },
    { value: "inactive", label: "Nonaktif" },
  ];
  const categoryFormItems = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const statusFormItems = [
    { value: "active", label: "Aktif" },
    { value: "inactive", label: "Nonaktif" },
  ];

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "-";

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const text = `${c.company_name} ${c.contact_name ?? ""} ${c.phone ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (fStatus !== "all" && c.status !== fStatus) return false;
      if (fCategory !== "all" && c.category_id !== fCategory) return false;
      return true;
    });
  }, [clients, q, fStatus, fCategory]);

  const pg = usePagination(filtered, 10, `${q}|${fStatus}|${fCategory}`);

  function openAdd() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      company_name: c.company_name, contact_name: c.contact_name ?? "",
      category_id: c.category_id ?? "", email: c.email ?? "",
      address: c.address ?? "", phone: c.phone ?? "",
      status: c.status, joined_date: c.joined_date ?? todayISO(),
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const res = editing
        ? await updateClientData(editing.id, form)
        : await addClientData(form);
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Client diperbarui." : "Client ditambahkan.");
      setOpen(false);
      router.refresh();
    });
  }
  function handleDelete(c: Client) {
    if (!confirm(`Hapus client "${c.company_name}"?`)) return;
    startTransition(async () => {
      const res = await deleteClientData(c.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Client "${c.company_name}" dihapus.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari perusahaan, PIC, atau telepon..."
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select items={categoryFilterItems} value={fCategory}
          onValueChange={(v) => setFCategory(v ?? "all")}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categoryFilterItems.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={statusFilterItems} value={fStatus}
          onValueChange={(v) => setFStatus(v ?? "all")}>
          <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilterItems.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Tambah Client</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={Users} title="Tidak ada client"
              description={clients.length === 0
                ? "Tambahkan client pertama Anda." : "Tidak ada hasil untuk filter/pencarian ini."} />
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perusahaan</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.company_name}</TableCell>
                    <TableCell>{c.contact_name ?? "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{catName(c.category_id)}</Badge></TableCell>
                    <TableCell>{c.phone ?? "-"}</TableCell>
                    <TableCell>
                      {c.status === "active"
                        ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Aktif</Badge>
                        : <Badge variant="outline">Nonaktif</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" nativeButton={false}
                        title="Client 360" render={<Link href={`/clients/${c.id}`} />}>
                        <LayoutDashboard className="h-3.5 w-3.5" /> 360
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
                ))}
              </TableBody>
            </Table>
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="client" />
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog tambah/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Client" : "Tambah Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Perusahaan *</Label>
              <Input value={form.company_name} placeholder="Contoh: Villa Sunset Bali"
                onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nama Client (PIC)</Label>
                <Input value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select items={categoryFormItems} value={form.category_id || null}
                  onValueChange={(v) => setForm({ ...form, category_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    {categoryFormItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>No. Telepon</Label>
                <Input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Textarea rows={2} value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select items={statusFormItems} value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: (v ?? "active") as ClientStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusFormItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Bergabung</Label>
                <Input type="date" value={form.joined_date}
                  onChange={(e) => setForm({ ...form, joined_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={pending || !form.company_name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
