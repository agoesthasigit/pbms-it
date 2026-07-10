import { Wrench } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="h-4.5 w-4.5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">PBMS-IT</p>
        <p className="text-[11px] text-muted-foreground">Business Manager</p>
      </div>
    </div>
  );
}
