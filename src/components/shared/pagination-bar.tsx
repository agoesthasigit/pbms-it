"use client";

import { Button } from "@/components/ui/button";

/**
 * Bar navigasi halaman bersama untuk semua daftar. Sengaja tidak dirender
 * (return null) saat cuma satu halaman supaya daftar pendek tetap bersih.
 * Pasangkan dengan {@link usePagination}.
 */
export function PaginationBar({
  page,
  totalPages,
  from,
  to,
  total,
  onPageChange,
  unit = "baris",
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  unit?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Menampilkan {from}–{to} dari {total} {unit}
      </span>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        <span className="text-muted-foreground">
          Hal {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  );
}
