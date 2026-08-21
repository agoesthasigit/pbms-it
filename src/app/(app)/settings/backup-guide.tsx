"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const BACKUP_CMD = "npm run backup";

/**
 * Kartu panduan cara backup database (dijalankan lokal via VSCode).
 * Statis — hanya menampilkan langkah + tombol salin perintah, tak menyentuh data.
 */
export function BackupGuide() {
  const [copied, setCopied] = useState(false);

  async function copyCmd() {
    try {
      await navigator.clipboard.writeText(BACKUP_CMD);
      setCopied(true);
      toast.success("Perintah disalin");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin. Salin manual: " + BACKUP_CMD);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Backup dijalankan <strong>lokal</strong> lewat komputer ini (nol beban
        Supabase). Cukup ingat <strong>satu</strong> perintah — di balik layar ia
        memakai <code className="rounded bg-muted px-1 py-0.5">pg_dump</code>.
      </p>

      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>
          Buka proyek ini di <strong>VSCode</strong>, lalu buka Terminal
          (menu <em>Terminal → New Terminal</em>, atau tekan{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">Ctrl</kbd> +{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">`</kbd>).
        </li>
        <li>
          Ketik perintah di bawah, lalu tekan{" "}
          <kbd className="rounded border bg-muted px-1 text-xs">Enter</kbd>.
        </li>
        <li>
          Tunggu sampai muncul <strong>✅ Selesai</strong>.
        </li>
      </ol>

      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
          {BACKUP_CMD}
        </code>
        <Button variant="outline" size="sm" onClick={copyCmd}>
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Hasil backup</p>
        <p>
          Dua file masuk ke folder{" "}
          <code className="rounded bg-muted px-1 py-0.5">backups/</code>:
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            <code className="rounded bg-muted px-1 py-0.5">schema_&lt;tgl&gt;.sql</code>{" "}
            — struktur (tabel, view, fungsi, RLS)
          </li>
          <li>
            <code className="rounded bg-muted px-1 py-0.5">data_&lt;tgl&gt;.sql</code>{" "}
            — isi data
          </li>
        </ul>
        <p className="mt-2 text-xs">
          Untuk memulihkan ke database lain: jalankan{" "}
          <code className="rounded bg-muted px-1 py-0.5">schema</code> dulu, baru{" "}
          <code className="rounded bg-muted px-1 py-0.5">data</code>.
        </p>
      </div>

      <div className="rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-medium">Kalau perintah gagal</p>
        <p className="mt-1">
          Pastikan file <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">.env.local</code>{" "}
          memuat <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">SUPABASE_DB_URL</code>{" "}
          (connection string <em>Session pooler</em> dari Supabase), dan{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">pg_dump</code>{" "}
          portabel ada di folder{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">tools/pgsql/</code>.
        </p>
      </div>
    </div>
  );
}
