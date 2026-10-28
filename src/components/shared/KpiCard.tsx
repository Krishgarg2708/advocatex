import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Tone = "brand" | "action" | "positive" | "warning" | "ai" | "neutral" | "destructive";
const toneClass: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  action: "bg-action-soft text-action",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  ai: "bg-ai-soft text-ai",
  neutral: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export interface KpiCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: number; // percent change vs previous period
  deltaLabel?: string;
  invertDelta?: boolean; // e.g. lower is better
  hint?: string;
  sub?: React.ReactNode;
  className?: string;
}

export function KpiCard({ label, value, icon: Icon, tone = "brand", delta, deltaLabel = "vs previous period", invertDelta, hint, sub, className }: KpiCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta! > 0.05;
  const down = hasDelta && delta! < -0.05;
  const good = invertDelta ? down : up;
  const bad = invertDelta ? up : down;
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
          {label}
          {hint && (
            <Hint content={hint}>
              <button type="button" aria-label={`About ${label}`} className="rounded text-muted-foreground/70 hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
            </Hint>
          )}
        </div>
        {Icon && <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight num">{value}</div>
      <div className="mt-1.5 flex min-h-[18px] flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {hasDelta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium num", good && "text-positive", bad && "text-destructive")}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : down ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {Math.abs(delta!).toFixed(1)}%
          </span>
        )}
        {hasDelta && <span>{deltaLabel}</span>}
        {sub}
      </div>
    </Card>
  );
}
