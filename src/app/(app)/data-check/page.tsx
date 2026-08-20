import { PageHeader } from "@/components/shared/page-header";
import { DataCheck } from "./data-check";

export const metadata = { title: "Pemeriksaan Data" };

export default function DataCheckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pemeriksaan Data"
        description="Jalankan 22 pemeriksaan integritas & konsistensi keuangan untuk mendeteksi anomali (nomor invoice kembar, stok/saldo negatif, data yatim, modal/HPP hilang, pemasukan/pengeluaran wallet tak cocok, hutang, dsb) sedini mungkin."
      />
      <DataCheck />
    </div>
  );
}
