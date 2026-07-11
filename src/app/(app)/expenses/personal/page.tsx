import { ExpensePage } from "@/components/shared/expense-page";
export const metadata = { title: "Pengeluaran Pribadi" };
export default function Page() {
  return <ExpensePage kind="personal" />;
}
