import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { C } from "@/components/shared/charts";

export interface RankedSegment { label: string; value: number; color: string }
export interface RankedItem { id: string; label: ReactNode; value: number; sub?: ReactNode; segments?: RankedSegment[] }

/**
 * Lightweight ranked bar list (no chart library) — used for geography, mixes and splits
 * where labels are long and a horizontal list reads better than an axis chart.
 */
export function RankedBarList({ items, format = (v) => v.toLocaleString("en-IN"), max, limit, emptyLabel = "No data in this period", showRank = true, className }: {
  items: RankedItem[]; format?: (v: number) => string; max?: number; limit?: number; emptyLabel?: string; showRank?: boolean; className?: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const top = max ?? Math.max(1, ...shown.map((i) => i.value));
  if (!shown.length) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className={cn("space-y-3", className)}>
      {shown.map((it, i) => (
        <li key={it.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-baseline gap-2">
              {showRank && <span className="w-4 shrink-0 text-right text-xs font-semibold text-muted-foreground num">{i + 1}</span>}
              <span className="truncate font-medium">{it.label}</span>
            </span>
            <span className="shrink-0 text-right num">
              <span className="font-semibold">{format(it.value)}</span>
              {it.sub && <span className="ml-2 text-xs text-muted-foreground">{it.sub}</span>}
            </span>
          </div>
          <div className={cn("flex h-2 overflow-hidden rounded-full bg-muted", showRank && "ml-6")} role="presentation">
            {it.segments && it.segments.length ? (
              it.segments.map((s) => (
                <div key={s.label} className="h-full first:rounded-l-full last:rounded-r-full" title={`${s.label}: ${format(s.value)}`}
                  style={{ width: `${(s.value / top) * 100}%`, background: s.color }} />
              ))
            ) : (
              <div className="h-full rounded-full" style={{ width: `${Math.max(it.value ? 2 : 0, (it.value / top) * 100)}%`, background: C.c1 }} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
