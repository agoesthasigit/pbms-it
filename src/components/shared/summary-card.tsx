import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatIDR } from "@/lib/utils/currency";

// Kartu ringkasan nominal bergaya: ikon lembut, judul, angka besar,
// dan baris perbandingan (persen naik/turun + nilai pembanding).
export function SummaryCard({
  title,
  value,
  icon: Icon,
  compareLabel = "Dari bulan lalu",
  compareValue,
  percent,
  // arah baik/buruk: untuk pemasukan, naik = hijau; untuk pengeluaran, naik = merah
  invertColor = false,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  compareLabel?: string;
  compareValue?: number;
  percent?: number | null;
  invertColor?: boolean;
}) {
  const hasCompare = percent !== null && percent !== undefined && Number.isFinite(percent);
  const up = (percent ?? 0) >= 0;
  // warna: default naik=hijau turun=merah; invert (pengeluaran) dibalik
  const good = invertColor ? !up : up;
  const color = !hasCompare
    ? "text-muted-foreground"
    : good ? "text-emerald-600" : "text-red-600";
  const Arrow = up ? TrendingUp : TrendingDown;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-amber-100">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <p className="text-3xl font-bold tracking-tight">{formatIDR(value)}</p>
          {hasCompare && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${color}`}>
              <Arrow className="h-4 w-4" />
              {Math.abs(percent!).toFixed(0)}%
            </div>
          )}
        </div>

        <div className="mt-3 border-t pt-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{compareLabel}</span>
            {compareValue !== undefined && <span>{formatIDR(compareValue)}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
