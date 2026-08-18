"use client";

// Tombol "+ Baru" kecil di samping sebuah Select untuk menambah entitas (client /
// distributor) tanpa keluar dari form yang sedang diisi (audit 3.3).
// onCreate mengembalikan { id, label } atau { error }; onCreated dipanggil dengan
// { value, label } agar pemanggil bisa menambah ke daftar & memilihnya.

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function InlineCreate({
  title, fieldLabel, placeholder, onCreate, onCreated,
}: {
  title: string;
  fieldLabel: string;
  placeholder?: string;
  onCreate: (name: string) => Promise<{ id?: string; label?: string; error?: string }>;
  onCreated: (item: { value: string; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) return;
    start(async () => {
      const res = await onCreate(name);
      if (res.error || !res.id || !res.label) {
        toast.error(res.error ?? "Gagal menyimpan.");
        return;
      }
      onCreated({ value: res.id, label: res.label });
      toast.success(`${res.label} ditambahkan.`);
      setName("");
      setOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="icon" title={title}
        onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>{fieldLabel}</Label>
            <Input autoFocus value={name} placeholder={placeholder}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={pending || !name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
