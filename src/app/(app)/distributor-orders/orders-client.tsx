"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Inbox, Check, X, Undo2, ChevronDown, Loader2, MapPin, Truck, Store, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/shared/currency-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatIDR } from "@/lib/utils/currency";
import type { WalletWithBalance } from "@/types/db";
import { acceptOrder, acceptOrderDropship, unacceptOrder, rejectOrder } from "./actions";

export type AdminItem = { id: string; name: string; qty: number; cost_price: number };
export type AdminOrder = {
  id: string;
  order_date: string;
  destination: string | null;
  status: "draft" | "accepted" | "rejected";
  distributor_name: string;
  is_paid: boolean;
  items: AdminItem[];
};
export type ProductFlag = { track_as_asset: boolean; is_active: boolean };
type ClientLite = { id: string; company_name: string };
type SaleMethod = "monthly_invoice" | "cash" | "transfer";
type Brand = "cetak_ide" | "athaya";

const METHODS: { value: SaleMethod; label: string }[] = [
  { value: "monthly_invoice", label: "Invoice bulanan" },
  { value: "cash", label: "Tunai" },
  { value: "transfer", label: "Transfer" },
];
const BRANDS: { value: Brand; label: string }[] = [
  { value: "cetak_ide", label: "Cetak Ide" },
  { value: "athaya", label: "Athaya Computer" },
];

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n || 0));
const digits = (s: string) => Number((s || "").replace(/\D/g, "")) || 0;
const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const orderTotal = (o: AdminOrder) => o.items.reduce((s, it) => s + it.qty * it.cost_price, 0);
const thisMonthYM = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

type SellRow = { sell: string; warranty: string; asset: boolean; active: boolean; existed: boolean };

