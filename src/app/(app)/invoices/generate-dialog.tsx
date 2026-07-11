"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import type { Client } from "@/types/db";
import { generateInvoice } from "./actions";

type Receivable = { client_id: string; company_name: string; total: number; count: number };

export function GenerateDialog({
  clients, receivables,
}: {
  clients: Client[];
  receivables: Receivable[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [clientId, setClientId] = useState("");
  const now = new Date();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [dueDate, setDueDate] = useState("");

  // hanya client yang punya piutang
  const clientItems = useMemo(
    () => receivables.map((r) => ({
      value: r.client_id,
      label: `${r.company_name} · ${r.count} nota · ${formatIDR(r.total)}`,
    })),
    [receivables]
  );

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateInvoice({
        client_id: clientId,
        period_month: `${period}-01`,
        due_date: dueDate,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Invoice berhasil dibuat.");
      setOpen(false);
      setClientId("");
      router.refresh();
      if (res.invoiceId) router.push(`/invoices/${res.invoiceId}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={receivables.length === 0}>
        <FilePlus2 className="h-4 w-4" /> Buat Invoice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Invoice Bulanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sistem akan mengumpulkan semua penjualan piutang client pada periode
              yang dipilih menjadi satu invoice.
            </p>
            <div className="space-y-2">
              <Label>Client (punya piutang) *</Label>
              <Select items={clientItems} value={clientId || null}
                onValueChange={(v) => setClientId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                <SelectContent>
                  {clientItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Periode (bulan) *</Label>
                <Input type="month" value={period}
                  onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jatuh Tempo</Label>
                <Input type="date" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleGenerate} disabled={pending || !clientId}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Buat Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
