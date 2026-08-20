"use client";

import { useState } from "react";
import { FileText, Mail, CheckCircle2, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { EmptyState } from "@/components/shared/empty-state";
import { SOFT_TONES } from "@/lib/utils/soft-tone";
import { SendEmailDialog } from "@/components/shared/send-email-dialog";
import { sendHutangPaymentEmail } from "../purchases/actions";

export type HutangPayment = {
  key: string;
  ids: string[];
  distributor_name: string;
  distributor_email: string | null;
  paid_date: string;
  wallet_name: string;
  notas: { invoiceNo: string; total: number }[];
  total: number;
  email_sent_at: string | null;
  email_sent_to: string | null;
};

/** Susun isi email default (subjek B: distributor + tanggal). */
function buildBody(p: HutangPayment): string {
  const list = p.notas
    .map((n) => `- ${n.invoiceNo || "Tanpa nota"}: ${formatIDR(n.total)}`)
    .join("\n");
  return [
    "Dengan hormat,",
    "",
    "Kami ingin menginformasikan bahwa pembayaran atas tagihan berikut telah kami lakukan dan telah diselesaikan secara penuh:",
    "",
    "Detail Pembayaran",
    list,
    "",
    `Total Dibayarkan: ${formatIDR(p.total)}`,
    `Tanggal Pembayaran: ${formatDate(p.paid_date)}`,
    "Status: LUNAS",
    "",
    "Dengan demikian, kewajiban pembayaran kami atas tagihan tersebut telah dilunasi sepenuhnya.",
    "",
    "Mohon dapat dikonfirmasi apabila pembayaran telah diterima di rekening Bapak/Ibu.",
    "",
    "Terima kasih atas kerja sama dan kepercayaannya.",
  ].join("\n");
}

export function RiwayatBayarClient({ payments }: { payments: HutangPayment[] }) {
  const [emailFor, setEmailFor] = useState<HutangPayment | null>(null);

  if (payments.length === 0) {
    return (
      <EmptyState icon={Receipt} title="Belum ada pembayaran hutang"
        description="Riwayat pelunasan hutang akan muncul di sini." />
    );
  }

  return (
    <div className="space-y-4">
      {payments.map((p) => (
        <Card key={p.key}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{p.distributor_name}</p>
                {p.email_sent_at ? (
                  <Badge variant="outline" className={SOFT_TONES.emerald}>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Email terkirim
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(p.paid_date)} · {p.notas.length} nota · via {p.wallet_name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.notas.map((n) => n.invoiceNo || "—").join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total dibayar</div>
                <div className="text-lg font-bold">{formatIDR(p.total)}</div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" nativeButton={false}
                  render={<a href={`/api/hutang-payment/pdf?ids=${p.ids.join(",")}`}
                    target="_blank" rel="noopener noreferrer" />}>
                  <FileText className="h-4 w-4" /> Bukti
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmailFor(p)}>
                  <Mail className="h-4 w-4" /> Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {emailFor && (
        <SendEmailDialog
          open={!!emailFor}
          onOpenChange={(v) => { if (!v) setEmailFor(null); }}
          title="Kirim Bukti Pelunasan Hutang"
          defaultTo={emailFor.distributor_email ?? ""}
          defaultSubject={`Pemberitahuan Pelunasan Hutang — ${emailFor.distributor_name} — ${formatDate(emailFor.paid_date)}`}
          defaultBody={buildBody(emailFor)}
          attachmentName={`BuktiBayar-${emailFor.distributor_name}.pdf`}
          pdfHref={`/api/hutang-payment/pdf?ids=${emailFor.ids.join(",")}`}
          sentInfo={{ at: emailFor.email_sent_at, to: emailFor.email_sent_to }}
          onSend={({ to, subject, body }) =>
            sendHutangPaymentEmail({ ids: emailFor.ids, to, subject, body })}
        />
      )}
    </div>
  );
}
