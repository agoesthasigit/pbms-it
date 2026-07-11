"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type Period = { from: string; to: string };

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function presetThisMonth(): Period {
  const now = new Date();
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}
export function presetLastMonth(): Period {
  const now = new Date();
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}
export function presetThisYear(): Period {
  const now = new Date();
  return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
}

export function PeriodPicker({
  period, onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(presetThisMonth())}>
          Bulan Ini
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange(presetLastMonth())}>
          Bulan Lalu
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange(presetThisYear())}>
          Tahun Ini
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Dari</Label>
          <Input type="date" value={period.from} className="h-9"
            onChange={(e) => onChange({ ...period, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sampai</Label>
          <Input type="date" value={period.to} className="h-9"
            onChange={(e) => onChange({ ...period, to: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
