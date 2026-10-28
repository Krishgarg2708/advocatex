import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rangeFromPreset, useUIStore } from "@/store/ui";
import { rangeLabel } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/types";

const PRESETS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

/** Global date-range selector. Controlled by the UI store unless value/onChange are passed. */
export function DateRangePicker({ value, onChange, className, align = "end" }: { value?: DateRange; onChange?: (r: DateRange) => void; className?: string; align?: "start" | "end" }) {
  const global = useUIStore((s) => s.dateRange);
  const setGlobal = useUIStore((s) => s.setDateRange);
  const setPreset = useUIStore((s) => s.setPreset);
  const range = value ?? global;
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const invalid = !from || !to || from > to;

  const apply = (r: DateRange) => { (onChange ?? setGlobal)(r); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(range.from); setTo(range.to); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 gap-2 font-normal", className)} aria-label="Select date range">
          <CalendarDays className="text-muted-foreground" />
          <span className="whitespace-nowrap">{rangeLabel(range)}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-3">
        <div className="grid gap-1">
          {PRESETS.map((p) => (
            <button key={p.value} type="button"
              onClick={() => { if (onChange) onChange(rangeFromPreset(p.value)); else setPreset(p.value); setOpen(false); }}
              className={cn("rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted", range.preset === p.value && "bg-accent font-medium text-accent-foreground")}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 border-t pt-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Custom range</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1"><Label htmlFor="dr-from" className="text-xs">From</Label><Input id="dr-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" /></div>
            <div className="grid gap-1"><Label htmlFor="dr-to" className="text-xs">To</Label><Input id="dr-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" /></div>
          </div>
          {invalid && <p className="mt-1.5 text-xs text-destructive">End date must be on or after the start date.</p>}
          <Button size="sm" className="mt-3 w-full" disabled={invalid} onClick={() => apply({ preset: "custom", from, to })}>Apply custom range</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
