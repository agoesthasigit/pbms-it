import { redirect } from "next/navigation";
import { Package, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/portal/context";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";

/**
 * Layout portal distributor — TERPISAH dari app pemilik (di luar grup `(app)`),
 * jadi tak mewarisi sidebar/menu pemilik. Guard peran: hanya akun distributor
 * aktif yang boleh; uid pemilik (getPortalContext null) dilempar ke /dashboard.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const portal = await getPortalContext();
  if (!portal) redirect("/dashboard");

  return (
    <ConfirmProvider>
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b bg-background px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4.5 w-4.5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">Portal Distributor</p>
            <p className="text-[11px] text-muted-foreground">{portal.distributorName}</p>
          </div>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm" className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:p-8">
        {children}
      </main>
    </div>
    </ConfirmProvider>
  );
}
