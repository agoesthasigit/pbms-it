"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Category,
  type CategoryType,
  CATEGORY_TYPE_LABELS,
} from "@/types/db";
import { addCategory, toggleCategory, deleteCategory } from "./actions";

const TYPES = Object.keys(CATEGORY_TYPE_LABELS) as CategoryType[];
// Base UI Select butuh `items` (value→label) agar trigger menampilkan label,
// bukan value mentah. Lihat catatan di AGENTS.md.
const TYPE_ITEMS = TYPES.map((t) => ({ value: t, label: CATEGORY_TYPE_LABELS[t] }));

export function CategoryManager({ data }: { data: Category[] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("client");
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function handleAdd() {
    startTransition(async () => {
      const res = await addCategory(name, type);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Kategori "${name.trim()}" ditambahkan.`);
      setName("");
    });
  }

  function handleToggle(cat: Category, checked: boolean) {
    startTransition(async () => {
      const res = await toggleCategory(cat.id, checked);
      if (res.error) { toast.error(res.error); return; }
      toast.success(
        `"${cat.name}" ${checked ? "diaktifkan" : "dinonaktifkan"}.`
      );
    });
  }

  async function handleDelete(cat: Category) {
    if (!(await confirm({ title: "Hapus kategori?", description: `Kategori "${cat.name}" akan dihapus.`, destructive: true, confirmText: "Hapus" }))) return;
    startTransition(async () => {
      const res = await deleteCategory(cat.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Kategori "${cat.name}" dihapus.`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Form tambah */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select items={TYPE_ITEMS} value={type}
              onValueChange={(v) => setType(v ?? "client")}>
              <SelectTrigger className="sm:w-64">
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Nama kategori, contoh: Villa, Kabel & Konektor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daftar per jenis */}
      {TYPES.map((t) => {
        const items = data.filter((c) => c.type === t);
        return (
          <Card key={t}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {CATEGORY_TYPE_LABELS[t]}
                <Badge variant="secondary">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada kategori. Tambahkan lewat form di atas.
                </p>
              ) : (
                <ul className="divide-y">
                  {items.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span
                        className={
                          cat.is_active
                            ? "text-sm font-medium"
                            : "text-sm text-muted-foreground line-through"
                        }
                      >
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cat.is_active}
                          onCheckedChange={(v) => handleToggle(cat, v)}
                          disabled={pending}
                          aria-label="Aktif / nonaktif"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          title="Hapus" onClick={() => handleDelete(cat)}
                          disabled={pending}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Hapus</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
