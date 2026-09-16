import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NAV_GROUPS } from "@/components/shared/nav-links";

export const metadata = { title: "Menu" };

// Hub "semua menu" khusus mobile (tab Menu di bottom-nav). Sumbernya
// NAV_GROUPS — sama dengan sidebar desktop — jadi tak ada fitur yang
// terpotong; menu baru otomatis muncul di sini. Di desktop halaman ini
// tak tertaut (dipakai sidebar), tapi tetap aman bila dibuka langsung.

// Href yang diberi aksen oranye agar grid tak monoton (murni visual).
const AMBER = new Set(["/invoices", "/expenses", "/distributor-orders"]);

export default async function MenuPage() {
  const supabase = await createClient();
  const { count: pendingOrders } = await supabase
    .from("distributor_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const badges: Record<string, number> = {
    "/distributor-orders": pendingOrders ?? 0,
  };

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <h1 className="ma-h1 mb-1">Menu</h1>
      <p className="text-sm text-muted-foreground">
        Semua fitur PBMS dalam satu tempat.
      </p>

      {NAV_GROUPS.map((group) => (
        <section key={group.title}>
          <p className="ma-grouplabel">{group.title}</p>
          <div className="ma-menugrid">
            {group.items.map((item) => {
              const badge = badges[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "ma-mtile ma-card" + (AMBER.has(item.href) ? " a" : "")
                  }
                >
                  <span className="mi">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>{item.label}</span>
                  {badge > 0 && <span className="nbadge">{badge}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
