import { PageHeader } from "@/components/shared/page-header";
import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan keuangan dan operasional bisnis Anda secara real-time."
      />
      <DashboardClient />
    </div>
  );
}
