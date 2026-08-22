"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav-links";

export function SidebarNav({
  onNavigate,
  badges,
}: {
  onNavigate?: () => void;
  /** Jumlah lencana per href (mis. { "/distributor-orders": 3 }). */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground font-medium shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {badges && badges[item.href] > 0 && (
                    <span
                      className={cn(
                        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {badges[item.href]}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
