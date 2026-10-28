import { ArrowDownWideNarrow, ArrowUpNarrowWide, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SortDir } from "@/components/shared/table-kit";
import type { Campaign } from "@/types";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "table";

/** Grid / table switch used by directories and the product catalogue. */
export function ViewToggle({ value, onChange, className }: { value: ViewMode; onChange: (v: ViewMode) => void; className?: string }) {
  return (
    <div className={cn("inline-flex shrink-0 rounded-md border bg-card p-0.5 shadow-sm", className)} role="group" aria-label="Change view">
      {([["grid", LayoutGrid, "Grid view"], ["table", List, "List view"]] as const).map(([v, Icon, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-label={label} aria-pressed={value === v}
          className={cn("flex h-7 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground", value === v && "bg-muted text-foreground")}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/** Sort select + direction button driving useTableState's toggleSort (for card layouts without table headers). */
export function SortControl({ options, sort, onSort, className }: {
  options: { key: string; label: string }[]; sort?: { key: string; dir: SortDir }; onSort: (key: string) => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Select value={sort?.key ?? ""} onValueChange={(k) => { if (k !== sort?.key) onSort(k); }}>
        <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Sort by"><SelectValue placeholder="Sort by" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>Sort: {o.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="outline" size="icon" disabled={!sort} onClick={() => sort && onSort(sort.key)} aria-label={sort?.dir === "asc" ? "Sorted ascending — switch to descending" : "Sorted descending — switch to ascending"}>
        {sort?.dir === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
      </Button>
    </div>
  );
}

/** Campaign count with names in a tooltip. */
export function CampaignsHint({ campaigns, className }: { campaigns: Campaign[]; className?: string }) {
  if (campaigns.length === 0) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <Hint content={<div className="space-y-0.5">{campaigns.map((c) => <div key={c.id}>{c.name}</div>)}</div>}>
      <button type="button" onClick={(e) => e.stopPropagation()} className={cn("rounded-full bg-action-soft px-2 py-0.5 text-xs font-semibold text-action num", className)} aria-label={`${campaigns.length} campaigns: ${campaigns.map((c) => c.name).join(", ")}`}>
        {campaigns.length}
      </button>
    </Hint>
  );
}

/** Generic labelled Select for filter bars; value "all" means no filter. */
export function FilterSelect({ value, onChange, label, allLabel, options, className }: {
  value: string; onChange: (v: string) => void; label: string; allLabel: string; options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-full sm:w-40", className)} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Percentile rank (0–1) of `v` within `values` (ties share the average rank). */
export function percentile(values: number[], v: number) {
  if (values.length <= 1) return values.length ? 1 : 0;
  const below = values.filter((x) => x < v).length;
  const equal = values.filter((x) => x === v).length;
  return (below + (equal - 1) / 2) / (values.length - 1);
}
