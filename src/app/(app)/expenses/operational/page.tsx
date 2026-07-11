import { ExpensePage } from "@/components/shared/expense-page";
export const metadata = { title: "Pengeluaran Operasional" };
export default function Page() {
  return <ExpensePage kind="operational" />;
}
