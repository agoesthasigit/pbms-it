"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Receipt, CalendarDays, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { formatIDR } from "@/lib/utils/currency";
import { toNumber } from "@/lib/utils/number";
import type { ChargeRow } from "@/types/maintenance";
import { issueCharges, cancelCharge } from "../actions";

// "2026-07-01" -> "2026-07"
const toMonthInput = (period: string) => period.slice(0, 7);
// "2026-07" -> "2026-07-01"
const toPeriod = (month: string) => `${month}-01`;

const periodLabel = (period: string) =>
  new Date(period).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export function IssueManager({
  period, rows,
}: {
  period: string;      // YYYY-MM-01
  rows: ChargeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [month, setMonth] = useState(toMonthInput(period));
  // pilihan & nominal per kontrak (hanya untuk yang belum ditagih)
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // saat periode berganti, isi ulang nominal bawaan & reset centang
  useEffect(() => {
    const initAmounts: Record<string, string> = {};
    const initPicked: Record<string, boolean> = {};
    for (const r of rows) {
      if (!r.issued_sale_id) {
        initAmounts[r.contract_id] = String(r.monthly_amount);
        initPicked[r.contract_id] = true; // default tercentang, tinggal batalkan bila perlu
      }
    }
    setAmounts(initAmounts);
    setPicked(initPicked);
    setMonth(toMonthInput(period));
  }, [period, rows]);

  const pendingRows = rows.filter((r) => !r.issued_sale_id);
  const issuedRows = rows.filter((r) => r.issued_sale_id);

  const selected = pendingRows.filter((r) => picked[r.contract_id]);
  const selectedTotal = selected.reduce(
    (s, r) => s + toNumber(amounts[r.contract_id] ?? "0"), 0
  );

  function changePeriod() {
    if (!month) return;
    router.push(`/maintenance/issue?period=${toPeriod(month)}`);
  }

  function handleIssue() {
    const charges = selected.map((r) => ({
      contract_id: r.contract_id,
      amount: toNumber(amounts[r.contract_id] ?? "0"),
    }));
    if (charges.some((c) => c.amount <= 0)) {
      toast.error("Nominal tagihan harus lebih dari 0.");
      return;
    }
    startTransition(async () => {
      const res = await issueCharges({ period, charges });
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        `${res.count ?? charges.length} tagihan diterbitkan & masuk invoice bulanan.`
      );
      router.refresh();
    });
  }

  function handleCancel(r: ChargeRow) {
    if (!r.issued_sale_id) return;
    if (!confirm(
      `Batalkan tagihan "${r.service_name}" untuk ${r.company_name} periode ${periodLabel(period)}?\n\n` +
      `Tagihan akan dilepas dari invoice dan total invoice dihitung ulang.`
    )) return;
    startTransition(async () => {
      const res = await cancelCharge(r.issued_sale_id!);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Tagihan dibatalkan.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Pemilih periode */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-2">
            <Label>Periode Tagihan</Label>
            <Input type="month" value={month} className="w-44"
              onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button variant="outline" onClick={changePeriod}>
            <CalendarDays className="h-4 w-4" /> Tampilkan
          </Button>
          <p className="ml-auto text-sm text-muted-foreground">
            Menampilkan periode <b className="text-foreground">{periodLabel(period)}</b>
          </p>
        </CardContent>
      </Card>

      {/* Belum ditagih */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Belum ditagih ({pendingRows.length})
            </h3>
            {pendingRows.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Centang yang mau ditagih, nominal bisa diubah untuk bulan ini saja.
              </span>
            )}
          </div>

          {pendingRows.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
              Semua kontrak aktif sudah ditagih untuk periode ini.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingRows.map((r) => (
                <div key={r.contract_id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <input type="checkbox"
                    className="h-4 w-4 shrink-0 accent-teal-700"
                    checked={!!picked[r.contract_id]}
                    onChange={(e) =>
                      setPicked((p) => ({ ...p, [r.contract_id]: e.target.checked }))
                    } />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.company_name}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {r.service_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rp</span>
                    <Input type="number" min={0} className="w-36 text-right"
                      value={amounts[r.contract_id] ?? ""}
                      onChange={(e) =>
                        setAmounts((a) => ({ ...a, [r.contract_id]: e.target.value }))
                      } />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sudah ditagih */}
      {issuedRows.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <h3 className="text-sm font-semibold">
              Sudah ditagih ({issuedRows.length})
            </h3>
            {issuedRows.map((r) => (
              <div key={r.contract_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-strong" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.company_name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {r.service_name}
                  </p>
                </div>
                {r.invoice_no && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {r.invoice_no}
                  </Badge>
                )}
                <span className="font-medium">
                  {formatIDR(Number(r.issued_amount ?? 0))}
                </span>
                <Button variant="ghost" size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleCancel(r)} disabled={pending}>
                  <Undo2 className="h-3.5 w-3.5" /> Batalkan
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={Receipt} title="Belum ada kontrak aktif"
              description="Buat kontrak maintenance dulu di halaman Kontrak Maintenance." />
          </CardContent>
        </Card>
      )}

      {/* Aksi */}
      {pendingRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted px-4 py-3">
          <span className="text-sm">
            {selected.length} kontrak dipilih ·{" "}
            <b className="text-base">{formatIDR(selectedTotal)}</b>
          </span>
          <Button onClick={handleIssue} disabled={pending || selected.length === 0}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            Terbitkan Tagihan
          </Button>
        </div>
      )}
    </div>
  );
}
