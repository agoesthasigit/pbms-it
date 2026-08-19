"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Loader2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SOFT_TONES } from "@/lib/utils/soft-tone";

type Check = { code: string; label: string; count: number };

export function DataCheck() {
  const [rows, setRows] = useState<Check[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("data_integrity_report");
    if (error) { setError(error.message); setLoading(false); return; }
    setRows((data as Check[]) ?? []);
    setRanAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  const issues = (rows ?? []).filter((r) => r.count > 0);
  const allClear = rows !== null && issues.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {ranAt
            ? `Diperiksa: ${ranAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : "Menjalankan pemeriksaan…"}
        </p>
        <Button variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Periksa Ulang
        </Button>
      </div>

      {/* Ringkasan status */}
      {rows !== null && (
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            {allClear ? (
              <>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-success">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-success">Data sehat</p>
                  <p className="text-sm text-muted-foreground">
                    Semua {rows.length} pemeriksaan lolos — tidak ada anomali.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-destructive">
                    {issues.length} pemeriksaan menemukan masalah
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Lihat rincian di bawah, lalu beri tahu untuk ditindaklanjuti.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card><CardContent className="py-4 text-sm text-destructive">
          Gagal menjalankan pemeriksaan: {error}
        </CardContent></Card>
      )}

      {/* Daftar pemeriksaan */}
      {rows !== null && (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((r) => {
              const bad = r.count > 0;
              return (
                <div key={r.code} className="flex items-center gap-3 px-4 py-2.5">
                  {bad ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  )}
                  <span className="flex-1 text-sm">
                    <span className="mr-2 text-xs font-mono text-muted-foreground">{r.code}</span>
                    {r.label}
                  </span>
                  {bad ? (
                    <Badge className={SOFT_TONES.red}>{r.count} masalah</Badge>
                  ) : (
                    <Badge className={SOFT_TONES.emerald}>Aman</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Pemeriksaan ini hanya membaca data (tidak mengubah apa pun) dan hanya melihat data Anda sendiri.
      </p>
    </div>
  );
}
