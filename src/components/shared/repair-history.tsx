"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { RepairLog } from "@/types/phase5";
import { deleteRepairLog } from "./repair-actions";

export function RepairHistory({ logs }: { logs: RepairLog[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Hapus log perbaikan ini?")) return;
    startTransition(async () => {
      const res = await deleteRepairLog(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Log perbaikan dihapus.");
      router.refresh();
    });
  }

  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Belum ada riwayat perbaikan.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => (
        <li key={log.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{log.problem}</p>
                {log.action_taken && (
                  <p className="text-sm text-muted-foreground">
                    Tindakan: {log.action_taken}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{formatDate(log.repair_date)}</span>
                  {log.cost > 0 && <span>Biaya: {formatIDR(Number(log.cost))}</span>}
                  {log.notes && <span>· {log.notes}</span>}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(log.id)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