export function OrdersClient({
  orders, clients, wallets, productFlags,
}: {
  orders: AdminOrder[];
  clients: ClientLite[];
  wallets: WalletWithBalance[];
  productFlags: Record<string, ProductFlag>;
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"menunggu" | "diterima">("menunggu");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Dialog Terima
  const [target, setTarget] = useState<AdminOrder | null>(null);
  const [rows, setRows] = useState<Record<string, SellRow>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Mode dropship (Terima + langsung jual)
  const [dropship, setDropship] = useState(false);
  const [clientId, setClientId] = useState("");
  const [method, setMethod] = useState<SaleMethod>("monthly_invoice");
  const [saleWalletId, setSaleWalletId] = useState("");
  const [period, setPeriod] = useState(thisMonthYM());
  const [brand, setBrand] = useState<Brand>("cetak_ide");

  const menunggu = useMemo(() => orders.filter((o) => o.status === "draft"), [orders]);
  const diterima = useMemo(() => orders.filter((o) => o.status === "accepted"), [orders]);
  const list = tab === "menunggu" ? menunggu : diterima;

  const clientItems = useMemo(
    () => clients.map((c) => ({ value: c.id, label: c.company_name })), [clients]);
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })), [wallets]);
  const paysNow = method === "cash" || method === "transfer";

  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function openAccept(o: AdminOrder) {
    setTarget(o);
    setNotes("");
    setDropship(false);
    setClientId("");
    setMethod("monthly_invoice");
    setSaleWalletId("");
    setPeriod(thisMonthYM());
    setBrand("cetak_ide");
    const init: Record<string, SellRow> = {};
    for (const it of o.items) {
      const f = productFlags[it.name.toLowerCase()];
      init[it.id] = {
        sell: "",
        warranty: "12",
        asset: f ? f.track_as_asset : true,
        active: f ? f.is_active : true,
        existed: !!f,
      };
    }
    setRows(init);
  }

  const sellTotal = target
    ? target.items.reduce((s, it) => s + it.qty * digits(rows[it.id]?.sell ?? ""), 0)
    : 0;
  const modalTotal = target ? orderTotal(target) : 0;

  async function doAccept() {
    if (!target) return;
    const sells = target.items.map((it) => digits(rows[it.id]?.sell ?? ""));
    if (sells.some((s) => s <= 0)) {
      toast.error("Isi harga jual semua barang (lebih dari 0).");
      return;
    }
    if (dropship && !clientId) {
      toast.error("Pilih client tujuan penjualan.");
      return;
    }
    if (dropship && paysNow && !saleWalletId) {
      toast.error("Pilih wallet penerima.");
      return;
    }

    setSaving(true);
    let res: { ok: boolean; error?: string };
    if (dropship) {
      res = await acceptOrderDropship({
        id: target.id,
        client_id: clientId,
        sale_method: method,
        sale_wallet_id: paysNow ? saleWalletId : null,
        period_month: method === "monthly_invoice" ? `${period}-01` : null,
        brand,
        extra_notes: notes.trim(),
        lines: target.items.map((it) => {
          const r = rows[it.id];
          return {
            item_id: it.id,
            selling_price: digits(r?.sell ?? ""),
            warranty_months: digits(r?.warranty ?? "") || 12,
            track_as_asset: r?.asset ?? true,
            is_active: r?.active ?? true,
          };
        }),
      });
    } else {
      // Terima biasa (pembelian saja) — harga jual jadi harga jual default produk.
      res = await acceptOrder({
        id: target.id,
        extra_notes: notes.trim(),
        lines: target.items.map((it) => ({
          item_id: it.id,
          selling_price: digits(rows[it.id]?.sell ?? ""),
          warranty_months: digits(rows[it.id]?.warranty ?? "") || 12,
        })),
      });
    }
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Gagal menerima.");
      return;
    }
    toast.success(
      dropship
        ? "Diterima & langsung terjual — hutang tercatat, penjualan dibuat."
        : "Pengajuan diterima — masuk stok & hutang."
    );
    setTarget(null);
  }

  async function onReject(o: AdminOrder) {
    const ok = await confirm({
      title: "Tolak pengajuan?",
      description: `${o.distributor_name} · "${o.destination ?? "-"}". Pengajuan ditandai ditolak.`,
      destructive: true,
      confirmText: "Tolak",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await rejectOrder(o.id);
      if (!res.ok) toast.error(res.error ?? "Gagal menolak.");
      else toast.success("Pengajuan ditolak.");
    });
  }

  async function onUnaccept(o: AdminOrder) {
    const ok = await confirm({
      title: "Batal Terima?",
      description:
        "Pembelian & stok akan dibalik, entri kembali ke Draft agar distributor bisa memperbaiki. Hanya bisa bila belum ada yang terjual & hutang belum dibayar.",
      destructive: true,
      confirmText: "Batal Terima",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await unacceptOrder(o.id);
      if (!res.ok) toast.error(res.error ?? "Gagal membatalkan.");
      else toast.success("Dibatalkan — kembali ke Draft.");
    });
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex rounded-lg border p-0.5 text-sm">
        {(["menunggu", "diterima"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "menunggu" ? "Menunggu" : "Diterima"}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === t ? "bg-primary-foreground/20" : "bg-muted"}`}>
              {t === "menunggu" ? menunggu.length : diterima.length}
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "menunggu" ? "Tidak ada pengajuan menunggu" : "Belum ada yang diterima"}
          description={tab === "menunggu" ? "Pengajuan baru dari distributor akan muncul di sini." : undefined}
        />
      ) : (
        <div className="space-y-2">
          {list.map((o) => {
            const isOpen = expanded.has(o.id);
            const total = orderTotal(o);
            return (
              <div key={o.id} className="rounded-lg border bg-background">
                <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => toggle(o.id)}>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        {o.distributor_name}
                      </span>
                      {o.status === "accepted" &&
                        (o.is_paid ? (
                          <Badge className="bg-emerald-600 text-white">Lunas</Badge>
                        ) : (
                          <Badge className="bg-sky-600 text-white">Diterima</Badge>
                        ))}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {o.destination || "Tanpa tujuan"} · {fmtDate(o.order_date)} · {o.items.length} barang
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums">{rp(total)}</p>
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
                        {o.items.map((it) => (
                          <tr key={it.id}>
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

                {/* Aksi */}
                <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
                  {o.status === "draft" ? (
                    <>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={pending} onClick={() => onReject(o)}>
                        <X className="h-4 w-4" /> Tolak
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => openAccept(o)}>
                        <Check className="h-4 w-4" /> Terima
                      </Button>
                    </>
                  ) : o.is_paid ? (
                    <span className="text-xs text-muted-foreground">Hutang sudah dibayar — terkunci.</span>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={pending} onClick={() => onUnaccept(o)}>
                      <Undo2 className="h-4 w-4" /> Batal Terima
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Terima */}
      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Terima Pengajuan</DialogTitle>
          </DialogHeader>

          {target && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{target.distributor_name}</p>
                <p className="text-xs text-muted-foreground">
                  Tujuan: {target.destination || "-"} · {fmtDate(target.order_date)}
                </p>
              </div>

              {/* Mode dropship */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <Switch checked={dropship} onCheckedChange={setDropship} className="mt-0.5" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Store className="h-4 w-4 text-muted-foreground" /> Langsung jual ke client (dropship)
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Barang dikirim langsung ke client — beli & jual sekaligus, stok bersih 0.
                    Nonaktif = hanya masuk stok &amp; hutang.
                  </span>
                </span>
              </label>

              {/* Panel penjualan (dropship) */}
              {dropship && (
                <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-500/25 dark:bg-sky-500/10">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Client tujuan *</Label>
                      <Select items={clientItems} value={clientId || null} onValueChange={(v) => setClientId(v ?? "")}>
                        <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                        <SelectContent>
                          {clientItems.map((it) => (
                            <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Brand (atas nama) *</Label>
                      <Select items={BRANDS} value={brand} onValueChange={(v) => setBrand((v ?? "cetak_ide") as Brand)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRANDS.map((it) => (
                            <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Metode bayar *</Label>
                      <Select items={METHODS} value={method} onValueChange={(v) => setMethod((v ?? "monthly_invoice") as SaleMethod)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METHODS.map((it) => (
                            <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {method === "monthly_invoice" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Periode invoice *</Label>
                        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Wallet penerima *</Label>
                        <Select items={walletItems} value={saleWalletId || null} onValueChange={(v) => setSaleWalletId(v ?? "")}>
                          <SelectTrigger><SelectValue placeholder="Pilih wallet" /></SelectTrigger>
                          <SelectContent>
                            {walletItems.map((it) => (
                              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  {method === "monthly_invoice" && (
                    <p className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-300">
                      <FileText className="h-3.5 w-3.5" /> Masuk invoice bulanan client (jadi piutang, belum menambah kas).
                    </p>
                  )}
                </div>
              )}

              {/* Tabel barang: harga jual + garansi (+ toggle katalog saat dropship) */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left font-medium">Barang</th>
                      <th className="px-2 py-2 text-center font-medium">Qty</th>
                      <th className="px-2 py-2 text-right font-medium">Modal</th>
                      <th className="px-2 py-2 text-right font-medium">Harga jual</th>
                      <th className="px-2 py-2 text-center font-medium">Garansi</th>
                      {dropship && <th className="px-2 py-2 text-center font-medium">Aset</th>}
                      {dropship && <th className="px-2 py-2 text-center font-medium">Aktif</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {target.items.map((it) => {
                      const r = rows[it.id] ?? { sell: "", warranty: "12", asset: true, active: true, existed: false };
                      return (
                        <tr key={it.id}>
                          <td className="px-2 py-1.5">
                            {it.name}
                            {dropship && r.existed && (
                              <span className="ml-1 text-[11px] text-muted-foreground">· produk lama</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums">{it.qty}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{rp(it.cost_price)}</td>
                          <td className="px-2 py-1.5">
                            <CurrencyInput
                              className="h-8 text-right"
                              value={r.sell}
                              onValueChange={(v) => setRows((p) => ({ ...p, [it.id]: { ...r, sell: v } }))}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-8 w-16 text-center"
                              inputMode="numeric"
                              value={r.warranty}
                              onChange={(e) =>
                                setRows((p) => ({ ...p, [it.id]: { ...r, warranty: e.target.value.replace(/\D/g, "") } }))
                              }
                            />
                          </td>
                          {dropship && (
                            <td className="px-2 py-1.5 text-center">
                              <Switch checked={r.asset}
                                onCheckedChange={(v) => setRows((p) => ({ ...p, [it.id]: { ...r, asset: v } }))} />
                            </td>
                          )}
                          {dropship && (
                            <td className="px-2 py-1.5 text-center">
                              <Switch checked={r.active}
                                onCheckedChange={(v) => setRows((p) => ({ ...p, [it.id]: { ...r, active: v } }))} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {dropship && (
                <p className="text-xs text-muted-foreground">
                  <b>Aset</b> &amp; <b>Aktif</b> = setelan katalog produk (sama dengan menu Stok Barang) —
                  berlaku untuk penjualan berikutnya, tidak mengubah nota yang sudah terjual.
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground">Modal</p>
                  <p className="font-semibold tabular-nums">{rp(modalTotal)}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground">Harga jual</p>
                  <p className="font-semibold tabular-nums">{rp(sellTotal)}</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-xs text-muted-foreground">Perkiraan laba</p>
                  <p className={`font-semibold tabular-nums ${sellTotal - modalTotal >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {rp(sellTotal - modalTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Catatan (opsional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Digabung dengan tujuan pada catatan pembelian."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {dropship ? (
                  <>Setelah diterima: barang masuk lalu <b>langsung terjual</b> ke client (stok bersih 0),
                    tercatat sebagai <b>hutang</b> ke distributor (jatuh tempo akhir bulan), dan penjualannya
                    masuk sesuai metode di atas.</>
                ) : (
                  <>Setelah diterima: barang masuk <b>stok</b>, tercatat sebagai <b>hutang</b> ke
                    distributor (jatuh tempo akhir bulan), dan siap dijual ke client.</>
                )}
              </p>
            </div>
          )}

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-sm">
              Laba: <b className="tabular-nums">{rp(sellTotal - modalTotal)}</b>
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
                Batal
              </Button>
              <Button onClick={doAccept} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Check className="h-4 w-4" /> {dropship ? "Terima & Jual" : "Terima"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
