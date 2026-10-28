import type { LucideIcon } from "lucide-react";
import { ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Tone = "brand" | "action" | "positive" | "warning" | "ai" | "destructive";
const TONE: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  action: "bg-action-soft text-action",
  positive: "bg-positive-soft text-positive",
  warning: "bg-warning-soft text-warning",
  ai: "bg-ai-soft text-ai",
  destructive: "bg-destructive/10 text-destructive",
};

export interface QuickAction { label: string; description: string; icon: LucideIcon; tone?: Tone; to?: string; onClick?: () => void; busy?: boolean; badge?: React.ReactNode }

/** Grid of large, labelled action tiles — each either navigates (`to`) or runs `onClick`. */
export function QuickActions({ actions, className }: { actions: QuickAction[]; className?: string }) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {actions.map((a) => {
        const inner = (
          <>
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONE[a.tone ?? "action"])}>
              {a.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <a.icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">{a.label}{a.badge}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </>
        );
        const cls = "group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-action/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
        return a.to ? (
          <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
        ) : (
          <button key={a.label} type="button" onClick={a.onClick} disabled={a.busy} className={cls}>{inner}</button>
        );
      })}
    </div>
  );
}
