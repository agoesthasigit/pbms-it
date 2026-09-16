import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

// Header + pencarian global kini berada DI DALAM DashboardClient (khusus
// cabang desktop), supaya tampilan mobile bisa 180° berbeda tanpa header
// desktop ikut muncul.
export default function DashboardPage() {
  return <DashboardClient />;
}
