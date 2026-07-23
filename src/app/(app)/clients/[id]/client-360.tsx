"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Boxes, Wifi, Camera, Calculator, Wrench, ShieldCheck, TrendingUp,
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
import type { Client } from "@/types/db";
import {
  type ClientAsset, type WarrantyStatus,
  WARRANTY_STATUS_LABELS, WARRANTY_STATUS_STYLE,
} from "@/types/phase5";

type Stats = {
  total_sales: number; total_paid: number; total_receivable: number;
  asset_count: number; project_count: number; total_project_profit: number;
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

  const [stats, setStats] = useState<Stats | null>(null);
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
      const [statRes, monRes, assetRes, netRes, cctvRes, rabRes, invRes, repRes] =
        await Promise.all([
          supabase.rpc("client_stats", { p_client_id: client.id }),
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
      setStats((statRes.data?.[0] as Stats) ?? null);
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

  const targetLabel: Record<string, string> = { asset: "Asset", network: "Network", cctv: "CCTV" };

  return (
    <div className="space-y-6">
      {/* Profil + statistik */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Penjualan" icon={TrendingUp}
          value={loading ? "…" : formatIDR(Number(stats?.total_sales ?? 0))} />
        <StatCard label="Sudah Dibayar" accent="text-emerald-600"
          value={loading ? "…" : formatIDR(Number(stats?.total_paid ?? 0))} />
        <StatCard label="Piutang Berjalan"
          accent={Number(stats?.total_receivable ?? 0) > 0 ? "text-amber-600" : undefined}
          value={loading ? "…" : formatIDR(Number(stats?.total_receivable ?? 0))} />
        <StatCard label="Laba Proyek (RAB)"
          value={loading ? "…" : formatIDR(Number(stats?.total_project_profit ?? 0))} />
      </div>

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
              ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Aktif</Badge>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(v: number) => `${(Number(v) / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={tipFormat as never} />
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
