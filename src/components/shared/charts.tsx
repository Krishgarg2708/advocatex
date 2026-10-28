import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Chart colours resolve from CSS variables so light/dark themes stay in sync. */
export const C = {
  c1: "hsl(var(--chart-1))",
  c2: "hsl(var(--chart-2))",
  c3: "hsl(var(--chart-3))",
  c4: "hsl(var(--chart-4))",
  c5: "hsl(var(--chart-5))",
  c6: "hsl(var(--chart-6))",
  grid: "hsl(var(--chart-grid))",
  muted: "hsl(var(--muted-foreground))",
};
export const SERIES = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];

export function ChartCard({ title, description, action, children, className, footer, bodyClassName }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; footer?: ReactNode; bodyClassName?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("flex-1", bodyClassName)}>{children}</CardContent>
      {footer && <div className="border-t px-5 py-3 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}

interface TooltipPayload { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }
/** Shared Recharts tooltip with consistent styling and per-series formatting. */
export function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: TooltipPayload[]; label?: string | number; format?: (v: number, key: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lift">
      {label !== undefined && label !== "" && <div className="mb-1.5 font-medium text-foreground">{label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
            </span>
            <span className="font-medium text-foreground num">{format ? format(Number(p.value), String(p.dataKey)) : Number(p.value).toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-2 w-3 rounded-sm", i.dashed && "h-0 border-t-2 border-dashed bg-transparent")} style={i.dashed ? { borderColor: i.color } : { background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

/** Horizontal funnel rendered with plain divs — clearer than a chart for 4–5 stages. */
export function FunnelBars({ stages }: { stages: { label: string; value: number; hint?: string }[] }) {
  const max = Math.max(1, stages[0]?.value ?? 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const step = i > 0 && stages[i - 1]!.value ? (s.value / stages[i - 1]!.value) * 100 : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-medium">{s.label}</span>
              <span className="num text-muted-foreground">
                <span className="font-semibold text-foreground">{s.value.toLocaleString("en-IN")}</span>
                {step !== null && <span className="ml-2 text-xs">{step.toFixed(1)}% of previous</span>}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-md bg-muted">
              <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(pct, 1.5)}%`, background: SERIES[i % SERIES.length], opacity: 0.9 - i * 0.08 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
