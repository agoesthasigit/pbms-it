"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Send, Download, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import { SendEmailDialog } from "@/components/shared/send-email-dialog";
import type { WalletWithBalance } from "@/types/db";
import type { MonthlyInvoice } from "@/types/phase4";
import { markInvoicePaid, setInvoiceStatus, sendInvoiceEmail } from "../actions";

export function InvoiceActions({
  invoice, wallets, serviceBase,
}: {
  invoice: MonthlyInvoice;
  wallets: WalletWithBalance[];
  /** Nilai JASA di invoice ini — jadi usulan dasar kena pajak PPh 23. */
  serviceBase: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paidOpen, setPaidOpen] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [paidDate, setPaidDate] = useState(todayISO());
  const [emailOpen, setEmailOpen] = useState(false);

  // PPh 23: aktif otomatis bila invoice mengandung jasa (barang tidak kena).
  const [pphOn, setPphOn] = useState(serviceBase > 0);
  const [pphBase, setPphBase] = useState(String(serviceBase || ""));
  const [pphRate, setPphRate] = useState("2.5");

  const bruto = Number(invoice.total);
  const base = pphOn ? toNumber(pphBase) : 0;
  const rate = pphOn ? toNumber(pphRate) : 0;
  const pph = Math.round((base * rate) / 100);
  const netto = bruto - pph;
  const baseTooBig = base > bruto;

  const isPaid = invoice.status === "paid";

  // Default subject/isi email — ikut BULAN PERIODE invoice (bukan bulan kirim)
  const periodLabel = useMemo(
    () => new Date(invoice.period_month).toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    [invoice.period_month]
  );
  const emailDefaults = useMemo(() => ({
    to: invoice.client_email ?? "",
    subject: `INVOICE ${periodLabel.toUpperCase()}`,
    body:
      `Selamat Pagi,\n\n` +
      `Berikut kami lampirkan invoice perbaikan serta pembelian pada bulan ${periodLabel.toLowerCase()}.\n\n` +
      `Terima kasih.`,
  }), [invoice.client_email, periodLabel]);
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
        pph_base: base, pph_rate: rate || 2.5,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        pph > 0
          ? `Invoice lunas. ${formatIDR(netto)} masuk wallet (PPh 23 ${formatIDR(pph)} dipotong client).`
          : "Invoice lunas. Pemasukan masuk ke wallet."
      );
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

      <Button variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="h-4 w-4" /> Kirim via Gmail
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
              <p className="text-sm text-muted-foreground">Total ditagih (bruto)</p>
              <p className="text-xl font-bold">{formatIDR(bruto)}</p>
            </div>

            {/* PPh 23 — invoice tetap ditagih penuh, client memotong pajaknya */}
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Client memotong PPh 23</p>
                  <p className="text-xs text-muted-foreground">
                    Hanya atas nilai jasa — penjualan barang tidak kena.
                  </p>
                </div>
                <Switch checked={pphOn} onCheckedChange={setPphOn} />
              </div>

              {pphOn && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Dasar kena pajak (jasa)</Label>
                      <CurrencyInput value={pphBase}
                        className={baseTooBig ? "border-destructive" : ""}
                        onValueChange={setPphBase} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tarif (%)</Label>
                      <Input type="number" min={0} step="0.1" value={pphRate}
                        onChange={(e) => setPphRate(e.target.value)} />
                    </div>
                  </div>
                  {serviceBase > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nilai jasa di invoice ini: <b>{formatIDR(serviceBase)}</b> (terisi otomatis).
                    </p>
                  )}
                  {baseTooBig && (
                    <p className="text-xs text-destructive">
                      Dasar kena pajak melebihi total invoice.
                    </p>
                  )}
                </>
              )}

              <div className="space-y-1 border-t border-amber-200 pt-2 text-sm dark:border-amber-500/25">
                <div className="flex justify-between text-muted-foreground">
                  <span>PPh 23 dipotong</span>
                  <span>− {formatIDR(pph)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Uang masuk wallet</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatIDR(netto)}</span>
                </div>
              </div>
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
            <Button onClick={handlePaid} disabled={pending || !walletId || baseTooBig}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Konfirmasi Lunas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title="Kirim Invoice via Gmail"
        defaultTo={emailDefaults.to}
        defaultSubject={emailDefaults.subject}
        defaultBody={emailDefaults.body}
        attachmentName={`${invoice.invoice_no.replace(/\//g, "-")}.pdf`}
        pdfHref={`/api/invoices/${invoice.id}/pdf`}
        sentInfo={{ at: invoice.email_sent_at, to: invoice.email_sent_to }}
        onSend={({ to, subject, body }) =>
          sendInvoiceEmail({ invoice_id: invoice.id, to, subject, body })
        }
      />
    </div>
  );
}
