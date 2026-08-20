"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Boxes, Wifi, Camera, Calculator, Wrench, ShieldCheck, TrendingUp, TrendingDown,
  ShoppingCart, Coins, Wallet, HandCoins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/utils/currency";

// Formatter tooltip Recharts yang aman terhadap tipe ValueType (bisa undefined)
const tipFormat = (v: unknown) => formatIDR(Number(v ?? 0));
import { formatDate } from "@/lib/utils/date";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PeriodPicker, presetThisMonth, type Period } from "@/components/shared/period-picker";
import type { Client } from "@/types/db";
import {
  type ClientAsset, type WarrantyStatus,
  WARRANTY_STATUS_LABELS, WARRANTY_STATUS_STYLE,
} from "@/types/phase5";

// Baris penjualan mentah untuk hitung 6 kartu client-side (ikut filter tanggal).
type SaleRaw = {
  sale_date: string;
  payment_method: "cash" | "transfer" | "monthly_invoice" | "terhutang";
  paid_date: string | null;
  sale_items: { qty: number; subtotal: number; cost_price: number }[];
};
type MonthlyProfit = { month_start: string; revenue: number };
type RepairRow = {
  id: string; target: string; target_name: string;
  repair_date: string; problem: string; action_taken: string | null; cost: number;
};
type NetworkRow = { id: string; ssid: string; device_name: string | null; location: string | null };
type CctvRow = { id: string; nvr_brand: string; channel_count: number; location: string | null };
type RabRow = {
  id: string; project_name: string; project_date: string; status: string;
  grand_total_rab: number; net_profit: number;
};
type InvoiceRow = {
  id: string; invoice_no: string; period_month: string;
  total: number; effective_status: string;
};

const shortMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

