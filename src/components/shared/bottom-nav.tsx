"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  Plus,
  BarChart3,
  LayoutGrid,
  ShoppingCart,
  ReceiptText,
  Banknote,
  FileText,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// Navigasi bawah ala aplikasi finansial (khusus mobile; disembunyikan di lg via
// media query pada `.ma-bnav`). Empat tab + tombol "+" mengambang di tengah
// yang membuka bottom-sheet "Catat Baru". Menu lengkap ada di tab "Menu".
const TABS = [
  { label: "Beranda", href: "/dashboard", icon: Home },
  { label: "Transaksi", href: "/transactions", icon: ArrowLeftRight },
  { label: "Laporan", href: "/reports", icon: BarChart3 },
  { label: "Menu", href: "/menu", icon: LayoutGrid },
] as const;

// Aksi cepat di bottom-sheet. Urutan sesuai permintaan: Beli dulu, lalu Jual.
const ACTIONS = [
  {
    label: "Pembelian",
    desc: "Barang masuk — tunai atau hutang",
    href: "/purchases",
    icon: ShoppingCart,
    tone: "neg",
  },
  {
    label: "Penjualan",
    desc: "Barang / jasa — pilih brand & metode",
    href: "/sales",
    icon: ReceiptText,
    tone: "pos",
  },
  {
    label: "Pengeluaran",
    desc: "Biaya operasional & pribadi",
    href: "/expenses",
    icon: Banknote,
    tone: "neg",
  },
  {
    label: "Invoice Bulanan",
    desc: "Tagihan client per periode",
    href: "/invoices",
    icon: FileText,
    tone: "amber",
  },
  {
    label: "Transfer Wallet",
    desc: "Pindah saldo antar dompet",
    href: "/wallets",
    icon: Repeat,
    tone: "teal",
  },
] as const;

const toneClass: Record<string, string> = {
  pos: "ma-row-ic pos",
  neg: "ma-row-ic neg",
  teal: "ma-row-ic teal",
  amber: "ma-row-ic amber",
};

export function BottomNav() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <nav className="ma-bnav" aria-label="Navigasi utama">
        {TABS.slice(0, 2).map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn("ma-bn", isActive(t.href) && "on")}
          >
            <t.icon className="h-[22px] w-[22px]" />
            {t.label}
          </Link>
        ))}

        <div className="ma-fabwrap">
          <button
            type="button"
            className="ma-fab"
            aria-label="Catat transaksi baru"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-[26px] w-[26px]" />
          </button>
        </div>

        {TABS.slice(2).map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn("ma-bn", isActive(t.href) && "on")}
          >
            <t.icon className="h-[22px] w-[22px]" />
            {t.label}
          </Link>
        ))}
      </nav>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
          <SheetHeader className="gap-1 p-0 pb-3">
            <SheetTitle className="text-lg">Catat Baru</SheetTitle>
            <SheetDescription>
              Pilih jenis transaksi yang mau dicatat.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2.5">
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="ma-opt"
                onClick={() => setAddOpen(false)}
              >
                <span className={toneClass[a.tone] + " oi"}>
                  <a.icon className="h-[21px] w-[21px]" />
                </span>
                <span className="ot">
                  <b>{a.label}</b>
                  <span>{a.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
