"use client";

import { LogOut, UserCircle2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { logout } from "@/app/(auth)/login/actions";

// Header aplikasi. Di mobile menampilkan brand di kiri (menu lengkap sudah lewat
// tab "Menu" di bottom-nav — hamburger dihapus agar tak redundan). Di desktop
// kiri dibiarkan kosong karena brand & navigasi sudah ada di sidebar.
export function AppHeader({
  email,
}: {
  email: string;
  /** Dipertahankan agar kompatibel dgn pemanggil; lencana kini di sidebar & tab Menu. */
  badges?: Record<string, number>;
}) {
  return (
    // `min-h-14`, bukan `h-14`: tinggi tetap + padding-top safe-area akan
    // menggencet isi header karena box-sizing border-box.
    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-8">
      {/* Brand — mobile saja */}
      <div className="flex items-center gap-2 lg:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm"
          style={{ background: "var(--m-hero-grad)" }}>
          <Wallet className="h-4 w-4" />
        </span>
        <span className="font-heading text-base font-bold tracking-tight">PBMS-IT</span>
      </div>

      <div className="flex-1" />

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="gap-2 px-2" />}
        >
          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
          <span className="hidden max-w-45 truncate text-sm sm:inline">
            {email}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