export function Client360({ client }: { client: Client }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(presetThisMonth());

  const [salesRaw, setSalesRaw] = useState<SaleRaw[]>([]);
  const [monthly, setMonthly] = useState<MonthlyProfit[]>([]);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [cctvs, setCctvs] = useState<CctvRow[]>([]);
  const [rabs, setRabs] = useState<RabRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [repairs, setRepairs] = useState<RepairRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [saleRes, monRes, assetRes, netRes, cctvRes, rabRes, invRes, repRes] =
        await Promise.all([
          supabase.from("sales")
            .select("sale_date, payment_method, paid_date, sale_items(qty, subtotal, cost_price)")
            .eq("client_id", client.id),
          supabase.rpc("client_monthly_profit", { p_client_id: client.id, p_months: 12 }),
          supabase.from("v_client_assets").select("*").eq("client_id", client.id)
            .order("warranty_end"),
          supabase.from("v_network_credentials").select("id, ssid, device_name, location")
            .eq("client_id", client.id),
          supabase.from("v_cctv_systems").select("id, nvr_brand, channel_count, location")
            .eq("client_id", client.id),
          supabase.from("v_rab_summary").select("id, project_name, project_date, status, grand_total_rab, net_profit")
            .eq("client_id", client.id).order("project_date", { ascending: false }),
          supabase.from("v_monthly_invoices").select("id, invoice_no, period_month, total, effective_status")
            .eq("client_id", client.id).order("period_month", { ascending: false }),
          supabase.rpc("client_repair_history", { p_client_id: client.id }),
        ]);
      if (!active) return;
      setSalesRaw((saleRes.data as SaleRaw[]) ?? []);
      setMonthly((monRes.data as MonthlyProfit[]) ?? []);
      setAssets((assetRes.data as ClientAsset[]) ?? []);
      setNetworks((netRes.data as NetworkRow[]) ?? []);
      setCctvs((cctvRes.data as CctvRow[]) ?? []);
      setRabs((rabRes.data as RabRow[]) ?? []);
      setInvoices((invRes.data as InvoiceRow[]) ?? []);
      setRepairs((repRes.data as RepairRow[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase, client.id]);

  const chartData = monthly.map((m) => ({
    name: shortMonth(m.month_start), Omzet: Number(m.revenue),
  }));

  // 6 kartu ringkasan — dihitung client-side & ikut filter tanggal.
  // Penjualan yang dihitung: LUNAS (tunai/transfer/terhutang-lunas) + invoice
  // bulanan; terhutang belum lunas dikecualikan. Modal memakai cost_price yang
  // terkunci saat penjualan (bukan harga beli terkini). Laba proyek: RAB
  // berstatus "Selesai" (done) yang tanggal proyeknya masuk rentang.
  const summary = useMemo(() => {
    const inRange = (d: string | null) => !!d && d >= period.from && d <= period.to;
    const counted = salesRaw.filter((s) => {
      if (!inRange(s.sale_date)) return false;
      const m = s.payment_method;
      if (m === "cash" || m === "transfer" || m === "monthly_invoice") return true;
      return m === "terhutang" && !!s.paid_date;
    });
    let penjualan = 0, pembelian = 0;
    for (const s of counted) {
      for (const it of s.sale_items ?? []) {
        penjualan += Number(it.subtotal);
        pembelian += Number(it.cost_price ?? 0) * Number(it.qty);
      }
    }
    const labaJual = penjualan - pembelian;
    const labaProyek = rabs
      .filter((r) => r.status === "done" && inRange(r.project_date))
      .reduce((a, r) => a + Number(r.net_profit), 0);
    const totalLaba = labaProyek + labaJual;
    const margin = penjualan > 0 ? (totalLaba / penjualan) * 100 : null;
    return { penjualan, pembelian, labaJual, labaProyek, totalLaba, margin };
  }, [salesRaw, rabs, period]);

  // Piutang berjalan (snapshot SAAT INI — tidak ikut filter periode): invoice
  // bulanan belum lunas + penjualan terhutang belum lunas untuk client ini.
  const piutang = useMemo(() => {
    const invoice = invoices
      .filter((i) => i.effective_status !== "paid")
      .reduce((a, i) => a + Number(i.total), 0);
    const terhutang = salesRaw
      .filter((s) => s.payment_method === "terhutang" && !s.paid_date)
      .reduce((a, s) => a + (s.sale_items ?? [])
        .reduce((b, it) => b + Number(it.subtotal), 0), 0);
    return { invoice, terhutang, total: invoice + terhutang };
  }, [invoices, salesRaw]);

  const targetLabel: Record<string, string> = { asset: "Asset", network: "Network", cctv: "CCTV" };

  return (
    <div className="space-y-6">
      {/* Filter periode — default bulan ini; 6 kartu di bawah ikut menyesuaikan */}
      <PeriodPicker period={period} onChange={setPeriod} />

      {/* 6 kartu ringkasan (mengikuti rentang tanggal) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Pembelian (Modal)" icon={ShoppingCart} tone="blue"
          value={loading ? "…" : formatIDR(summary.pembelian)} />
        <StatCard label="Total Penjualan" icon={TrendingUp} tone="emerald"
          value={loading ? "…" : formatIDR(summary.penjualan)} />
        <StatCard label="Laba (Jual − Beli)" icon={Coins}
          tone={summary.labaJual >= 0 ? "emerald" : "red"}
          accent={summary.labaJual >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : formatIDR(summary.labaJual)} />
        <StatCard label="Laba Proyek (RAB Selesai)" icon={Calculator} tone="violet"
          value={loading ? "…" : formatIDR(summary.labaProyek)} />
        <StatCard label="Total Laba Keseluruhan" icon={Wallet}
          tone={summary.totalLaba >= 0 ? "emerald" : "red"}
          accent={summary.totalLaba >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : formatIDR(summary.totalLaba)} />
        <StatCard label="Margin"
          icon={(summary.margin ?? 0) >= 0 ? TrendingUp : TrendingDown}
          tone={(summary.margin ?? 0) >= 0 ? "emerald" : "red"}
          accent={(summary.margin ?? 0) >= 0 ? "text-emerald-600" : "text-destructive"}
          value={loading ? "…" : summary.margin === null ? "—" : `${summary.margin.toFixed(1)}%`}
          hint="Total Laba ÷ Total Penjualan" />
      </div>

      {/* Piutang berjalan — snapshot saat ini (tidak ikut filter periode) */}
      {!loading && piutang.total > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <HandCoins className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Piutang berjalan (belum diterima)</p>
                <p className="text-2xl font-bold tracking-tight text-amber-600">
                  {formatIDR(piutang.total)}
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Invoice belum lunas {formatIDR(piutang.invoice)} · Terhutang {formatIDR(piutang.terhutang)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info kontak */}
      <Card>
        <CardHeader><CardTitle className="text-base">Profil Client</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Perusahaan:</span> {client.company_name}</div>
          <div><span className="text-muted-foreground">PIC:</span> {client.contact_name ?? "-"}</div>
          <div><span className="text-muted-foreground">Telepon:</span> {client.phone ?? "-"}</div>
          <div><span className="text-muted-foreground">Email:</span> {client.email ?? "-"}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Alamat:</span> {client.address ?? "-"}</div>
          <div><span className="text-muted-foreground">Status:</span>{" "}
            {client.status === "active"
              ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/15">Aktif</Badge>
              : <Badge variant="outline">Nonaktif</Badge>}
          </div>
          <div><span className="text-muted-foreground">Bergabung:</span> {client.joined_date ? formatDate(client.joined_date) : "-"}</div>
          {client.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Catatan:</span> {client.notes}</div>}
        </CardContent>
      </Card>

      {/* Omzet bulanan */}
      <Card>
        <CardHeader><CardTitle className="text-base">Omzet per Bulan (12 bulan)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12}
                  stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" tick={{ fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                <Bar dataKey="Omzet" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tab detail */}
      <Tabs defaultValue="assets">
        <TabsList className="flex-wrap">
          <TabsTrigger value="assets"><Boxes className="mr-1 h-3.5 w-3.5" /> Asset</TabsTrigger>
          <TabsTrigger value="network"><Wifi className="mr-1 h-3.5 w-3.5" /> Network</TabsTrigger>
          <TabsTrigger value="cctv"><Camera className="mr-1 h-3.5 w-3.5" /> CCTV</TabsTrigger>
          <TabsTrigger value="rab"><Calculator className="mr-1 h-3.5 w-3.5" /> RAB</TabsTrigger>
          <TabsTrigger value="invoices"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Invoice</TabsTrigger>
          <TabsTrigger value="repairs"><Wrench className="mr-1 h-3.5 w-3.5" /> Perbaikan</TabsTrigger>
        </TabsList>

        {/* ASSET */}
        <TabsContent value="assets">
          <Card><CardContent className="p-0">
            {assets.length === 0 ? (
              <EmptyState icon={Boxes} title="Belum ada asset" />
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Barang</TableHead><TableHead>Serial</TableHead>
                  <TableHead>Garansi s/d</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {assets.map((a) => {
                    const st = (a.warranty_status ?? "active") as WarrantyStatus;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.product_name}</TableCell>
                        <TableCell>{a.serial_number ?? "-"}</TableCell>
                        <TableCell>{formatDate(a.warranty_end)}</TableCell>
                        <TableCell><Badge className={WARRANTY_STATUS_STYLE[st]}>{WARRANTY_STATUS_LABELS[st]}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* NETWORK */}
        <TabsContent value="network">
          <Card><CardContent className="p-0">
            {networks.length === 0 ? <EmptyState icon={Wifi} title="Belum ada data network" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>SSID</TableHead><TableHead>Perangkat</TableHead><TableHead>Lokasi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {networks.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.ssid}</TableCell>
                      <TableCell>{n.device_name ?? "-"}</TableCell>
                      <TableCell>{n.location ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* CCTV */}
        <TabsContent value="cctv">
          <Card><CardContent className="p-0">
            {cctvs.length === 0 ? <EmptyState icon={Camera} title="Belum ada data CCTV" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Merk NVR/DVR</TableHead><TableHead className="text-center">Channel</TableHead>
                  <TableHead>Lokasi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {cctvs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nvr_brand}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{c.channel_count} CH</Badge></TableCell>
                      <TableCell>{c.location ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* RAB */}
        <TabsContent value="rab">
          <Card><CardContent className="p-0">
            {rabs.length === 0 ? <EmptyState icon={Calculator} title="Belum ada proyek RAB" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Proyek</TableHead><TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Nilai RAB</TableHead>
                  <TableHead className="text-right">Laba</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rabs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.project_name}</TableCell>
                      <TableCell>{formatDate(r.project_date)}</TableCell>
                      <TableCell className="text-right">{formatIDR(Number(r.grand_total_rab))}</TableCell>
                      <TableCell className={`text-right font-medium ${Number(r.net_profit) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatIDR(Number(r.net_profit))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* INVOICE */}
        <TabsContent value="invoices">
          <Card><CardContent className="p-0">
            {invoices.length === 0 ? <EmptyState icon={ShieldCheck} title="Belum ada invoice" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>No. Invoice</TableHead><TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                      <TableCell>{new Date(inv.period_month).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</TableCell>
                      <TableCell>
                        <Badge variant={inv.effective_status === "paid" ? "default" : "outline"}>
                          {inv.effective_status === "paid" ? "Lunas" : inv.effective_status === "overdue" ? "Jatuh tempo" : "Belum lunas"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatIDR(Number(inv.total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* PERBAIKAN gabungan */}
        <TabsContent value="repairs">
          <Card><CardContent className="p-0">
            {repairs.length === 0 ? <EmptyState icon={Wrench} title="Belum ada riwayat perbaikan" /> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tanggal</TableHead><TableHead>Jenis</TableHead>
                  <TableHead>Objek</TableHead><TableHead>Masalah</TableHead>
                  <TableHead className="text-right">Biaya</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {repairs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.repair_date)}</TableCell>
                      <TableCell><Badge variant="secondary">{targetLabel[r.target] ?? r.target}</Badge></TableCell>
                      <TableCell>{r.target_name ?? "-"}</TableCell>
                      <TableCell className="max-w-52 truncate">{r.problem}</TableCell>
                      <TableCell className="text-right">{r.cost > 0 ? formatIDR(Number(r.cost)) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
