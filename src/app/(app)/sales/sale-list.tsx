"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ReceiptText, Loader2, Search, RotateCcw, TrendingUp, Users, CheckCircle2, FileDown, Mail, ChevronRight, ChevronDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatIDR } from "@/lib/utils/currency";
import { formatDate, todayISO } from "@/lib/utils/date";
import { SOFT_TONES } from "@/lib/utils/soft-tone";
import { EmptyState } from "@/components/shared/empty-state";
import { SummaryCard } from "@/components/shared/summary-card";
import { StatCard } from "@/components/shared/stat-card";
import { usePagination } from "@/components/shared/use-pagination";
import { PaginationBar } from "@/components/shared/pagination-bar";
import type { ProductWithStock, Client, WalletWithBalance } from "@/types/db";
import { type SaleRow, type SaleItemRow, PAYMENT_METHOD_LABELS } from "@/types/phase3";
import { SendEmailDialog } from "@/components/shared/send-email-dialog";
import { SaleForm } from "./sale-form";
import { deleteSale, paySale, sendSaleEmail } from "./actions";

/** Baris penjualan yang boleh dikirim NOTA-nya (sama dgn syarat unduh NOTA). */
function canSendNota(s: SaleRow) {
  return s.payment_method === "cash" ||
    s.payment_method === "transfer" ||
    (s.payment_method === "terhutang" && !!s.paid_date);
}

/** Nama tampil item: nama jasa custom didahulukan, lalu nama produk (sama dgn NOTA). */
function itemLabel(it: SaleItemRow) {
  return it.item_name ?? it.product?.name ?? "-";
}
/** Item jasa = tidak punya produk katalog atau bernama custom "Jasa". */
function isServiceItem(it: SaleItemRow) {
  return it.item_name != null || it.product?.name === "Jasa";
}

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function monthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function lastMonthRange() {
  const now = new Date();
  return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
           to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) };
}

