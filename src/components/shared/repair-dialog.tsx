"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { todayISO } from "@/lib/utils/date";
import { toNumber } from "@/lib/utils/number";
import { formatIDR } from "@/lib/utils/currency";
import type { WalletWithBalance, Category } from "@/types/db";
import type { RepairTarget } from "@/types/phase5";
import { addRepairLog } from "./repair-actions";

export function RepairDialog({
  open, onOpenChange, target, targetId, clientId, targetLabel,
  wallets = [], categories = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: RepairTarget;
  targetId: string;
  clientId: string;
  targetLabel: string;
  wallets?: WalletWithBalance[];
  categories?: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [date, setDate] = useState(todayISO());
  const [problem, setProblem] = useState("");
  const [action, setAction] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [recordExpense, setRecordExpense] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const walletItems = useMemo(
    () => wallets.filter((w) => w.is_active)
      .map((w) => ({ value: w.id, label: `${w.name} · ${formatIDR(Number(w.balance))}` })),
    [wallets]
  );
  const categoryItems = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  function reset() {
    setDate(todayISO()); setProblem(""); setAction(""); setCost("");
    setNotes(""); setRecordExpense(false); setWalletId(""); setCategoryId("");
  }

  function handleSave() {
    startTransition(async () => {
      const res = await addRepairLog({
        target, target_id: targetId, client_id: clientId,
        repair_date: date, problem, action_taken: action,
        cost: toNumber(cost), notes,
        wallet_id: recordExpense ? walletId : null,
        category_id: recordExpense ? categoryId || null : null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Log perbaikan tersimpan.");
      reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Perbaikan — {targetLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Biaya (Rp, opsional)</Label>
              <Input type="number" min={0} value={cost}
                onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Masalah / Keluhan *</Label>
            <Textarea rows={2} value={problem}
              placeholder="Contoh: WiFi sering putus di area lobby"
              onChange={(e) => setProblem(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tindakan Perbaikan</Label>
            <Textarea rows={2} value={action}
              placeholder="Contoh: ganti kabel LAN & reset router"
              onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* Opsi catat biaya ke keuangan */}
          {toNumber(cost) > 0 && wallets.length > 0 && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Catat biaya sebagai pengeluaran</p>
                  <p className="text-xs text-muted-foreground">
                    Kurangi saldo wallet & masuk ke pengeluaran operasional.
                  </p>
                </div>
                <Switch checked={recordExpense} onCheckedChange={setRecordExpense} />
              </div>
              {recordExpense && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Wallet *</Label>
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
                    <Label>Kategori</Label>
                    <Select items={categoryItems} value={categoryId || null}
                      onValueChange={(v) => setCategoryId(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                      <SelectContent>
                        {categoryItems.map((it) => (
                          <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave}
            disabled={pending || !problem.trim() || (recordExpense && !walletId)}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
