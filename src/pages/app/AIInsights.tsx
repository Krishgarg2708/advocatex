import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BrainCircuit, Info, Lightbulb, LineChart, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/PageHeader";
import { AIChatPanel } from "./components/AIChatPanel";
import { useScope } from "@/hooks/useScope";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { buildInsights, buildRecommendations, type Confidence, type InsightInput, type InsightKind } from "@/lib/insights";
import { rangeLabel } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const KIND: Record<InsightKind, { icon: LucideIcon; label: string; cls: string }> = {
  opportunity: { icon: Lightbulb, label: "Opportunity", cls: "bg-positive-soft text-positive" },
  risk: { icon: AlertTriangle, label: "Needs attention", cls: "bg-warning-soft text-warning" },
  trend: { icon: LineChart, label: "Trend", cls: "bg-action-soft text-action" },
  info: { icon: Info, label: "Info", cls: "bg-muted text-muted-foreground" },
};
const CONF: Record<Confidence, { label: string; dots: number; hint: string }> = {
  high: { label: "High confidence", dots: 3, hint: "Based on a large sample (100+ referral events) or an exact count." },
  medium: { label: "Medium confidence", dots: 2, hint: "Based on a moderate sample (30–99 referral events)." },
  low: { label: "Low confidence", dots: 1, hint: "Based on a small sample (under 30 events) — treat as directional." },
};
const PRIORITY: Record<"high" | "medium" | "low", { label: string; variant: "destructive" | "warning" | "muted" }> = {
  high: { label: "High", variant: "destructive" }, medium: { label: "Medium", variant: "warning" }, low: { label: "Low", variant: "muted" },
};

export default function AIInsights() {
  const { role, brandId } = useCurrentUser();
  const scope = useScope();
  const range = useUIStore((s) => s.dateRange);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const flags = useDataStore((s) => s.flags);
  const { brandById } = useLookups();

  const input = useMemo<InsightInput>(() => ({
    campaigns: scope.campaigns, referrals: scope.referrals, rewards: scope.rewards, products: scope.products, shops, mechanics, flags, range, role,
  }), [scope, shops, mechanics, flags, range, role]);
  const insights = useMemo(() => buildInsights(input), [input]);
  const recs = useMemo(() => buildRecommendations(insights, role), [insights, role]);

  const scopeLabel = role === "admin" ? "All brands" : role === "brand" ? brandById.get(brandId ?? "")?.name ?? "Your brand" : "Your referrals";
  const counts = insights.reduce<Record<InsightKind, number>>((acc, i) => ({ ...acc, [i.kind]: acc[i.kind] + 1 }), { opportunity: 0, risk: 0, trend: 0, info: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Badge variant="ai"><BrainCircuit />AI Demo Insights</Badge>}
        title="AI Demo Insights"
        description={`Rule-based insights and a simulated assistant for ${scopeLabel.toLowerCase() === "your referrals" ? "your referrals" : scopeLabel} · ${rangeLabel(range)}`}
        actions={<Button variant="outline" asChild><Link to="/app/analytics"><LineChart />Open analytics</Link></Button>}
      />

      <div className="flex items-start gap-3 rounded-xl border border-ai/20 bg-ai-soft/60 px-4 py-3 text-[13px]" role="note">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ai" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Responses are simulated.</span> Insights and assistant answers are produced by a deterministic rule engine running on demo data in your browser — no AI model is called and no data leaves this device.
          A real AI service must be connected through a secure backend; API keys must never be exposed in the browser.
        </p>
      </div>

      {/* insight cards */}
      <section aria-labelledby="ins-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="ins-h" className="text-[15px] font-semibold tracking-tight">Insights</h2>
            <p className="text-[13px] text-muted-foreground">Only shown when the data supports them · {rangeLabel(range)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(Object.keys(KIND) as InsightKind[]).filter((k) => counts[k]).map((k) => <Badge key={k} variant="outline" className="font-normal">{counts[k]} {KIND[k].label.toLowerCase()}</Badge>)}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((i) => {
            const k = KIND[i.kind];
            const Icon = k.icon;
            const c = CONF[i.confidence];
            return (
              <Card key={i.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold", k.cls)}><Icon className="h-3.5 w-3.5" />{k.label}</span>
                  <Hint content={c.hint}>
                    <button type="button" className="inline-flex items-center gap-1 rounded text-[11px] text-muted-foreground hover:text-foreground" aria-label={`${c.label}. ${c.hint}`}>
                      <span className="flex gap-0.5" aria-hidden>{[1, 2, 3].map((n) => <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= c.dots ? "bg-ai" : "bg-muted")} />)}</span>
                      {c.label}
                    </button>
                  </Hint>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug">{i.title}</h3>
                <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground num">{i.detail}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  {i.metric ? (
                    <span className="inline-flex items-baseline gap-1.5 rounded-md bg-muted/70 px-2 py-1 text-xs"><span className="text-muted-foreground">{i.metric.label}</span><span className="font-semibold num">{i.metric.value}</span></span>
                  ) : <span />}
                  {i.action && <Button variant="ghost" size="sm" className="text-ai hover:text-ai" asChild><Link to={i.action.to}>{i.action.label}<ArrowRight /></Link></Button>}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start">
        <AIChatPanel input={input} className="lg:sticky lg:top-20 lg:col-span-3" />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-ai" />Recommended actions</CardTitle>
            <CardDescription>Derived from the insights above, highest priority first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recs.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-[13px] text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-4 w-4 text-ai" />No actions needed for this period — metrics are within normal ranges.
              </div>
            )}
            {[...recs].sort((a, b) => ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority)).map((r, idx) => (
              <div key={r.id} className="rounded-lg border p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ai-soft text-xs font-semibold text-ai num">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{r.title}</span><Badge variant={PRIORITY[r.priority].variant}>{PRIORITY[r.priority].label}</Badge></div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground num">{r.detail}</p>
                    <Button variant="outline" size="sm" className="mt-2.5" asChild><Link to={r.to}>{r.cta}<ArrowRight /></Link></Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
