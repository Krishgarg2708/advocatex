import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, CheckCircle2, Coins, Download, IndianRupee, Link2, MousePointerClick, PackagePlus, Percent, Plus, TrendingUp, Trophy, UserCheck,
  UserPlus, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { C, ChartCard, ChartTooltip, FunnelBars, Legend } from "@/components/shared/charts";
import { QuickActions } from "./components/QuickActions";
import { InviteAdvocateDialog } from "./components/InviteAdvocateDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { campaignParticipants, campaignStats, delta, funnel, leaderboard, previousRange, rangeLabel, refsInRange, spendOf, timeSeries, type AdvocateRow } from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPercent, formatRatio } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

const money = (v: number, key: string) => (key === "revenue" || key === "spend" || key === "budget" ? formatCurrency(v) : formatNumber(v));

function Leaderboard({ rows, empty }: { rows: AdvocateRow[]; empty: string }) {
  if (!rows.length) return <EmptyState icon={Trophy} title={empty} description="Advocates appear here once they convert in this period." className="py-8" />;
  const max = Math.max(1, ...rows.map((x) => x.revenue));
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <Link to={`/app/${r.type === "shop" ? "shops" : "mechanics"}?open=${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50">
            <span className={cn("w-5 text-center text-sm font-semibold num", r.rank <= 3 ? "text-warning" : "text-muted-foreground")}>{r.rank}</span>
            <EntityAvatar name={r.name} hue={r.hue} size="sm" type={r.type} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold num">{formatCurrency(r.revenue, { compact: true })}</div>
              <div className="text-[11px] text-muted-foreground num">{r.verified} sales · {formatPercent(r.conversionRate)}</div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function BrandDashboard() {
  const navigate = useNavigate();
  const { brandId, user } = useCurrentUser();
  const scope = useScope();
  const range = useUIStore((s) => s.dateRange);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const { brandById } = useLookups();
  const brand = brandId ? brandById.get(brandId) : undefined;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [compareMetric, setCompareMetric] = useState<"volume" | "money">("volume");

  const data = useMemo(() => {
    const prevR = previousRange(range);
    const inR = refsInRange(scope.referrals, range);
    const inP = refsInRange(scope.referrals, prevR);
    const cur = funnel(inR), prev = funnel(inP);
    const spend = spendOf(scope.rewards, undefined, range);
    const prevSpend = spendOf(scope.rewards, undefined, prevR);
    const activeAdv = new Set(inR.map((r) => r.advocateId)).size;
    const prevActiveAdv = new Set(inP.map((r) => r.advocateId)).size;
    const roas = spend ? cur.revenue / spend : 0;
    const prevRoas = prevSpend ? prev.revenue / prevSpend : 0;

    const series = timeSeries(scope.referrals, scope.rewards, range);
    const camps = scope.campaigns.map((c) => ({ c, s: campaignStats(c, scope.referrals, scope.rewards, campaignParticipants(c, shops, mechanics), range) }));
    const comparison = camps.map(({ c, s }) => ({ name: c.name, clicks: s.clicks, leads: s.leads, verified: s.verified, revenue: s.revenue, spend: s.spend }));
    const spending = camps.map(({ c, s }) => ({ c, spend: s.spend, totalSpent: (s.budgetUtil / 100) * c.budget, util: s.budgetUtil })).sort((a, b) => b.spend - a.spend);

    const topShops = leaderboard(shops, mechanics, scope.referrals, scope.rewards, range, "shop").filter((r) => r.clicks > 0).slice(0, 5);
    const topMechs = leaderboard(shops, mechanics, scope.referrals, scope.rewards, range, "mechanic").filter((r) => r.clicks > 0).slice(0, 5);

    // engagement: advocates enrolled in at least one brand campaign, banded by clicks in range
    const brandCampIds = new Set(scope.campaigns.map((c) => c.id));
    const enrolled = [...shops, ...mechanics].filter((a) => a.status === "verified" && a.campaignIds.some((id) => brandCampIds.has(id)));
    const clicksBy = new Map<string, number>(); const convBy = new Map<string, number>();
    for (const r of inR) { clicksBy.set(r.advocateId, (clicksBy.get(r.advocateId) ?? 0) + 1); if (r.status === "verified") convBy.set(r.advocateId, (convBy.get(r.advocateId) ?? 0) + 1); }
    const bands = [
      { band: "Inactive", test: (n: number) => n === 0 },
      { band: "1–5 clicks", test: (n: number) => n >= 1 && n <= 5 },
      { band: "6–20 clicks", test: (n: number) => n >= 6 && n <= 20 },
      { band: "20+ clicks", test: (n: number) => n > 20 },
    ].map((b) => {
      const inBand = enrolled.filter((a) => b.test(clicksBy.get(a.id) ?? 0));
      const converting = inBand.filter((a) => (convBy.get(a.id) ?? 0) > 0).length;
      return { band: b.band, converting, notConverting: inBand.length - converting, total: inBand.length };
    });
    const convertingAdv = enrolled.filter((a) => (convBy.get(a.id) ?? 0) > 0).length;

    return { cur, prev, spend, prevSpend, activeAdv, prevActiveAdv, roas, prevRoas, series, camps, comparison, spending, topShops, topMechs, bands, enrolled: enrolled.length, convertingAdv };
  }, [scope, range, shops, mechanics]);

  const exportReport = () => {
    const rows = data.camps.map(({ c, s }) => ({
      campaign_id: c.id, campaign: c.name, status: c.status, start_date: c.startDate.slice(0, 10), end_date: c.endDate.slice(0, 10),
      referral_visits: s.clicks, qualified_leads: s.leads, pending_verification: s.pending, verified_conversions: s.verified,
      conversion_rate_pct: s.conversionRate.toFixed(2), attributed_revenue_inr: Math.round(s.revenue), campaign_spend_inr: Math.round(s.spend),
      roas: s.roas.toFixed(2), active_advocates: s.activeAdvocates, enrolled_advocates: s.advocates, budget_inr: c.budget, budget_utilisation_pct: s.budgetUtil.toFixed(1),
    }));
    if (!rows.length) { toast.error("No campaigns to export"); return; }
    downloadCSV(`${(brand?.name ?? "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-campaigns-${range.from}-to-${range.to}.csv`, rows);
    toast.success("Campaign report exported", { description: `${rows.length} campaigns · ${rangeLabel(range)}` });
  };

  const { cur, prev } = data;
  if (!brandId) return <EmptyState icon={TrendingUp} title="No brand linked" description="Switch to the Brand Manager demo role to see this dashboard." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={brand && <Badge variant="default" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand" />{brand.name}</Badge>}
        title="Brand performance"
        description={`Growth and return on your advocacy programme · ${rangeLabel(range)}`}
        actions={<>
          <Button variant="outline" onClick={exportReport}><Download />Export report</Button>
          <Button onClick={() => navigate("/app/campaigns/new")}><Plus />Create campaign</Button>
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Referral visits" value={formatNumber(cur.clicks)} icon={MousePointerClick} tone="action" delta={delta(cur.clicks, prev.clicks)} hint="Visits to advocate referral links / QR codes for your campaigns." />
        <KpiCard label="Qualified leads" value={formatNumber(cur.leads)} icon={UserCheck} tone="brand" delta={delta(cur.leads, prev.leads)} hint="Visits where the customer shared details or visited the store." />
        <KpiCard label="Verified conversions" value={formatNumber(cur.verified)} icon={CheckCircle2} tone="positive" delta={delta(cur.verified, prev.verified)} hint="Purchases confirmed against an invoice." sub={<span>{cur.pending} awaiting verification</span>} />
        <KpiCard label="Conversion rate" value={formatPercent(cur.conversionRate)} icon={Percent} tone="positive" delta={delta(cur.conversionRate, prev.conversionRate)} hint="Verified conversions ÷ referral visits × 100." />
        <KpiCard label="Attributed revenue" value={formatCurrency(cur.revenue)} icon={IndianRupee} tone="brand" delta={delta(cur.revenue, prev.revenue)} hint="Verified purchase value attributed to advocate referrals (revenue, not profit)." />
        <KpiCard label="Campaign expenditure" value={formatCurrency(data.spend)} icon={Coins} tone="warning" delta={delta(data.spend, data.prevSpend)} invertDelta hint="Advocate commissions and bonuses accrued for your campaigns in the period (excludes reversals)." />
        <KpiCard label="Active advocates" value={formatNumber(data.activeAdv)} icon={Users} tone="action" delta={delta(data.activeAdv, data.prevActiveAdv)} hint="Distinct shops and mechanics with at least one referral visit for your campaigns." />
        <KpiCard label="Campaign ROAS" value={formatRatio(data.roas)} icon={TrendingUp} tone="ai" delta={delta(data.roas, data.prevRoas)} hint="Attributed revenue ÷ campaign expenditure." sub={<span>{formatCurrency(Math.max(0, cur.revenue - data.spend), { compact: true })} net of rewards</span>} />
      </div>

      {/* revenue/conversions + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Revenue & conversions" description={`Attributed revenue (bars) and verified conversions (line), by verification date · ${rangeLabel(range)}`}
          action={<Legend items={[{ label: "Revenue", color: C.c1 }, { label: "Conversions", color: C.c3 }]} />}>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series} margin={{ top: 8, right: 0, left: -6, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="rev" tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} width={56} />
                <YAxis yAxisId="conv" orientation="right" tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill={C.c1} radius={[3, 3, 0, 0]} maxBarSize={22} fillOpacity={0.85} />
                <Line yAxisId="conv" type="monotone" dataKey="verified" name="Conversions" stroke={C.c3} strokeWidth={2.25} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Conversion funnel" description="From referral visit to verified sale, for clicks in this period"
          footer={<span>Overall conversion <span className="font-semibold text-foreground num">{formatPercent(cur.conversionRate)}</span> · avg. order <span className="font-semibold text-foreground num">{formatCurrency(cur.avgOrderValue)}</span></span>}>
          <FunnelBars stages={[
            { label: "Referral visits", value: cur.clicks },
            { label: "Qualified leads", value: cur.leads },
            { label: "Purchases claimed", value: cur.purchases },
            { label: "Verified conversions", value: cur.verified },
          ]} />
        </ChartCard>
      </div>

      {/* campaign comparison + reward spending */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Campaign comparison" description={compareMetric === "volume" ? "Visits, leads and verified conversions per campaign" : "Attributed revenue versus reward spend per campaign"}
          action={<Tabs value={compareMetric} onValueChange={(v) => setCompareMetric(v as "volume" | "money")}><TabsList className="h-8"><TabsTrigger value="volume" className="text-xs">Volume</TabsTrigger><TabsTrigger value="money" className="text-xs">Revenue</TabsTrigger></TabsList></Tabs>}>
          <Legend className="mb-3" items={compareMetric === "volume"
            ? [{ label: "Visits", color: C.c2 }, { label: "Leads", color: C.c4 }, { label: "Verified", color: C.c3 }]
            : [{ label: "Revenue", color: C.c1 }, { label: "Reward spend", color: C.c5 }]} />
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.comparison} margin={{ top: 4, right: 4, left: compareMetric === "money" ? -4 : -18, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={compareMetric === "money" ? (v: number) => formatCurrency(v, { compact: true }) : undefined} width={compareMetric === "money" ? 56 : 40} />
                <Tooltip content={<ChartTooltip format={money} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                {compareMetric === "volume" ? (<>
                  <Bar dataKey="clicks" name="Visits" fill={C.c2} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="leads" name="Leads" fill={C.c4} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="verified" name="Verified" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={22} />
                </>) : (<>
                  <Bar dataKey="revenue" name="Revenue" fill={C.c1} radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="spend" name="Reward spend" fill={C.c5} radius={[3, 3, 0, 0]} maxBarSize={26} />
                </>)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Reward spending by campaign</CardTitle>
            <CardDescription>Spend in the period, with lifetime budget utilisation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.spending.map(({ c, spend, totalSpent, util }) => (
              <div key={c.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <Link to={`/app/campaigns/${c.id}`} className="min-w-0 truncate font-medium hover:text-action">{c.name}</Link>
                  <span className="shrink-0 font-semibold num">{formatCurrency(spend)}</span>
                </div>
                <Progress value={util} className="h-1.5" indicatorClassName={cn(util > 90 ? "bg-destructive" : util > 70 ? "bg-warning" : "bg-brand")} />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><StatusBadge status={c.status} className="px-1.5 py-0 text-[10px]" /></span>
                  <span className="num">{formatCurrency(totalSpent, { compact: true })} of {formatCurrency(c.budget, { compact: true })} · {formatPercent(util, 0)}</span>
                </div>
              </div>
            ))}
            {data.spending.length === 0 && <EmptyState title="No campaigns yet" className="py-6" />}
          </CardContent>
        </Card>
      </div>

      {/* leaderboards + engagement */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Top shops</CardTitle><CardDescription className="mt-1">By verified conversions on your campaigns</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/shops">Directory</Link></Button>
          </CardHeader>
          <CardContent><Leaderboard rows={data.topShops} empty="No shop activity in this period" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Top mechanics</CardTitle><CardDescription className="mt-1">By verified conversions on your campaigns</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/mechanics">Directory</Link></Button>
          </CardHeader>
          <CardContent><Leaderboard rows={data.topMechs} empty="No mechanic activity in this period" /></CardContent>
        </Card>
        <ChartCard title="Advocate engagement" description="Enrolled, verified advocates by referral visits in the period"
          action={<Legend items={[{ label: "Converting", color: C.c3 }, { label: "No sale yet", color: C.c2 }]} />}
          footer={<span><span className="font-semibold text-foreground num">{data.convertingAdv}</span> of {data.enrolled} enrolled advocates made a verified sale ({formatPercent(data.enrolled ? (data.convertingAdv / data.enrolled) * 100 : 0, 0)})</span>}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.bands} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="band" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="converting" name="Converting" stackId="a" fill={C.c3} maxBarSize={36} />
                <Bar dataKey="notConverting" name="No sale yet" stackId="a" fill={C.c2} radius={[3, 3, 0, 0]} maxBarSize={36} fillOpacity={0.55} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* campaigns table + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Your campaigns</CardTitle><CardDescription className="mt-1">Performance in {rangeLabel(range).toLowerCase()}</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/campaigns">Manage</Link></Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Campaign</TableHead><TableHead className="text-right">Visits</TableHead><TableHead className="text-right">Verified</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Conv.</TableHead><TableHead className="hidden text-right md:table-cell">Revenue</TableHead><TableHead className="text-right">ROAS</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.camps.map(({ c, s }) => (
                <TableRow key={c.id}>
                  <TableCell><Link to={`/app/campaigns/${c.id}`} className="font-medium hover:text-action hover:underline">{c.name}</Link><div className="mt-0.5"><StatusBadge status={c.status} /></div></TableCell>
                  <TableCell className="text-right num">{formatNumber(s.clicks)}</TableCell>
                  <TableCell className="text-right num">{formatNumber(s.verified)}</TableCell>
                  <TableCell className="hidden text-right num sm:table-cell">{formatPercent(s.conversionRate)}</TableCell>
                  <TableCell className="hidden text-right num md:table-cell">{formatCurrency(s.revenue)}</TableCell>
                  <TableCell className="text-right font-medium num">{s.spend ? formatRatio(s.roas) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Grow your advocate programme</CardDescription></CardHeader>
          <CardContent>
            <QuickActions className="sm:grid-cols-1" actions={[
              { label: "Create campaign", description: "Open the campaign builder", icon: Plus, tone: "action", onClick: () => navigate("/app/campaigns/new") },
              { label: "Add product", description: "List a product for referral rewards", icon: PackagePlus, tone: "brand", onClick: () => navigate("/app/products?new=1") },
              { label: "Invite advocate", description: "Bring a shop or mechanic onboard", icon: UserPlus, tone: "positive", onClick: () => setInviteOpen(true) },
              { label: "View referrals", description: `${cur.pending} awaiting verification`, icon: Link2, tone: "warning", to: "/app/referrals" },
              { label: "Export report", description: `Per-campaign CSV · ${rangeLabel(range)}`, icon: Download, tone: "ai", onClick: exportReport },
            ]} />
          </CardContent>
          <div className="flex items-center gap-1.5 border-t px-5 py-3 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" />Signed in as {user?.name} · {scope.campaigns.length} campaigns</div>
        </Card>
      </div>

      <InviteAdvocateDialog open={inviteOpen} onOpenChange={setInviteOpen} campaigns={scope.campaigns} />
    </div>
  );
}
