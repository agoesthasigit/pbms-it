"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Label as LabelType } from "@/types/db";
import { addLabel, deleteLabel } from "./actions";

const PRESET_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#64748b",
];

export function LabelManager({ data }: { data: LabelType[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const res = await addLabel(name, color);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Label "${name.trim()}" ditambahkan.`);
      setName("");
    });
  }

  function handleDelete(label: LabelType) {
    if (!confirm(`Hapus label "${label.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteLabel(label.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Label "${label.name}" dihapus.`);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah Label</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Nama label, contoh: Urgent, Proyek Besar"
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Warna:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-offset-2 ring-ring" : ""
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Pilih warna ${c}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Label</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada label. Label bisa dipakai untuk menandai pengeluaran.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                >
                  <Tag className="h-3.5 w-3.5" style={{ color: label.color }} />
                  {label.name}
                  <button
                    type="button"
                    onClick={() => handleDelete(label)}
                    disabled={pending}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label={`Hapus label ${label.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
