import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Calculator, CheckCircle2, Coins, Download, IndianRupee, Percent, Sparkles, Target, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { TierBadge } from "@/components/shared/TierBadge";
import { C, ChartCard, ChartTooltip, FunnelBars, Legend } from "@/components/shared/charts";
import { AnalyticsFilters, EMPTY_ANALYTICS_FILTERS, type AnalyticsFilterState } from "./components/AnalyticsFilters";
import { useScope } from "@/hooks/useScope";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import {
  DAY_MS, LOYALTY_TIERS, campaignParticipants, campaignStats, customerLoyalty, delta, funnel, leaderboard, previousRange, rangeBounds, rangeDays,
  rangeLabel, refsInRange, spendOf, wallet,
} from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPercent, formatRatio } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { DateRange, Referral, RewardTxn } from "@/types";

/* ---------- bucket helpers (cohort by click date, so every chart sums to the KPI row) ---------- */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function buckets(r: DateRange): { label: string; range: DateRange }[] {
  const step = rangeDays(r) > 45 ? 7 : 1;
  const { to } = rangeBounds(r);
  const out: { label: string; range: DateRange }[] = [];
  for (let t = rangeBounds(r).from; t <= to; t += step * DAY_MS) {
    const start = new Date(t);
    const end = new Date(Math.min(to, t + (step - 1) * DAY_MS));
    out.push({ label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), range: { preset: "custom", from: ymd(start), to: ymd(end) } });
  }
  return out;
}
const short = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface CampTipProps { active?: boolean; payload?: { payload?: { name: string; clicks: number; verified: number; conv: number; revenue: number; roas: number } }[]; showRoas: boolean }
function CampaignTip({ active, payload, showRoas }: CampTipProps) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const row = (k: string, v: string) => <div className="flex justify-between gap-4 text-muted-foreground"><span>{k}</span><span className="font-medium text-foreground num">{v}</span></div>;
  return (
    <div className="min-w-[190px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lift">
      <div className="mb-1.5 font-medium text-foreground">{d.name}</div>
      {row("Referral clicks", formatNumber(d.clicks))}
      {row("Verified conversions", formatNumber(d.verified))}
      {row("Conversion rate", formatPercent(d.conv))}
      {row("Attributed revenue", formatCurrency(d.revenue))}
      {showRoas && row("ROAS", formatRatio(d.roas))}
    </div>
  );
}
interface BudgetTipProps { active?: boolean; payload?: { payload?: { name: string; util: number; spend: number; budget: number } }[]; showAmounts: boolean }
function BudgetTip({ active, payload, showAmounts }: BudgetTipProps) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="min-w-[190px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lift">
      <div className="mb-1.5 font-medium text-foreground">{d.name}</div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Budget used</span><span className="font-medium text-foreground num">{formatPercent(d.util)}</span></div>
      {showAmounts && <div className="flex justify-between gap-4 text-muted-foreground"><span>Spend / budget</span><span className="font-medium text-foreground num">{formatCurrency(d.spend)} / {formatCurrency(d.budget)}</span></div>}
    </div>
  );
}

