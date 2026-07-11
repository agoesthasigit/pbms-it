import { PageHeader } from "@/components/shared/page-header";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "Laporan Keuangan" };

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Analisa pendapatan, pengeluaran, laba, dan margin dalam periode pilihan Anda."
      />
      <ReportsClient />
    </div>
  );
}
