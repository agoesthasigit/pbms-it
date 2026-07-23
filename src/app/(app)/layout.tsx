import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/shared/brand";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { AppHeader } from "@/components/shared/app-header";
import { BottomNav } from "@/components/shared/bottom-nav";

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
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        <Brand />
        <SidebarNav />
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <AppHeader email={user.email ?? "Admin"} />
        {/* Padding samping mengikuti safe-area supaya konten tidak tertutup
            notch. Padding bawah di mobile memberi ruang untuk bottom-nav +
            safe-area home indicator; di lg di-reset karena bar disembunyikan. */}
        <main className="flex-1 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Navigasi bawah — hanya tampil di mobile */}
      <BottomNav />
    </div>
  );
}
