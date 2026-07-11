"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Send, Download, FileText } from "lucide-react";
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
import { todayISO } from "@/lib/utils/date";
import type { WalletWithBalance } from "@/types/db";
import type { MonthlyInvoice } from "@/types/phase4";
import { markInvoicePaid, setInvoiceStatus } from "../actions";

export function InvoiceActions({
  invoice, wallets,
}: {
  invoice: MonthlyInvoice;
  wallets: WalletWithBalance[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paidOpen, setPaidOpen] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());

  const isPaid = invoice.status === "paid";
  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );

  function handleStatus(status: "draft" | "sent") {
    startTransition(async () => {
      const res = await setInvoiceStatus(invoice.id, status);
      if (res.error) { toast.error(res.error); return; }
      toast.success(status === "sent" ? "Ditandai terkirim." : "Dikembalikan ke draft.");
      router.refresh();
    });
  }

  function handlePaid() {
    startTransition(async () => {
      const res = await markInvoicePaid({
        invoice_id: invoice.id, wallet_id: walletId, paid_date: paidDate,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Invoice lunas. Pemasukan masuk ke wallet.");
      setPaidOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* PDF: buka route handler di tab baru */}
      <Button variant="outline" nativeButton={false}
        render={<a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer" />}>
        <Download className="h-4 w-4" /> Unduh PDF
      </Button>

      {!isPaid && invoice.status !== "sent" && (
        <Button variant="outline" onClick={() => handleStatus("sent")} disabled={pending}>
          <Send className="h-4 w-4" /> Tandai Terkirim
        </Button>
      )}
      {!isPaid && invoice.status === "sent" && (
        <Button variant="outline" onClick={() => handleStatus("draft")} disabled={pending}>
          <FileText className="h-4 w-4" /> Kembali ke Draft
        </Button>
      )}
      {!isPaid && (
        <Button onClick={() => setPaidOpen(true)} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" /> Tandai Lunas
        </Button>
      )}

      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tandai Invoice Lunas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Total ditagih</p>
              <p className="text-xl font-bold">{formatIDR(Number(invoice.total))}</p>
            </div>
            <div className="space-y-2">
              <Label>Wallet Penerima *</Label>
              <Select items={walletItems} value={walletId || null}
                onValueChange={(v) => setWalletId(v ?? "")}>
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
              <Input type="date" value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidOpen(false)}>Batal</Button>
            <Button onClick={handlePaid} disabled={pending || !walletId}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Konfirmasi Lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
