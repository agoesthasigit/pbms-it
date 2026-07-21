"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRab } from "../actions";

export function RabDeleteButton({
  id, projectName,
}: {
  id: string;
  projectName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(
      `Hapus RAB "${projectName}"?\n\nSemua item, termin, dan efeknya di wallet akan ikut dibatalkan. Tindakan ini tidak bisa dibatalkan.`
    )) return;
    startTransition(async () => {
      const res = await deleteRab(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("RAB dihapus & efek wallet dibatalkan.");
      router.push("/rab");
      router.refresh();
    });
  }

  return (
    <Button variant="outline"
      className="text-destructive hover:text-destructive"
      onClick={handleDelete} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Hapus
    </Button>
  );
}