export default function Analytics() {
  const { role, brandId, advocateId } = useCurrentUser();
  const scope = useScope();
  const range = useUIStore((s) => s.dateRange);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const customers = useDataStore((s) => s.customers);
  const loyalty = useDataStore((s) => s.loyalty);
  const allReferrals = useDataStore((s) => s.referrals);
  const allRewards = useDataStore((s) => s.rewards);
  const { brandById, productById, campaignById } = useLookups();
  const [filters, setFilters] = useState<AnalyticsFilterState>(EMPTY_ANALYTICS_FILTERS);

  const isAdvocate = role === "shop" || role === "mechanic";
  const scopeLabel = role === "admin" ? "All brands" : role === "brand" ? brandById.get(brandId ?? "")?.name ?? "Your brand" : "Your referral performance";

  const d = useMemo(() => {
    const f = filters;
    const matchRef = (r: Referral) =>
      (f.campaignId === "all" || r.campaignId === f.campaignId) &&
      (f.productId === "all" || r.productId === f.productId) &&
      (isAdvocate || f.advocateType === "all" || r.advocateType === f.advocateType);
    const refs = scope.referrals.filter(matchRef);
    const refIds = new Set(refs.map((r) => r.id));
    const matchTxn = (t: RewardTxn) =>
      (f.campaignId === "all" || t.campaignId === f.campaignId) &&
      (f.productId === "all" || (!!t.referralId && refIds.has(t.referralId))) &&
      (isAdvocate || f.advocateType === "all" || t.advocateType === f.advocateType);
    const rewards = scope.rewards.filter(matchTxn);

    const cohort = refsInRange(refs, range);
    const prevRange = previousRange(range);
    const cur = funnel(cohort);
    const prev = funnel(refsInRange(refs, prevRange));
    const spend = spendOf(rewards, () => true, range);
    const prevSpend = spendOf(rewards, () => true, prevRange);
    const roas = spend ? cur.revenue / spend : 0;
    const prevRoas = prevSpend ? prev.revenue / prevSpend : 0;
    // redemption rate is lifetime and payouts are per advocate (not per campaign/product)
    const payoutScope = scope.rewards.filter((t) => isAdvocate || f.advocateType === "all" || t.advocateType === f.advocateType);
    const w = wallet(payoutScope);

    // daily / weekly series
    const series = buckets(range).map((b) => {
      const inB = refsInRange(cohort, b.range);
      const bf = funnel(inB);
      const shopV = inB.filter((r) => r.advocateType === "shop" && r.status === "verified").length;
      return {
        label: b.label, from: b.range.from, to: b.range.to,
        clicks: bf.clicks, leads: bf.leads, verified: bf.verified, conv: bf.conversionRate, revenue: bf.revenue,
        commission: spendOf(rewards, (t) => t.type === "commission", b.range), bonus: spendOf(rewards, (t) => t.type === "bonus", b.range),
        shopVerified: shopV, mechanicVerified: bf.verified - shopV,
      };
    });

    // campaigns
    const campList = scope.campaigns.filter((c) => f.campaignId === "all" || c.id === f.campaignId);
    const campRows = campList.map((c) => {
      const s = campaignStats(c, refs, rewards, campaignParticipants(c, shops, mechanics), range);
      const lifetime = spendOf(scope.rewards, (t) => t.campaignId === c.id);
      return { id: c.id, name: c.name, short: short(c.name, 18), status: c.status, clicks: s.clicks, leads: s.leads, verified: s.verified, conv: s.conversionRate, revenue: s.revenue, spend: s.spend, roas: s.roas, budget: c.budget, lifetimeSpend: lifetime, util: c.budget ? (lifetime / c.budget) * 100 : 0 };
    });
    const campPerf = campRows.filter((x) => x.clicks > 0).sort((a, b) => b.verified - a.verified);
    const budgetRows = campRows.filter((x) => x.budget > 0 && x.status !== "draft" && (!isAdvocate || x.lifetimeSpend > 0 || x.status === "active")).sort((a, b) => b.util - a.util);

    // products
    const prodRows = Array.from(new Set(cohort.map((r) => r.productId)))
      .map((pid) => { const pf = funnel(cohort.filter((r) => r.productId === pid)); return { id: pid, name: productById.get(pid)?.name ?? pid, short: short(productById.get(pid)?.name ?? pid, 26), revenue: pf.revenue, verified: pf.verified, clicks: pf.clicks, conv: pf.conversionRate }; })
      .filter((x) => x.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    // leaderboard
    let board: ReturnType<typeof leaderboard> = [];
    let rankBoard: ReturnType<typeof leaderboard> = [];
    if (!isAdvocate) {
      board = leaderboard(shops, mechanics, refs, rewards, range, f.advocateType === "all" ? undefined : f.advocateType).filter((x) => x.clicks > 0);
    } else {
      const netRefs = allReferrals.filter((r) => (f.campaignId === "all" || r.campaignId === f.campaignId) && (f.productId === "all" || r.productId === f.productId));
      rankBoard = leaderboard(shops, mechanics, netRefs, allRewards, range, role as "shop" | "mechanic");
    }

    // shop vs mechanic (advocates: network benchmark, aggregates only)
    let benchmark: { name: string; conv: number; perAdvocate: number; you?: boolean }[] = [];
    if (isAdvocate) {
      const netCohort = refsInRange(allReferrals.filter((r) => (f.campaignId === "all" || r.campaignId === f.campaignId) && (f.productId === "all" || r.productId === f.productId)), range);
      const agg = (t: "shop" | "mechanic") => {
        const rr = netCohort.filter((r) => r.advocateType === t);
        const n = new Set(rr.map((r) => r.advocateId)).size;
        const ff = funnel(rr);
        return { conv: ff.conversionRate, perAdvocate: n ? ff.verified / n : 0 };
      };
      benchmark = [
        { name: "Shops (avg)", ...agg("shop") },
        { name: "Mechanics (avg)", ...agg("mechanic") },
        { name: "You", conv: cur.conversionRate, perAdvocate: cur.verified, you: true },
      ];
    }

    // loyalty tiers (current tier of customers in scope)
    const custIds = role === "admin" && f.campaignId === "all" && f.productId === "all" && f.advocateType === "all"
      ? customers.map((c) => c.id)
      : Array.from(new Set(refs.map((r) => r.customerId).filter((x): x is string => !!x)));
    const tierCounts = new Map<string, number>(LOYALTY_TIERS.map((t) => [t.tier, 0]));
    for (const id of custIds) { const t = customerLoyalty(loyalty, id).tier; tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1); }
    const tiers = LOYALTY_TIERS.map((t) => ({ tier: t.tier, customers: tierCounts.get(t.tier) ?? 0 }));

    return { refs, rewards, cohort, cur, prev, spend, prevSpend, roas, prevRoas, w, series, campPerf, budgetRows, prodRows, board, rankBoard, benchmark, tiers, customerCount: custIds.length };
  }, [filters, scope, range, isAdvocate, role, shops, mechanics, customers, loyalty, allReferrals, allRewards, productById]);

  const { cur, prev } = d;
  const weekly = rangeDays(range) > 45;
  const bucketWord = weekly ? "weekly" : "daily";
  const filterNote = [
    filters.campaignId !== "all" && campaignById.get(filters.campaignId)?.name,
    filters.productId !== "all" && productById.get(filters.productId)?.name,
    filters.advocateType !== "all" && (filters.advocateType === "shop" ? "Shops only" : "Mechanics only"),
  ].filter(Boolean).join(" · ");
  const redemptionNA = role === "brand";

  const exportReport = () => {
    const base = { section: "", item: "", period: "", clicks: "", leads: "", verified: "", conversion_rate_pct: "", attributed_revenue_inr: "", reward_spend_inr: "", roas: "", budget_used_pct: "", value: "" };
    const rows: Record<string, unknown>[] = [
      { ...base, section: "Report", item: "Scope", value: scopeLabel },
      { ...base, section: "Report", item: "Date range", period: `${range.from} to ${range.to}`, value: rangeLabel(range) },
      { ...base, section: "Report", item: "Filters", value: filterNote || "None" },
      { ...base, section: "Summary", item: "Referral clicks", value: cur.clicks },
      { ...base, section: "Summary", item: "Qualified leads", value: cur.leads },
      { ...base, section: "Summary", item: "Verified conversions", value: cur.verified },
      { ...base, section: "Summary", item: "Conversion rate (%)", value: cur.conversionRate.toFixed(2) },
      { ...base, section: "Summary", item: "Attributed revenue (INR, not profit)", value: Math.round(cur.revenue) },
      { ...base, section: "Summary", item: "Campaign spend (INR)", value: Math.round(d.spend) },
      { ...base, section: "Summary", item: "ROAS", value: d.roas.toFixed(2) },
      { ...base, section: "Summary", item: "Reward redemption rate (%, lifetime)", value: redemptionNA ? "n/a" : d.w.redemptionRate.toFixed(2) },
      ...d.series.map((s) => ({ ...base, section: weekly ? "Weekly" : "Daily", item: s.label, period: s.from === s.to ? s.from : `${s.from} to ${s.to}`, clicks: s.clicks, leads: s.leads, verified: s.verified, conversion_rate_pct: s.conv.toFixed(2), attributed_revenue_inr: Math.round(s.revenue), reward_spend_inr: s.commission + s.bonus })),
      ...d.campPerf.map((c) => ({ ...base, section: "Campaign", item: c.name, period: rangeLabel(range), clicks: c.clicks, leads: c.leads, verified: c.verified, conversion_rate_pct: c.conv.toFixed(2), attributed_revenue_inr: Math.round(c.revenue), reward_spend_inr: isAdvocate ? "" : c.spend, roas: isAdvocate ? "" : c.roas.toFixed(2), budget_used_pct: c.util.toFixed(1) })),
    ];
    downloadCSV(`advocatex-analytics_${range.from}_to_${range.to}.csv`, rows);
    toast.success("Report exported", { description: `${rows.length} rows · ${rangeLabel(range)}` });
  };

  const me = d.rankBoard.find((x) => x.id === advocateId);
  const rankTop = d.rankBoard.slice(0, 8);
  const boardMax = Math.max(1, ...(isAdvocate ? rankTop : d.board.slice(0, 10)).map((x) => x.verified));
  const totalReward = d.series.reduce((s, x) => s + x.commission + x.bonus, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Badge variant="secondary"><BarChart3 />{scopeLabel}</Badge>}
        title="Analytics & reports"
        description={`Referral performance, conversions, reward spend and loyalty · ${rangeLabel(range)}${filterNote ? ` · ${filterNote}` : ""}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/app/ai"><Sparkles />AI demo insights</Link></Button>
          <Button onClick={exportReport}><Download />Export Report</Button>
        </>}
      />

      <AnalyticsFilters value={filters} onChange={setFilters} campaigns={scope.campaigns} products={scope.products} showAdvocateType={!isAdvocate} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Verified conversions" value={formatNumber(cur.verified)} icon={CheckCircle2} tone="positive" delta={delta(cur.verified, prev.verified)}
          hint="Count of referrals clicked in the period whose purchase was verified against an invoice." />
        <KpiCard label="Conversion rate" value={formatPercent(cur.conversionRate)} icon={Percent} tone="action" delta={delta(cur.conversionRate, prev.conversionRate)}
          hint="Verified conversions ÷ eligible referral visits (clicks) × 100." sub={<span className="num">{formatNumber(cur.clicks)} visits</span>} />
        <KpiCard label="Attributed revenue" value={formatCurrency(cur.revenue)} icon={IndianRupee} tone="brand" delta={delta(cur.revenue, prev.revenue)}
          hint="Sum of purchase values on verified conversions. This is attributed revenue, not profit." />
        <KpiCard label={isAdvocate ? "Rewards earned" : "Campaign spend"} value={formatCurrency(d.spend)} icon={Coins} tone="warning" delta={delta(d.spend, d.prevSpend)} invertDelta={!isAdvocate}
          hint="Advocate rewards accrued in the period (commission + bonus, pending or approved; reversals excluded)." />
        <KpiCard label="ROAS" value={formatRatio(d.roas)} icon={Target} tone="positive" delta={delta(d.roas, d.prevRoas)}
          hint="Campaign ROAS = attributed revenue ÷ campaign spend (advocate rewards)." />
        <KpiCard label="Reward redemption rate" value={redemptionNA ? "—" : formatPercent(d.w.redemptionRate)} icon={Wallet} tone="ai"
          hint={redemptionNA ? "Paid-out rewards ÷ approved rewards × 100. Payouts are settled per advocate across all brands, so they can't be attributed to a single brand." : "Paid-out rewards ÷ approved (redeemable) rewards × 100. Lifetime; not affected by campaign or product filters."}
          sub={redemptionNA ? <span>Not attributable per brand</span> : <span className="num">{formatCurrency(d.w.paidOut)} of {formatCurrency(d.w.approved)}</span>} />
      </div>

      {cur.clicks === 0 && (
        <Card><EmptyState icon={BarChart3} title="No referral activity for these filters" description="Try a longer date range or clear the campaign, product and advocate filters."
          action={<Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_ANALYTICS_FILTERS)}>Clear filters</Button>} /></Card>
      )}

      {/* 1 + 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Referral trends" description={`Referral clicks and qualified leads, ${bucketWord}. Leads are counted on the day of the original click.`}
          action={<Legend items={[{ label: "Clicks", color: C.c2 }, { label: "Leads", color: C.c1 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="anClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity={0.25} /><stop offset="100%" stopColor={C.c2} stopOpacity={0} /></linearGradient>
                  <linearGradient id="anLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c1} stopOpacity={0.25} /><stop offset="100%" stopColor={C.c1} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke={C.c2} strokeWidth={2} fill="url(#anClicks)" />
                <Area type="monotone" dataKey="leads" name="Leads" stroke={C.c1} strokeWidth={2} fill="url(#anLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Conversion trends" description={`Verified conversions (bars) and conversion rate (line) by click date, ${bucketWord}.`}
          action={<Legend items={[{ label: "Verified", color: C.c3 }, { label: "Conversion rate", color: C.c5, dashed: true }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.series} margin={{ top: 8, right: -8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="v" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={44} />
                <Tooltip content={<ChartTooltip format={(v, k) => (k === "conv" ? formatPercent(v) : formatNumber(v))} />} />
                <Bar yAxisId="v" dataKey="verified" name="Verified" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Line yAxisId="r" type="monotone" dataKey="conv" name="Conversion rate" stroke={C.c5} strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* 3 + 4 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-2" title="Conversion funnel" description="Referrals clicked in the period and how far each progressed. A click is never counted as a sale."
          footer={<span className="num">{formatNumber(cur.pending)} pending verification · {formatNumber(cur.rejected)} rejected · overall {formatPercent(cur.conversionRate)} click → verified</span>}>
          <FunnelBars stages={[
            { label: "Referral clicks", value: cur.clicks },
            { label: "Qualified leads", value: cur.leads },
            { label: "Purchase claims", value: cur.purchases },
            { label: "Verified conversions", value: cur.verified },
          ]} />
        </ChartCard>

        <ChartCard className="lg:col-span-3" title="Campaign performance comparison" description="Referral clicks vs verified conversions per campaign. Hover for conversion rate, revenue and ROAS."
          action={<Legend items={[{ label: "Clicks", color: C.c2 }, { label: "Verified", color: C.c3 }]} />}>
          {d.campPerf.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.campPerf} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="short" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} height={36} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<CampaignTip showRoas={!isAdvocate} />} />
                  <Bar dataKey="clicks" name="Clicks" fill={C.c2} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="verified" name="Verified" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No campaign activity" description="No referrals for the selected campaigns in this period." className="py-10" />}
        </ChartCard>
      </div>

      {/* 5 + 6 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={isAdvocate ? "Your leaderboard position" : "Advocate leaderboard"}
          description={isAdvocate ? `${role === "shop" ? "Shops" : "Mechanics"} ranked by verified conversions · names and counts only` : "Top 10 advocates by verified conversions in the period"}
          action={<Legend items={[{ label: "Verified", color: C.c1 }]} />}>
          {isAdvocate ? (
            <div className="space-y-3">
              {me && (
                <div className="flex items-center gap-3 rounded-lg bg-brand-soft p-3 ring-1 ring-brand/20">
                  <Trophy className="h-5 w-5 text-warning" />
                  <div className="flex-1 text-sm"><span className="font-semibold">You're #{me.rank}</span> <span className="text-muted-foreground">of {d.rankBoard.length} verified {role === "shop" ? "shops" : "mechanics"}</span></div>
                  <div className="text-sm font-semibold num">{me.verified} verified</div>
                </div>
              )}
              <ol className="space-y-2.5">
                {rankTop.map((x) => (
                  <li key={x.id} className={cn("rounded-md px-1", x.id === advocateId && "bg-brand-soft/60")}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2"><span className="w-5 text-right text-xs font-semibold text-muted-foreground num">{x.rank}</span><span className="truncate font-medium">{x.name}{x.id === advocateId && <span className="ml-1 text-xs text-brand">(you)</span>}</span></span>
                      <span className="font-semibold num">{x.verified}</span>
                    </div>
                    <div className="ml-7 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(x.verified ? 2 : 0, (x.verified / boardMax) * 100)}%`, background: x.id === advocateId ? C.c3 : C.c1 }} /></div>
                  </li>
                ))}
              </ol>
              {me && !rankTop.some((x) => x.id === advocateId) && <p className="text-xs text-muted-foreground">{me.rank - rankTop[rankTop.length - 1]!.rank} places outside the top {rankTop.length}. {Math.max(0, rankTop[rankTop.length - 1]!.verified - me.verified + 1)} more verified conversions would move you into it.</p>}
            </div>
          ) : d.board.length ? (
            <ol className="space-y-2.5">
              {d.board.slice(0, 10).map((x) => (
                <li key={x.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                    <Link to={x.type === "shop" ? `/app/shops?open=${x.id}` : `/app/mechanics?open=${x.id}`} className="flex min-w-0 items-center gap-2 hover:text-action">
                      <span className="w-5 text-right text-xs font-semibold text-muted-foreground num">{x.rank}</span>
                      <EntityAvatar name={x.name} hue={x.hue} size="sm" type={x.type} />
                      <span className="truncate font-medium">{x.name}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{x.type === "shop" ? "Shop" : "Mechanic"} · {x.city}</span>
                    </Link>
                    <span className="shrink-0 text-right num"><span className="font-semibold">{x.verified}</span><span className="ml-2 text-xs text-muted-foreground">{formatPercent(x.conversionRate)} · {formatCurrency(x.revenue, { compact: true })}</span></span>
                  </div>
                  <div className="ml-7 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(x.verified ? 2 : 0, (x.verified / boardMax) * 100)}%`, background: x.type === "shop" ? C.c1 : C.c4 }} /></div>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No advocate activity" className="py-10" />}
        </ChartCard>

        <ChartCard title={isAdvocate ? "Reward earnings" : "Reward expenditure"} description={`Advocate rewards accrued ${bucketWord} (commission + bonus, reversals excluded) · total ${formatCurrency(totalReward)}`}
          action={<Legend items={[{ label: "Commission", color: C.c3 }, { label: "Bonus", color: C.c4 }]} />}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series} margin={{ top: 8, right: 4, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
                <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<ChartTooltip format={(v) => formatCurrency(v)} />} />
                <Bar dataKey="commission" name="Commission" stackId="r" fill={C.c3} maxBarSize={22} />
                <Bar dataKey="bonus" name="Bonus" stackId="r" fill={C.c4} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* 7 + 8 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue by product" description="Attributed revenue from verified conversions, top 8 products. Not profit."
          action={<Legend items={[{ label: "Attributed revenue", color: C.c1 }]} />}>
          {d.prodRows.length ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.prodRows.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} />
                  <YAxis type="category" dataKey="short" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<ChartTooltip format={(v) => formatCurrency(v)} />} />
                  <Bar dataKey="revenue" name="Attributed revenue" fill={C.c1} radius={[0, 3, 3, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No verified purchases" description="Revenue appears once referrals are verified." className="py-10" />}
        </ChartCard>

        {isAdvocate ? (
          <ChartCard title="Shop vs mechanic performance" description="Network conversion rate by advocate type compared with yours (aggregates only)."
            action={<Legend items={[{ label: "Network average", color: C.c1 }, { label: "You", color: C.c3 }]} />}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.benchmark} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<ChartTooltip format={(v) => formatPercent(v)} />} />
                  <Bar dataKey="conv" name="Conversion rate" radius={[3, 3, 0, 0]} maxBarSize={56}>
                    {d.benchmark.map((b) => <Cell key={b.name} fill={b.you ? C.c3 : C.c1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : (
          <ChartCard title="Shop vs mechanic performance" description={`Verified conversions by advocate type, ${bucketWord}, by click date.`}
            action={<Legend items={[{ label: "Shops", color: C.c1 }, { label: "Mechanics", color: C.c4 }]} />}
            footer={<span className="num">Shops {formatNumber(d.series.reduce((s, x) => s + x.shopVerified, 0))} · Mechanics {formatNumber(d.series.reduce((s, x) => s + x.mechanicVerified, 0))} verified conversions</span>}>
            <div className="h-[268px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="shopVerified" name="Shops" stackId="t" stroke={C.c1} fill={C.c1} fillOpacity={0.25} strokeWidth={2} />
                  <Area type="monotone" dataKey="mechanicVerified" name="Mechanics" stackId="t" stroke={C.c4} fill={C.c4} fillOpacity={0.25} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>

      {/* 9 + 10 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-2" title="Loyalty-tier distribution"
          description={role === "admin" ? `Current tier of ${formatNumber(d.customerCount)} customers (lifetime points)` : `Current tier of ${formatNumber(d.customerCount)} customers ${isAdvocate ? "you referred" : "referred through your campaigns"}`}
          footer={<div className="flex flex-wrap gap-1.5">{LOYALTY_TIERS.map((t) => <TierBadge key={t.tier} tier={t.tier} />)}<span className="ml-1 self-center">tiers by lifetime points</span></div>}>
          {d.customerCount ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.tiers} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="tier" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<ChartTooltip format={(v) => `${formatNumber(v)} customers`} />} />
                  <Bar dataKey="customers" name="Customers" radius={[3, 3, 0, 0]} maxBarSize={48}>
                    {d.tiers.map((t, i) => <Cell key={t.tier} fill={[C.muted, C.c2, C.c5, C.c4][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No referred customers yet" className="py-10" />}
        </ChartCard>

        <ChartCard className="lg:col-span-3" title="Campaign budget utilisation" description="Lifetime reward spend as a share of each campaign's budget. Campaigns at 85% or more are highlighted."
          action={<Legend items={[{ label: "Below 85%", color: C.c1 }, { label: "85%+", color: C.c5 }, { label: "Budget (100%)", color: C.muted, dashed: true }]} />}>
          {d.budgetRows.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.budgetRows} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="short" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} height={36} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, (max: number) => Math.max(110, Math.ceil(max / 10) * 10)]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<BudgetTip showAmounts={!isAdvocate} />} />
                  <ReferenceLine y={100} stroke={C.muted} strokeDasharray="4 4" label={{ value: "Budget", position: "insideTopRight", fill: C.muted, fontSize: 10 }} />
                  <Bar dataKey="util" name="Budget used" radius={[3, 3, 0, 0]} maxBarSize={36}>
                    {d.budgetRows.map((b) => <Cell key={b.id} fill={b.util >= 85 ? C.c5 : C.c1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="No campaign budgets to show" className="py-10" />}
        </ChartCard>
      </div>

      {/* formulas */}
      <Card>
        <CardContent className="px-5 py-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="formulas" className="border-b-0">
              <AccordionTrigger><span className="flex items-center gap-2"><Calculator className="h-4 w-4 text-muted-foreground" />How metrics are calculated</span></AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Conversion rate", "Verified conversions ÷ eligible referral visits (clicks) × 100."],
                    ["Verified conversion", "A referral whose purchase claim was checked against an invoice. Clicks and leads are never counted as sales."],
                    ["Attributed revenue", "Sum of purchase values on verified conversions. It is attributed revenue, not profit — product cost, margins and overheads are not deducted."],
                    ["Campaign spend", "Advocate rewards accrued (commission + bonus, pending or approved). Reversed rewards are excluded."],
                    ["Campaign ROAS", "Attributed revenue ÷ campaign spend."],
                    ["Reward redemption rate", "Paid-out rewards ÷ approved (redeemable) rewards × 100, lifetime."],
                    ["Budget utilisation", "Lifetime campaign spend ÷ campaign budget × 100."],
                    ["Period & cohort", `Funnel metrics use referrals clicked within ${rangeLabel(range)}; deltas compare with the previous period of equal length. Charts use the same referral set, so totals agree with the KPI row.`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border bg-muted/30 p-3">
                      <dt className="text-[13px] font-medium text-foreground">{k}</dt>
                      <dd className="mt-0.5 text-xs">{v}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
