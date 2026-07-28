import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ICON_TONES, type IconTone } from "@/lib/utils/icon-tone";

export function StatCard({
  label, value, icon: Icon, hint, accent = "text-foreground", tone = "primary",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: string;
  tone?: IconTone;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight ${accent}`}>{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && (
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              ICON_TONES[tone]
            )}>
              <Icon className="h-4.5 w-4.5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