export function SaleList({
  sales, products, clients, wallets,
}: {
  sales: SaleRow[];
  products: ProductWithStock[];
  clients: Client[];
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Baris penjualan yang sedang dibuka (rincian item)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const [q, setQ] = useState("");
  const def = monthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  // Dialog pelunasan penjualan terhutang
  const [payRow, setPayRow] = useState<SaleRow | null>(null);
  const [payWallet, setPayWallet] = useState("");
  const [payDate, setPayDate] = useState(todayISO());

  // Dialog kirim NOTA via Gmail
  const [emailRow, setEmailRow] = useState<SaleRow | null>(null);
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );

  const filtered = useMemo(() => {
    const key = q.toLowerCase();
    return sales.filter((s) => {
      if (from && s.sale_date < from) return false;
      if (to && s.sale_date > to) return false;
      if (key) {
        const inClient = (s.client?.company_name ?? "").toLowerCase().includes(key);
        const inMethod = PAYMENT_METHOD_LABELS[s.payment_method].toLowerCase().includes(key);
        const inItem = (s.items ?? []).some((it) => itemLabel(it).toLowerCase().includes(key));
        if (!inClient && !inMethod && !inItem) return false;
      }
      return true;
    });
  }, [sales, q, from, to]);

  const pg = usePagination(filtered, 10, `${q}|${from}|${to}`);

  // total mengikuti rentang tanggal terpilih (default: bulan berjalan)
  const totalPeriod = filtered.reduce((s, x) => s + Number(x.total), 0);

  // Ringkasan turunan untuk kartu pendamping — murni tampilan, dihitung dari
  // `filtered` yang sudah ada. Tidak ada query atau perhitungan baru.
  const trxCount = filtered.length;
  const avgPerTrx = trxCount > 0 ? totalPeriod / trxCount : 0;
  const clientCount = new Set(
    filtered.map((s) => s.client?.company_name).filter(Boolean)
  ).size;

  const isThisMonth = from === def.from && to === def.to;
  const { compareTotal, percent, compareLabel } = useMemo(() => {
    const lm = lastMonthRange();
    const sumRange = (a: string, b: string) =>
      sales.filter((s) => s.sale_date >= a && s.sale_date <= b)
        .reduce((acc, s) => acc + Number(s.total), 0);
    const lastM = sumRange(lm.from, lm.to);
    const pct = lastM > 0 ? ((totalPeriod - lastM) / lastM) * 100 : (totalPeriod > 0 ? 100 : null);
    return {
      compareTotal: lastM,
      percent: pct,
      compareLabel: isThisMonth ? "Dari bulan lalu" : "Dibanding bulan lalu",
    };
  }, [sales, totalPeriod, isThisMonth]);

  function resetRange() { setFrom(def.from); setTo(def.to); setQ(""); }

  function handleDelete(s: SaleRow) {
    if (!confirm("Hapus penjualan ini? Stok dikembalikan, asset & transaksi terkait dibatalkan.")) return;
    startTransition(async () => {
      const res = await deleteSale(s.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Penjualan dihapus & efeknya dibatalkan.");
      router.refresh();
    });
  }

  function openPay(s: SaleRow) {
    setPayRow(s); setPayWallet(""); setPayDate(todayISO());
  }
  function handlePay() {
    if (!payRow) return;
    startTransition(async () => {
      const res = await paySale({ sale_id: payRow.id, wallet_id: payWallet, paid_date: payDate });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Penjualan dilunasi & saldo wallet bertambah.");
      setPayRow(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Baris ringkasan — semuanya ikut filter tanggal */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard
          title={isThisMonth ? "Total Penjualan Bulan Ini" : "Total Penjualan (Periode Dipilih)"}
          value={totalPeriod}
          icon={TrendingUp}
          tone="emerald"
          compareLabel={compareLabel}
          compareValue={compareTotal}
          percent={percent}
        />
        <StatCard
          label="Jumlah Transaksi"
          value={String(trxCount)}
          icon={ReceiptText}
          tone="blue"
          hint={`${clientCount} client berbeda`}
        />
        <StatCard
          label="Rata-rata per Transaksi"
          value={formatIDR(avgPerTrx)}
          icon={Users}
          tone="violet"
          hint={trxCount > 0 ? "Total dibagi jumlah transaksi" : "Belum ada transaksi"}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Client / barang / metode..."
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetRange} title="Kembali ke bulan ini">
            <RotateCcw className="h-4 w-4" /> Bulan Ini
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Penjualan Baru
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Tidak ada penjualan"
              description="Tidak ada penjualan pada rentang tanggal ini. Ubah filter atau catat penjualan baru." />
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-16 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.paged.map((s) => {
                  const isOpen = expanded.has(s.id);
                  const items = s.items ?? [];
                  return (
                  <Fragment key={s.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpand(s.id)}>
                    <TableCell className="pr-0 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell>{formatDate(s.sale_date)}</TableCell>
                    <TableCell className="font-medium">{s.client?.company_name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_method === "cash" || s.payment_method === "transfer"
                        ? "default" : "secondary"}>
                        {PAYMENT_METHOD_LABELS[s.payment_method]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.payment_method === "cash" || s.payment_method === "transfer" ? (
                        <Badge className={SOFT_TONES.emerald}>Lunas</Badge>
                      ) : s.payment_method === "monthly_invoice" ? (
                        <Badge variant="outline">Masuk invoice</Badge>
                      ) : s.paid_date ? (
                        <Badge className={SOFT_TONES.emerald}>Lunas</Badge>
                      ) : (
                        <Badge className={SOFT_TONES.amber}>Terhutang</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(Number(s.total))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {canSendNota(s) && (
                          <Button variant="ghost" size="icon" nativeButton={false}
                            className="text-muted-foreground hover:text-primary"
                            title="Unduh NOTA (PDF)"
                            render={<a href={`/api/sales/${s.id}/pdf`}
                              target="_blank" rel="noopener noreferrer" />}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                        )}
                        {canSendNota(s) && (
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-sky-600"
                            onClick={() => setEmailRow(s)} title="Kirim NOTA via Gmail">
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {s.payment_method === "terhutang" && !s.paid_date && (
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-emerald-600"
                            onClick={() => openPay(s)} disabled={pending} title="Tandai Lunas">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(s)} disabled={pending}>
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={7} className="p-0">
                        <div className="px-4 py-3">
                          {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Tidak ada rincian item.</p>
                          ) : (
                            <div className="divide-y rounded-lg border text-sm">
                              <div className="grid grid-cols-[1fr_3rem_8rem_9rem] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                <span>Nama</span>
                                <span className="text-center">Qty</span>
                                <span className="text-right">Harga satuan</span>
                                <span className="text-right">Subtotal</span>
                              </div>
                              {items.map((it, i) => (
                                <div key={i} className="grid grid-cols-[1fr_3rem_8rem_9rem] gap-2 px-3 py-1.5">
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    {isServiceItem(it) && <Wrench className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
                                    <span className="truncate">{itemLabel(it)}</span>
                                  </span>
                                  <span className="text-center tabular-nums">{it.qty}</span>
                                  <span className="text-right tabular-nums">{formatIDR(Number(it.price))}</span>
                                  <span className="text-right font-medium tabular-nums">
                                    {formatIDR(Number(it.qty) * Number(it.price))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationBar page={pg.page} totalPages={pg.totalPages}
              from={pg.from} to={pg.to} total={pg.total}
              onPageChange={pg.setPage} unit="transaksi" />
            </>
          )}
        </CardContent>
      </Card>

      <SaleForm open={open} onOpenChange={setOpen}
        products={products} clients={clients} wallets={wallets} />

      {/* Dialog pelunasan penjualan terhutang */}
      <Dialog open={payRow !== null} onOpenChange={(v) => !v && setPayRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tandai Lunas</DialogTitle>
          </DialogHeader>
          {payRow && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{payRow.client?.company_name ?? "-"}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Total piutang</span>
                  <span className="font-bold">{formatIDR(Number(payRow.total))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Wallet Penerima *</Label>
                <Select items={walletItems} value={payWallet || null}
                  onValueChange={(v) => setPayWallet(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih wallet" /></SelectTrigger>
                  <SelectContent>
                    {walletItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Bayar</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRow(null)}>Batal</Button>
            <Button onClick={handlePay} disabled={pending || !payWallet}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Lunasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog kirim NOTA via Gmail */}
      {emailRow && (
        <SendEmailDialog
          open={emailRow !== null}
          onOpenChange={(v) => !v && setEmailRow(null)}
          title="Kirim NOTA via Gmail"
          defaultTo={emailRow.client?.email ?? ""}
          defaultSubject={`NOTA PENJUALAN — ${emailRow.client?.company_name ?? "Pelanggan"} — ${formatDate(emailRow.sale_date)}`}
          defaultBody={
            `Selamat Pagi,\n\n` +
            `Berikut kami lampirkan nota penjualan tertanggal ${formatDate(emailRow.sale_date)}.\n\n` +
            `Terima kasih.`
          }
          attachmentName={`${(emailRow.nota_no ?? "NOTA").replace(/\//g, "-")}.pdf`}
          pdfHref={`/api/sales/${emailRow.id}/pdf`}
          sentInfo={{ at: emailRow.email_sent_at, to: emailRow.email_sent_to }}
          onSend={({ to, subject, body }) =>
            sendSaleEmail({ sale_id: emailRow.id, to, subject, body })
          }
        />
      )}
    </div>
  );
}
