"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus, Search, Pencil, Trash2, ChevronDown, PackageOpen, X, Loader2, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { upsertOrder, deleteOrder } from "./actions";

export type OrderItem = { id?: string; name: string; qty: number; cost_price: number };
export type Order = {
  id: string;
  order_date: string;
  destination: string | null;
  status: "draft" | "accepted" | "rejected";
  created_at: string;
  is_paid: boolean;
  total: number;
  item_count: number;
  items: OrderItem[];
};

type Line = { name: string; qty: string; cost: string };

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const digits = (s: string) => Number((s || "").replace(/\D/g, "")) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function statusBadge(o: Order) {
  if (o.status === "rejected")
    return <Badge variant="destructive">Ditolak</Badge>;
  if (o.status === "accepted")
    return o.is_paid ? (
      <Badge className="bg-emerald-600 text-white">Lunas</Badge>
    ) : (
      <Badge className="bg-sky-600 text-white">Diterima</Badge>
    );
  return <Badge variant="secondary">Draft</Badge>;
}

export function PortalClient({ orders }: { orders: Order[] }) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"aktif" | "arsip">("aktif");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Dialog form
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [destination, setDestination] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", qty: "1", cost: "" }]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const isArsip = o.status === "rejected" || (o.status === "accepted" && o.is_paid);
      if (tab === "arsip" ? !isArsip : isArsip) return false;
      if (!q) return true;
      return (
        (o.destination ?? "").toLowerCase().includes(q) ||
        o.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, search, tab]);

  const totalAktif = useMemo(
    () => orders
      .filter((o) => o.status === "draft" || (o.status === "accepted" && !o.is_paid))
      .reduce((s, o) => s + o.total, 0),
    [orders]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function openNew() {
    setEditId(null);
    setDate(today());
    setDestination("");
    setLines([{ name: "", qty: "1", cost: "" }]);
    setOpen(true);
  }

  function openEdit(o: Order) {
    setEditId(o.id);
    setDate(o.order_date);
    setDestination(o.destination ?? "");
    setLines(
      o.items.length
        ? o.items.map((it) => ({ name: it.name, qty: String(it.qty), cost: String(Math.round(it.cost_price)) }))
        : [{ name: "", qty: "1", cost: "" }]
    );
    setOpen(true);
  }

  const formTotal = lines.reduce((s, l) => s + digits(l.qty) * digits(l.cost), 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { name: "", qty: "1", cost: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function save() {
    const items = lines
      .map((l) => ({ name: l.name.trim(), qty: digits(l.qty), cost_price: digits(l.cost) }))
      .filter((it) => it.name && it.qty > 0);
    if (items.length === 0) {
      toast.error("Isi minimal 1 barang (nama & qty).");
      return;
    }
    setSaving(true);
    const res = await upsertOrder({
      id: editId,
      order_date: date || today(),
      destination: destination.trim(),
      items,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Gagal menyimpan.");
      return;
    }
    toast.success(editId ? "Pengajuan diperbarui." : "Pengajuan dibuat.");
    setOpen(false);
  }

  async function onDelete(o: Order) {
    const ok = await confirm({
      title: "Hapus pengajuan?",
      description: `Tujuan "${o.destination ?? "-"}" (${o.item_count} barang). Tindakan ini tidak bisa dibatalkan.`,
      destructive: true,
      confirmText: "Hapus",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteOrder(o.id);
      if (!res.ok) toast.error(res.error ?? "Gagal menghapus.");
      else toast.success("Pengajuan dihapus.");
    });
  }

  return (
    <div className="space-y-4">
      {/* Info alur singkat */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Input barang yang Anda kirim beserta <b>harga modal</b>. Selama masih{" "}
          <b>Draft</b> bisa diubah/hapus. Setelah admin <b>Terima</b>, pengajuan
          terkunci.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari tujuan / barang…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Buat Pengajuan
        </Button>
      </div>

      {/* Tabs sederhana */}
      <div className="inline-flex rounded-lg border p-0.5 text-sm">
        {(["aktif", "arsip"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "aktif" ? "Aktif" : "Arsip"}
          </button>
        ))}
      </div>

      {tab === "aktif" && totalAktif > 0 && (
        <p className="text-sm text-muted-foreground">
          Total nilai pengajuan aktif: <b className="text-foreground">{rp(totalAktif)}</b>
        </p>
      )}

      {/* Daftar */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={search ? "Tidak ada yang cocok" : tab === "aktif" ? "Belum ada pengajuan aktif" : "Arsip kosong"}
          description={tab === "aktif" ? 'Klik "Buat Pengajuan" untuk mulai.' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const isOpen = expanded.has(o.id);
            const isDraft = o.status === "draft";
            return (
              <div key={o.id} className="rounded-lg border bg-background">
                <div
                  className="flex cursor-pointer items-center gap-3 p-3"
                  onClick={() => toggle(o.id)}
                >
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{o.destination || "Tanpa tujuan"}</p>
                      {statusBadge(o)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(o.order_date)} · {o.item_count} barang
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums">{rp(o.total)}</p>
                  {isDraft && (
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" title="Ubah" onClick={() => openEdit(o)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" title="Hapus" disabled={pending} onClick={() => onDelete(o)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t px-3 pb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="py-2 text-left font-medium">Barang</th>
                          <th className="py-2 text-center font-medium">Qty</th>
                          <th className="py-2 text-right font-medium">Modal</th>
                          <th className="py-2 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {o.items.map((it, i) => (
                          <tr key={it.id ?? i}>
                            <td className="py-1.5">{it.name}</td>
                            <td className="py-1.5 text-center tabular-nums">{it.qty}</td>
                            <td className="py-1.5 text-right tabular-nums">{rp(it.cost_price)}</td>
                            <td className="py-1.5 text-right tabular-nums">{rp(it.qty * it.cost_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-4">
            <DialogTitle>{editId ? "Ubah Pengajuan" : "Buat Pengajuan"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="date">Tanggal kirim</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dest">Tujuan pengiriman</Label>
                <Input id="dest" placeholder="mis. Rob Peetoom Seminyak" value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Barang</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" /> Tambah
                </Button>
              </div>
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_4rem_7rem_2rem] items-center gap-2 border-b px-2 py-1.5 text-xs text-muted-foreground">
                  <span>Nama</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Harga modal</span>
                  <span />
                </div>
                <div className="divide-y">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_4rem_7rem_2rem] items-center gap-2 px-2 py-1.5">
                      <Input
                        placeholder="Nama barang"
                        value={l.name}
                        onChange={(e) => setLine(i, { name: e.target.value })}
                      />
                      <Input
                        className="text-center"
                        inputMode="numeric"
                        value={l.qty}
                        onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, "") })}
                      />
                      <CurrencyInput
                        className="text-right"
                        value={l.cost}
                        onValueChange={(v) => setLine(i, { cost: v })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(i)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Masukkan harga modal saja. Harga jual ditentukan admin.
              </p>
            </div>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm">
              Total: <b className="tabular-nums">{rp(formTotal)}</b>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Batal
              </Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
