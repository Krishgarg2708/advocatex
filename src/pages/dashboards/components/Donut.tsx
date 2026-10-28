import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export interface DonutSlice { key: string; label: string; value: number; color: string; sub?: string }

function DonutTooltip({ active, payload, format, total }: { active?: boolean; payload?: { payload?: DonutSlice }[]; format: (v: number) => string; total: number }) {
  const s = payload?.[0]?.payload;
  if (!active || !s) return null;
  return (
    <div className="min-w-[140px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lift">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Value</span><span className="font-medium text-foreground num">{format(s.value)}</span></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Share</span><span className="font-medium text-foreground num">{total ? ((s.value / total) * 100).toFixed(1) : "0.0"}%</span></div>
    </div>
  );
}

/** Donut with a centre total and a legend list (value + share) beside it. Stacks on narrow screens. */
export function Donut({ data, format = (v) => v.toLocaleString("en-IN"), centerLabel, centerValue, height = 200, className }: {
  data: DonutSlice[]; format?: (v: number) => string; centerLabel: string; centerValue?: string; height?: number; className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-4", className)}>
      <div className="relative w-[180px] shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutTooltip format={format} total={total} />} />
            <Pie data={shown.length ? shown : [{ key: "none", label: "No data", value: 1, color: "hsl(var(--muted))" }]} dataKey="value" nameKey="label"
              innerRadius="62%" outerRadius="92%" paddingAngle={shown.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {(shown.length ? shown : [{ key: "none", color: "hsl(var(--muted))" }]).map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold tracking-tight num">{centerValue ?? format(total)}</span>
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-[180px] flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.label}{d.sub && <span className="ml-1 text-xs text-muted-foreground">{d.sub}</span>}</span>
            <span className="font-medium num">{format(d.value)}</span>
            <span className="w-10 text-right text-xs text-muted-foreground num">{total ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
