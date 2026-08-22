"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus, Search, Pencil, Trash2, ChevronDown, PackageOpen, X, Loader2, Info,
  BanknoteArrowUp, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { usePagination } from "@/components/shared/use-pagination";
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
  paid_date: string | null;
  invoice_no: string | null;
  total: number;
  item_count: number;
  items: OrderItem[];
};

type Payment = {
  paid_date: string;
  total: number;
  notas: { destination: string | null; invoice_no: string | null; total: number }[];
};

type Line = { name: string; qty: string; cost: string };
type Tab = "aktif" | "arsip" | "pelunasan";

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const digits = (s: string) => Number((s || "").replace(/\D/g, "")) || 0;
// yyyy-mm-dd dari komponen LOKAL (hindari toISOString yang menggeser hari di TZ+).
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const today = () => ymd(new Date());
const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const monthStartISO = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };
const monthEndISO = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

function statusBadge(o: Order) {
  if (o.status === "rejected") return <Badge variant="destructive">Ditolak</Badge>;
  if (o.status === "accepted")
    return o.is_paid
      ? <Badge className="bg-emerald-600 text-white">Lunas</Badge>
      : <Badge className="bg-sky-600 text-white">Diterima</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

export function PortalClient({ orders }: { orders: Order[] }) {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(monthEndISO());
  const [tab, setTab] = useState<Tab>("aktif");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Dialog form
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [destination, setDestination] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", qty: "1", cost: "" }]);
  const [saving, setSaving] = useState(false);

  const q = search.trim().toLowerCase();
  const inRange = (d: string | null) => !!d && d >= from && d <= to;
  const matchOrder = (o: Order) =>
    !q || (o.destination ?? "").toLowerCase().includes(q) ||
    o.items.some((it) => it.name.toLowerCase().includes(q));

  const aktifList = useMemo(
    () => orders.filter((o) =>
      (o.status === "draft" || (o.status === "accepted" && !o.is_paid)) &&
      inRange(o.order_date) && matchOrder(o)),
    [orders, q, from, to]
  );
  const arsipList = useMemo(
    () => orders.filter((o) =>
      (o.status === "rejected" || (o.status === "accepted" && o.is_paid)) &&
      inRange(o.order_date) && matchOrder(o)),
    [orders, q, from, to]
  );
  const payments = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const o of orders) {
      if (o.status !== "accepted" || !o.paid_date) continue;
      const p = map.get(o.paid_date) ?? { paid_date: o.paid_date, total: 0, notas: [] };
      p.total += o.total;
      p.notas.push({ destination: o.destination, invoice_no: o.invoice_no, total: o.total });
      map.set(o.paid_date, p);
    }
    return [...map.values()]
      .filter((p) => inRange(p.paid_date) &&
        (!q || p.notas.some((n) =>
          (n.destination ?? "").toLowerCase().includes(q) ||
          (n.invoice_no ?? "").toLowerCase().includes(q))))
      .sort((a, b) => b.paid_date.localeCompare(a.paid_date));
  }, [orders, q, from, to]);

  const view: (Order | Payment)[] = tab === "aktif" ? aktifList : tab === "arsip" ? arsipList : payments;
  const pg = usePagination(view, 20, `${tab}|${q}|${from}|${to}`);
  const viewTotal = view.reduce((s, x) => s + x.total, 0);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function openNew() {
    setEditId(null); setDate(today()); setDestination("");
    setLines([{ name: "", qty: "1", cost: "" }]); setOpen(true);
  }
  function openEdit(o: Order) {
    setEditId(o.id); setDate(o.order_date); setDestination(o.destination ?? "");
    setLines(o.items.length
      ? o.items.map((it) => ({ name: it.name, qty: String(it.qty), cost: String(Math.round(it.cost_price)) }))
      : [{ name: "", qty: "1", cost: "" }]);
    setOpen(true);
  }
  const formTotal = lines.reduce((s, l) => s + digits(l.qty) * digits(l.cost), 0);
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { name: "", qty: "1", cost: "" }]);
  const removeLine = (i: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  async function save() {
    const items = lines
      .map((l) => ({ name: l.name.trim(), qty: digits(l.qty), cost_price: digits(l.cost) }))
      .filter((it) => it.name && it.qty > 0);
    if (items.length === 0) { toast.error("Isi minimal 1 barang (nama & qty)."); return; }
    setSaving(true);
    const res = await upsertOrder({ id: editId, order_date: date || today(), destination: destination.trim(), items });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Gagal menyimpan."); return; }
    toast.success(editId ? "Pengajuan diperbarui." : "Pengajuan dibuat.");
    setOpen(false);
  }
  async function onDelete(o: Order) {
    const ok = await confirm({
      title: "Hapus pengajuan?",
      description: `Tujuan "${o.destination ?? "-"}" (${o.item_count} barang). Tindakan ini tidak bisa dibatalkan.`,
      destructive: true, confirmText: "Hapus",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteOrder(o.id);
      if (!res.ok) toast.error(res.error ?? "Gagal menghapus.");
      else toast.success("Pengajuan dihapus.");
    });
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "aktif", label: "Aktif", count: aktifList.length },
    { key: "arsip", label: "Arsip", count: arsipList.length },
    { key: "pelunasan", label: "Pelunasan", count: payments.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Input barang yang Anda kirim beserta <b>harga modal</b>. Selama masih <b>Draft</b>{" "}
          bisa diubah/hapus. Tab <b>Pelunasan</b> menampilkan pembayaran yang sudah Anda terima.
        </p>
      </div>

      {/* Toolbar: cari + rentang tanggal + tombol buat */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cari tujuan / barang…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Dari</Label>
            <Input type="date" className="w-[9.5rem]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Sampai</Label>
            <Input type="date" className="w-[9.5rem]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Buat Pengajuan
        </Button>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-lg border p-0.5 text-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? "bg-primary-foreground/20" : "bg-muted"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {view.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {tab === "pelunasan" ? "Total dibayarkan" : "Total nilai"} pada rentang ini:{" "}
          <b className="text-foreground">{rp(viewTotal)}</b>
        </p>
      )}

      {/* Daftar */}
      {view.length === 0 ? (
        <EmptyState
          icon={tab === "pelunasan" ? BanknoteArrowUp : PackageOpen}
          title={
            q || tab !== "aktif"
              ? "Tidak ada data pada rentang/tab ini"
              : "Belum ada pengajuan aktif"
          }
          description={tab === "aktif" ? 'Klik "Buat Pengajuan" untuk mulai.' : "Coba ubah rentang tanggal."}
        />
      ) : tab === "pelunasan" ? (
        <div className="rounded-lg border">
          <div className="divide-y">
            {(pg.paged as Payment[]).map((p, i) => {
              const id = `pay-${p.paid_date}-${i}`;
              const isOpen = expanded.has(id);
              return (
                <div key={id}>
                  <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => toggle(id)}>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <BanknoteArrowUp className="h-4 w-4 text-emerald-600" />
                        <p className="font-medium">Pembayaran {fmtDate(p.paid_date)}</p>
                        <Badge className="bg-emerald-600 text-white">Lunas</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.notas.length} nota</p>
                    </div>
                    <p className="shrink-0 text-right font-semibold tabular-nums text-emerald-700">{rp(p.total)}</p>
                  </div>
                  {isOpen && (
                    <div className="border-t px-3 pb-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground">
                            <th className="py-2 text-left font-medium">No. Nota</th>
                            <th className="py-2 text-left font-medium">Tujuan</th>
                            <th className="py-2 text-right font-medium">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {p.notas.map((n, j) => (
                            <tr key={j}>
                              <td className="py-1.5">{n.invoice_no || "Tanpa nota"}</td>
                              <td className="py-1.5 text-muted-foreground">{n.destination || "-"}</td>
                              <td className="py-1.5 text-right tabular-nums">{rp(n.total)}</td>
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
          <PaginationBar page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} total={pg.total} onPageChange={pg.setPage} unit="pembayaran" />
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {(pg.paged as Order[]).map((o) => {
              const isOpen = expanded.has(o.id);
              const isDraft = o.status === "draft";
              return (
                <div key={o.id}>
                  <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => toggle(o.id)}>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{o.destination || "Tanpa tujuan"}</p>
                        {statusBadge(o)}
                      </div>
                      <p className="text-xs text-muted-foreground">{fmtDate(o.order_date)} · {o.item_count} barang</p>
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
          <PaginationBar page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} total={pg.total} onPageChange={pg.setPage} unit="pengajuan" />
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
                  <span>Nama</span><span className="text-center">Qty</span><span className="text-right">Harga modal</span><span />
                </div>
                <div className="divide-y">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_4rem_7rem_2rem] items-center gap-2 px-2 py-1.5">
                      <Input placeholder="Nama barang" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                      <Input className="text-center" inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, "") })} />
                      <CurrencyInput className="text-right" value={l.cost} onValueChange={(v) => setLine(i, { cost: v })} />
                      <Button type="button" variant="ghost" size="icon-sm" disabled={lines.length === 1} onClick={() => removeLine(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Masukkan harga modal saja. Harga jual ditentukan admin.</p>
            </div>
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm">Total: <b className="tabular-nums">{rp(formTotal)}</b></span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Simpan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
