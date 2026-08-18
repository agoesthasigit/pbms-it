"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, Save, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveEmailSettings } from "./actions";

export type EmailSettings = {
  gmail_user: string | null;
  gmail_from_name: string | null;
  has_password: boolean;
};

export function EmailSettingsManager({ initial }: { initial: EmailSettings | null }) {
  const [gmailUser, setGmailUser] = useState(initial?.gmail_user ?? "");
  const [fromName, setFromName] = useState(initial?.gmail_from_name ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(Boolean(initial?.has_password));
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await saveEmailSettings({
        gmail_user: gmailUser,
        from_name: fromName,
        app_password: appPassword,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pengaturan email tersimpan.");
      if (appPassword.trim()) setHasPassword(true);
      setAppPassword(""); // jangan tahan password di memori form
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> Pengaturan Email (Gmail)
        </CardTitle>
        <CardDescription>
          Kredensial untuk mengirim invoice &amp; NOTA via Gmail. Tersimpan aman
          di database (password terenkripsi) — tidak lagi bergantung pada file
          lokal, dan bisa diubah kapan saja di sini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="gmail_user">Email Pengirim (Gmail)</Label>
          <Input
            id="gmail_user"
            type="email"
            placeholder="athaya.it@gmail.com"
            value={gmailUser}
            onChange={(e) => setGmailUser(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from_name">Nama Tampil di Inbox</Label>
          <Input
            id="from_name"
            placeholder="Agusta Sigit IT"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="app_password" className="flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> App Password (16 karakter)
          </Label>
          <Input
            id="app_password"
            type="password"
            autoComplete="off"
            placeholder={
              hasPassword
                ? "••••••••  (biarkan kosong jika tidak diubah)"
                : "Tempel App Password Gmail di sini"
            }
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Buat di Akun Google → Keamanan → Verifikasi 2 Langkah → App Passwords.
            Spasi akan diabaikan otomatis.
            {hasPassword && (
              <span className="ml-1 inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Password sudah tersimpan.
              </span>
            )}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={pending || !gmailUser.trim()}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
