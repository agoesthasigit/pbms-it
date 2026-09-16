"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Tombol "Filter" + bottom-sheet berisi field filter — dipakai halaman list
// mobile agar filter tak memanjangkan halaman. Isi filter dioper sebagai
// children (tiap halaman beda field). `activeCount` menampilkan lencana jumlah
// filter aktif; `onReset` mengosongkan filter.
export function FilterSheet({
  activeCount = 0,
  onReset,
  children,
  className,
}: {
  activeCount?: number;
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={"h-9 gap-1.5 " + (className ?? "")}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <span className="ml-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--m-teal-deep)] px-1 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[86vh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          <SheetHeader className="gap-1 p-0 pb-3">
            <SheetTitle className="text-lg">Filter</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3">{children}</div>
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="h-10 flex-1"
              onClick={() => onReset?.()}
            >
              Reset
            </Button>
            <Button className="h-10 flex-1" onClick={() => setOpen(false)}>
              Terapkan
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
