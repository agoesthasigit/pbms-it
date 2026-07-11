"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PasswordCell({
  kind, id, hasPassword,
}: {
  kind: "network" | "cctv";
  id: string;
  hasPassword: boolean;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!hasPassword) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  async function fetchPassword(): Promise<string | null> {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      return json.password as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengambil password.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    const pw = await fetchPassword();
    if (pw !== null) setRevealed(pw);
  }

  async function copy() {
    const pw = revealed ?? (await fetchPassword());
    if (pw === null) return;
    await navigator.clipboard.writeText(pw);
    setCopied(true);
    toast.success("Password disalin.");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1">
      <span className="min-w-20 font-mono text-sm">
        {revealed !== null ? revealed : "••••••••"}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={toggle} disabled={loading} title={revealed !== null ? "Sembunyikan" : "Tampilkan"}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : revealed !== null ? <EyeOff className="h-3.5 w-3.5" />
          : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={copy} disabled={loading} title="Salin password">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" />
          : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
