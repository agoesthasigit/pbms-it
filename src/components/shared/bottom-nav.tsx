"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, ReceiptText, Briefcase, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// Navigasi bawah khusus mobile. Hanya 4 menu paling sering dipakai; menu
// lengkap tetap lewat hamburger + sheet di header. Disembunyikan di layar
// besar (lg) karena di sana sudah ada sidebar.
const ITEMS = [
  { label: "Pembelian", href: "/purchases", icon: ShoppingCart },
  { label: "Penjualan", href: "/sales", icon: ReceiptText },
  { label: "Operasional", href: "/expenses/operational", icon: Briefcase },
  { label: "Laporan", href: "/reports", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navigasi utama"
    >
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
