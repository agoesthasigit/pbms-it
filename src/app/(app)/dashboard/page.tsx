import { PageHeader } from "@/components/shared/page-header";
import { DashboardClient } from "./dashboard-client";
import { GlobalSearch } from "@/components/shared/global-search";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan keuangan dan operasional bisnis Anda secara real-time."
      />
      {/* Pencarian global cepat ke semua menu/halaman */}
      <GlobalSearch />
      <DashboardClient />
    </div>
  );
}
