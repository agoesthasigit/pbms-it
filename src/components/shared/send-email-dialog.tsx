"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, FileText, Paperclip, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type SendEmailResult = { success?: boolean; error?: string };

export function SendEmailDialog({
  open, onOpenChange, title, defaultTo, defaultSubject, defaultBody,
  attachmentName, pdfHref, sentInfo, onSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  /** Nama file PDF yang akan dilampirkan (untuk info di dialog). */
  attachmentName: string;
  /** URL untuk membuka pratinjau PDF di tab baru. */
  pdfHref: string;
  /** Info kirim sebelumnya, bila ada. */
  sentInfo?: { at?: string | null; to?: string | null } | null;
  onSend: (data: { to: string; subject: string; body: string }) => Promise<SendEmailResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  // Sinkronkan nilai default tiap kali dialog dibuka (data bisa berbeda per baris)
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  function handleSend() {
    startTransition(async () => {
      const res = await onSend({ to: to.trim(), subject, body });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Email terkirim ke ${to.trim()}.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  const sentAtLabel = sentInfo?.at
    ? new Date(sentInfo.at).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>
            Dikirim dari akun Gmail aplikasi. Subject &amp; isi bisa Anda ubah sebelum kirim.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sentAtLabel && (
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Terakhir dikirim <span className="font-medium">{sentAtLabel}</span>
              {sentInfo?.to ? <> ke <span className="font-medium">{sentInfo.to}</span></> : null}.
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kepada (email client) *</Label>
            <Input type="email" value={to} placeholder="email@client.com"
              onChange={(e) => setTo(e.target.value)} />
            {!to.trim() && (
              <p className="text-xs text-amber-600">
                Email client belum ada — isi manual atau lengkapi di menu Client.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Isi Email</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Tanda tangan (logo + kontak usaha) otomatis ditambahkan di bawah isi.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{attachmentName}</span>
            </span>
            <Button variant="ghost" size="sm" nativeButton={false}
              render={<a href={pdfHref} target="_blank" rel="noopener noreferrer" />}>
              <FileText className="h-4 w-4" /> Lihat PDF
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleSend} disabled={pending || !to.trim() || !subject.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
