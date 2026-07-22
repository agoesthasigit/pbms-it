import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label, value, icon: Icon, hint, accent = "text-foreground",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p
              className={`mt-1 truncate text-2xl font-bold tracking-tight tabular-nums ${accent}`}
            >
              {value}
            </p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-4.5 w-4.5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
