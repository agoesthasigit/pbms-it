"use client";

// Dialog konfirmasi bergaya (Base UI Dialog) pengganti window.confirm() bawaan
// browser — sadar tema terang/gelap & konsisten dengan komponen lain.
//
// Pemakaian (imperatif, mudah menggantikan confirm()):
//   const confirm = useConfirm();
//   async function handleDelete() {
//     const ok = await confirm({
//       title: "Hapus item?",
//       description: "Tindakan ini tidak bisa dibatalkan.",
//       destructive: true,
//     });
//     if (!ok) return;
//     ... // lanjut hapus
//   }

import {
  createContext, useCallback, useContext, useRef, useState, type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** true = tombol konfirmasi bergaya merah (aksi hapus/destruktif). */
  destructive?: boolean;
};

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o = {}) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) settle(false); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{opts.title ?? "Konfirmasi"}</DialogTitle>
            {opts.description != null && opts.description !== "" && (
              <DialogDescription className="whitespace-pre-line">
                {opts.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {opts.cancelText ?? "Batal"}
            </Button>
            <Button
              variant={opts.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {opts.confirmText ?? "Lanjut"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm harus dipakai di dalam <ConfirmProvider>");
  return ctx;
}
