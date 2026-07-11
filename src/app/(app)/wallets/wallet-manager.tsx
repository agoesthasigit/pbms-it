"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Loader2, ArrowRightLeft, Wallet as WalletIcon,
  Banknote, Landmark, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/utils/currency";
import { todayISO } from "@/lib/utils/date";
import {
  type WalletWithBalance, type WalletType, WALLET_TYPE_LABELS,
} from "@/types/db";
import {
  addWallet, updateWallet, deleteWallet, transferBetweenWallets,
} from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

const TYPE_ICONS = { cash: Banknote, bank: Landmark, ewallet: Smartphone };

const emptyForm = {
  name: "", type: "cash" as WalletType, initial_balance: "", is_active: true,
};

export function WalletManager({ wallets }: { wallets: WalletWithBalance[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // form tambah/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WalletWithBalance | null>(null);
  const [form, setForm] = useState(emptyForm);

  // form transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [tf, setTf] = useState({
    from_id: "", to_id: "", amount: "", tx_date: todayISO(), description: "",
  });

  const activeWallets = wallets.filter((w) => w.is_active);
  const totalBalance = activeWallets.reduce((s, w) => s + Number(w.balance), 0);

  // Base UI Select butuh prop `items` (value→label) agar trigger menampilkan
  // nama wallet, bukan value mentah (UUID). Lihat catatan di AGENTS.md.
  const fromItems = activeWallets.map((w) => ({
    value: w.id,
    label: `${w.name} · ${formatIDR(Number(w.balance))}`,
  }));
  const toItems = activeWallets.map((w) => ({ value: w.id, label: w.name }));
  const typeItems = (Object.keys(WALLET_TYPE_LABELS) as WalletType[])
    .map((t) => ({ value: t, label: WALLET_TYPE_LABELS[t] }));

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(w: WalletWithBalance) {
    setEditing(w);
    setForm({
      name: w.name, type: w.type,
      initial_balance: String(w.initial_balance), is_active: w.is_active,
    });
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const input = {
        name: form.name,
        type: form.type,
        initial_balance: Number(form.initial_balance) || 0,
        is_active: form.is_active,
      };
      const res = editing
        ? await updateWallet(editing.id, input)
        : await addWallet(input);
      if (res.error) { toast.error(res.error); return; }
      toast.success(editing ? "Wallet diperbarui." : "Wallet ditambahkan.");
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete(w: WalletWithBalance) {
    if (!confirm(`Hapus wallet "${w.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteWallet(w.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Wallet "${w.name}" dihapus.`);
      router.refresh();
    });
  }

  function handleTransfer() {
    startTransition(async () => {
      const res = await transferBetweenWallets({
        from_id: tf.from_id, to_id: tf.to_id,
        amount: Number(tf.amount) || 0,
        tx_date: tf.tx_date, description: tf.description || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Transfer berhasil dicatat.");
      setTransferOpen(false);
      setTf({ from_id: "", to_id: "", amount: "", tx_date: todayISO(), description: "" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Total saldo + aksi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="sm:min-w-72">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total Saldo (wallet aktif)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatIDR(totalBalance)}
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={activeWallets.length < 2}
            onClick={() => setTransferOpen(true)}
          >
            <ArrowRightLeft className="h-4 w-4" /> Transfer
          </Button>
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer Antar Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Dari</Label>
                    <Select items={fromItems} value={tf.from_id}
                      onValueChange={(v) => setTf({ ...tf, from_id: v ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="Wallet asal" /></SelectTrigger>
                      <SelectContent>
                        {activeWallets.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name} · {formatIDR(Number(w.balance))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ke</Label>
                    <Select items={toItems} value={tf.to_id}
                      onValueChange={(v) => setTf({ ...tf, to_id: v ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="Wallet tujuan" /></SelectTrigger>
                      <SelectContent>
                        {activeWallets
                          .filter((w) => w.id !== tf.from_id)
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nominal (Rp)</Label>
                    <Input type="number" min={0} value={tf.amount}
                      onChange={(e) => setTf({ ...tf, amount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={tf.tx_date}
                      onChange={(e) => setTf({ ...tf, tx_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Keterangan (opsional)</Label>
                  <Input value={tf.description}
                    placeholder="Contoh: setor tunai ke bank"
                    onChange={(e) => setTf({ ...tf, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleTransfer}
                  disabled={pending || !tf.from_id || !tf.to_id || !tf.amount}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Catat Transfer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Tambah Wallet
          </Button>
        </div>
      </div>

      {/* Daftar wallet */}
      {wallets.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState icon={WalletIcon} title="Belum ada wallet"
              description="Tambahkan wallet pertama, contoh: Kas Tunai atau rekening bank." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {wallets.map((w) => {
            const Icon = TYPE_ICONS[w.type];
            return (
              <Card key={w.id} className={!w.is_active ? "opacity-60" : ""}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{w.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {WALLET_TYPE_LABELS[w.type]}
                      </p>
                    </div>
                  </div>
                  {!w.is_active && <Badge variant="outline">Nonaktif</Badge>}
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold tracking-tight">
                    {formatIDR(Number(w.balance))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saldo awal: {formatIDR(Number(w.initial_balance))}
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEdit(w)}>
                      <Pencil className="h-3.5 w-3.5" /> Ubah
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(w)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog tambah/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Wallet" : "Tambah Wallet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Wallet</Label>
              <Input value={form.name} placeholder="Contoh: Kas Tunai, BCA, Dana"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select items={typeItems} value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v ?? "cash" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo Awal (Rp)</Label>
                <Input type="number" min={0} value={form.initial_balance}
                  onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} />
              </div>
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Wallet aktif</p>
                  <p className="text-xs text-muted-foreground">
                    Wallet nonaktif tidak muncul di pilihan transaksi.
                  </p>
                </div>
                <Switch checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={pending || !form.name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
