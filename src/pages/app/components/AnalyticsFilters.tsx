import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import type { AdvocateType, Campaign, Product } from "@/types";

export interface AnalyticsFilterState { campaignId: string; productId: string; advocateType: "all" | AdvocateType }
export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilterState = { campaignId: "all", productId: "all", advocateType: "all" };

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const;

/** Range presets (bound to the global date range) plus campaign / product / advocate-type filters. */
export function AnalyticsFilters({ value, onChange, campaigns, products, showAdvocateType }: {
  value: AnalyticsFilterState; onChange: (v: AnalyticsFilterState) => void; campaigns: Campaign[]; products: Product[]; showAdvocateType: boolean;
}) {
  const range = useUIStore((s) => s.dateRange);
  const setPreset = useUIStore((s) => s.setPreset);
  const dirty = value.campaignId !== "all" || value.productId !== "all" || value.advocateType !== "all";
  const set = (patch: Partial<AnalyticsFilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground" id="af-range">Date range</span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="af-range">
          <div className="inline-flex h-9 items-center rounded-md border bg-muted/40 p-0.5">
            {PRESETS.map((p) => (
              <button key={p.value} type="button" onClick={() => setPreset(p.value)} aria-pressed={range.preset === p.value}
                className={cn("h-8 rounded px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  range.preset === p.value && "bg-card text-foreground shadow-sm")}>
                {p.label}
              </button>
            ))}
          </div>
          <DateRangePicker align="start" className={cn(range.preset === "custom" && "border-action/50 text-action")} />
        </div>
      </div>

      <div className="grid gap-1.5 lg:w-52">
        <Label htmlFor="af-campaign" className="text-xs text-muted-foreground">Campaign</Label>
        <Select value={value.campaignId} onValueChange={(v) => set({ campaignId: v })}>
          <SelectTrigger id="af-campaign"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 lg:w-60">
        <Label htmlFor="af-product" className="text-xs text-muted-foreground">Product</Label>
        <Select value={value.productId} onValueChange={(v) => set({ productId: v })}>
          <SelectTrigger id="af-product"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showAdvocateType && (
        <div className="grid gap-1.5 lg:w-44">
          <Label htmlFor="af-type" className="text-xs text-muted-foreground">Advocate type</Label>
          <Select value={value.advocateType} onValueChange={(v) => set({ advocateType: v as AnalyticsFilterState["advocateType"] })}>
            <SelectTrigger id="af-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Shops & mechanics</SelectItem>
              <SelectItem value="shop">Shops only</SelectItem>
              <SelectItem value="mechanic">Mechanics only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {dirty && (
        <Button variant="ghost" size="sm" className="h-9 self-start lg:self-end" onClick={() => onChange(EMPTY_ANALYTICS_FILTERS)}>
          <X />Clear filters
        </Button>
      )}
    </div>
  );
}
