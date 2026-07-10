import { LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan bisnis Anda akan tampil di sini."
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Dashboard dibangun di Phase 8</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Selesaikan dulu master data (Phase 2) dan transaksi (Phase 3)
              agar ada data yang bisa ditampilkan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
