import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/shared/brand";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { AppHeader } from "@/components/shared/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <Brand />
        <SidebarNav />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <AppHeader email={user.email ?? "Admin"} />
        {/* Padding bawah + samping mengikuti safe-area supaya konten tidak
            tertutup home indicator / notch saat dipasang sebagai PWA. */}
        <main className="flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
