"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet, CheckCircle2 } from "lucide-react";
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
import type { RabStatus } from "@/types/phase7";
import { recordRabProfit } from "../actions";

export function RabProfitButton({
  rabId, wallets, netProfit, status, alreadyRecorded,
}: {
  rabId: string;
  wallets: WalletWithBalance[];
  netProfit: number;
  status: RabStatus;
  alreadyRecorded: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [date, setDate] = useState(todayISO());

  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );

  if (alreadyRecorded) {
    return (
      <Button variant="outline" disabled>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Laba Tercatat
      </Button>
    );
  }
  // hanya tampilkan jika laba positif
  if (netProfit <= 0) return null;

  function handleRecord() {
    startTransition(async () => {
      const res = await recordRabProfit({ id: rabId, wallet_id: walletId, date });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Laba proyek dicatat ke wallet.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4" /> Catat Laba ke Wallet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Laba Proyek ke Wallet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Laba bersih proyek</p>
              <p className="text-xl font-bold text-emerald-600">{formatIDR(netProfit)}</p>
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
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleRecord} disabled={pending || !walletId}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Catat Laba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
