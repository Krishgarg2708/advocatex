import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BadgeCheck, CalendarClock, CheckCircle2, Clock, Coins, Crown, Flame, Gift, Lock, MapPin, MousePointerClick, Percent, Repeat, Sparkles,
  Target, Trophy, UserCheck, Wallet, Wrench,
} from "lucide-react";
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
import { TierBadge } from "@/components/shared/TierBadge";
import { ProductImage } from "@/components/shared/ProductImage";
import { ReferralToolkit } from "@/components/shared/ReferralToolkit";
import { EmptyState } from "@/components/shared/EmptyState";
import { C, ChartCard, ChartTooltip, Legend } from "@/components/shared/charts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import {
  ADVOCATE_TIER_STEPS, DAY_MS, achievements, advocateTier, delta, funnel, leaderboard, previousRange, rangeLabel, refsInRange, timeSeries, wallet,
} from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACH_ICON: Record<string, React.ComponentType<{ className?: string }>> = { first: Sparkles, ten: Target, champion: Trophy, consistent: Flame, top: Crown };

export default function MechanicDashboard() {
  const { mechanic, user } = useCurrentUser();
  const range = useUIStore((s) => s.dateRange);
  const referrals = useDataStore((s) => s.referrals);
  const rewards = useDataStore((s) => s.rewards);
  const campaigns = useDataStore((s) => s.campaigns);
  const products = useDataStore((s) => s.products);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const { campaignById, productById } = useLookups();
  const [activity, setActivity] = useState<"weekly" | "monthly">("weekly");

  const data = useMemo(() => {
    if (!mechanic) return null;
    const mine = referrals.filter((r) => r.advocateId === mechanic.id);
    const cur = funnel(refsInRange(mine, range));
    const prev = funnel(refsInRange(mine, previousRange(range)));
    const lifetime = funnel(mine);
    const w = wallet(rewards, mechanic.id);
    const series = timeSeries(mine, rewards.filter((t) => t.advocateId === mechanic.id), range);
    const boardRange = leaderboard(shops, mechanics, referrals, rewards, range, "mechanic");
    const boardAll = leaderboard(shops, mechanics, referrals, rewards);
    const rank = boardRange.find((x) => x.id === mechanic.id)?.rank ?? 0;
    const ach = achievements(mechanic.id, referrals, boardAll);
    const tier = advocateTier(lifetime.verified);
    const tierIdx = ADVOCATE_TIER_STEPS.findIndex((t) => t.tier === tier);
    const nextTier = ADVOCATE_TIER_STEPS[tierIdx + 1];
    const points = lifetime.verified * 50 + lifetime.leads * 5;

    // weekly (last 8 weeks) & monthly (last 6 months) activity — independent of the date filter
    const now = Date.now();
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const hi = now - (7 - i) * 7 * DAY_MS, lo = hi - 7 * DAY_MS;
      const inW = mine.filter((r) => { const t = new Date(r.createdAt).getTime(); return t > lo && t <= hi; });
      return { label: new Date(lo + DAY_MS).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), clicks: inW.length, verified: inW.filter((r) => r.status === "verified").length };
    });
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const inM = mine.filter((r) => { const t = new Date(r.createdAt); return `${t.getFullYear()}-${t.getMonth()}` === key; });
      return { label: d.toLocaleDateString("en-IN", { month: "short" }), clicks: inM.length, verified: inM.filter((r) => r.status === "verified").length };
    });

    const myCampaigns = campaigns.filter((c) => mechanic.campaignIds.includes(c.id) && (c.status === "active" || c.status === "scheduled"))
      .map((c) => {
        const cr = mine.filter((r) => r.campaignId === c.id);
        return { c, verified: cr.filter((r) => r.status === "verified").length, earned: cr.filter((r) => r.status === "verified").reduce((s, r) => s + r.reward, 0), daysLeft: Math.ceil((new Date(c.endDate).getTime() - now) / DAY_MS), daysToStart: Math.ceil((new Date(c.startDate).getTime() - now) / DAY_MS) };
      });

    // recommend products in my live campaigns, ranked by my historic conversion rate, then reward
    const liveIds = new Set(myCampaigns.filter((x) => x.c.status === "active").map((x) => x.c.id));
    const recProducts = Array.from(new Set(campaigns.filter((c) => liveIds.has(c.id)).flatMap((c) => c.productIds)))
      .map((pid) => {
        const pr = mine.filter((r) => r.productId === pid);
        const f = funnel(pr);
        const best = campaigns.filter((c) => liveIds.has(c.id) && c.productIds.includes(pid)).sort((a, b) => b.rewardPerConversion - a.rewardPerConversion)[0]!;
        return { p: productById.get(pid)!, conv: f.conversionRate, verified: f.verified, reward: best.rewardPerConversion, campaign: best };
      })
      .filter((x) => x.p && x.p.status === "active")
      .sort((a, b) => b.conv - a.conv || b.reward - a.reward)
      .slice(0, 4);

    const recent = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((r) => r.status !== "clicked").slice(0, 6);
    return { mine, cur, prev, lifetime, w, series, boardRange, rank, ach, tier, nextTier, points, weekly, monthly, myCampaigns, recProducts, recent };
  }, [mechanic, referrals, rewards, campaigns, shops, mechanics, range, productById]);

  if (!mechanic || !data) return <EmptyState icon={Wrench} title="No mechanic profile linked" description="Switch to the Mechanic Advocate demo role to see this dashboard." />;
  const { cur, prev, w, lifetime } = data;
  const firstName = mechanic.name.split(" ")[0];
  const nextMilestone = Math.max(5000, Math.ceil((w.totalEarned + 1) / 5000) * 5000);
  const tierProgress = data.nextTier ? ((lifetime.verified - ADVOCATE_TIER_STEPS.find((t) => t.tier === data.tier)!.min) / (data.nextTier.min - ADVOCATE_TIER_STEPS.find((t) => t.tier === data.tier)!.min)) * 100 : 100;
  const top5 = data.boardRange.slice(0, 5);
  const meInTop = top5.some((x) => x.id === mechanic.id);
  const me = data.boardRange.find((x) => x.id === mechanic.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`Here's how your recommendations are performing · ${rangeLabel(range)}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/app/referrals"><Repeat />View referral status</Link></Button>
          <Button asChild><Link to="/app/campaigns"><Target />Explore campaigns</Link></Button>
        </>}
      />

      {/* profile + reward progress */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand/10 via-action/10 to-positive/10" aria-hidden />
          <CardContent className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <EntityAvatar name={mechanic.name} hue={mechanic.hue} size="xl" type="mechanic" className="ring-4 ring-card" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{mechanic.name}</h2>
                {mechanic.status === "verified" && <Badge variant="positive"><BadgeCheck />Verified advocate</Badge>}
                <TierBadge tier={data.tier} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{mechanic.workshop}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" />{mechanic.specialization}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{mechanic.city}, {mechanic.state}</span>
                <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{mechanic.experienceYears} yrs experience</span>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium">{data.nextTier ? `${data.nextTier.min - lifetime.verified} verified conversions to ${data.nextTier.tier}` : "Highest tier reached"}</span>
                  <span className="text-muted-foreground num">{lifetime.verified} lifetime</span>
                </div>
                <Progress value={tierProgress} indicatorClassName="bg-gradient-to-r from-brand to-action" />
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:w-48 sm:grid-cols-1">
              <div className="rounded-lg border bg-card/80 p-3">
                <div className="text-xs text-muted-foreground">Leaderboard</div>
                <div className="text-xl font-semibold num">{data.rank ? `#${data.rank}` : "—"}</div>
                <div className="text-[11px] text-muted-foreground">of {data.boardRange.length} mechanics</div>
              </div>
              <div className="rounded-lg border bg-card/80 p-3">
                <div className="text-xs text-muted-foreground">Advocate points</div>
                <div className="text-xl font-semibold num">{formatNumber(data.points)}</div>
                <div className="text-[11px] text-muted-foreground">50 per sale · 5 per lead</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-positive" />Reward progress</CardTitle>
            <CardDescription>Simulated wallet — no real money is moved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Available to withdraw</div>
              <div className="text-3xl font-semibold tracking-tight text-positive num">{formatCurrency(w.available)}</div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs"><span>Lifetime earnings</span><span className="num text-muted-foreground">{formatCurrency(w.totalEarned)} / {formatCurrency(nextMilestone)}</span></div>
              <Progress value={(w.totalEarned / nextMilestone) * 100} indicatorClassName="bg-positive" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">{formatCurrency(nextMilestone - w.totalEarned)} to your next earnings milestone</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-muted/60 p-2"><div className="text-muted-foreground">Pending</div><div className="font-semibold num">{formatCurrency(w.pending)}</div></div>
              <div className="rounded-md bg-muted/60 p-2"><div className="text-muted-foreground">In payout</div><div className="font-semibold num">{formatCurrency(w.inProcess)}</div></div>
              <div className="rounded-md bg-muted/60 p-2"><div className="text-muted-foreground">Paid out</div><div className="font-semibold num">{formatCurrency(w.paidOut)}</div></div>
            </div>
            <Button variant="outline" className="w-full" asChild><Link to="/app/rewards"><Coins />Open reward wallet</Link></Button>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Referral clicks" value={formatNumber(cur.clicks)} icon={MousePointerClick} tone="action" delta={delta(cur.clicks, prev.clicks)} hint="Visits to your referral link or QR code in the selected period." className="xl:col-span-1" />
        <KpiCard label="Successful referrals" value={formatNumber(cur.leads)} icon={UserCheck} tone="brand" delta={delta(cur.leads, prev.leads)} hint="Clicks that became a qualified lead (customer shared details or visited)." />
        <KpiCard label="Verified conversions" value={formatNumber(cur.verified)} icon={CheckCircle2} tone="positive" delta={delta(cur.verified, prev.verified)} hint="Purchases confirmed against an invoice. Only these earn rewards." />
        <KpiCard label="Conversion rate" value={formatPercent(cur.conversionRate)} icon={Percent} tone="positive" delta={delta(cur.conversionRate, prev.conversionRate)} hint="Verified conversions ÷ referral clicks × 100." />
        <KpiCard label="Available rewards" value={formatCurrency(w.available)} icon={Wallet} tone="positive" hint="Approved rewards not yet requested as a payout." />
        <KpiCard label="Pending rewards" value={formatCurrency(w.pending)} icon={Clock} tone="warning" hint="Rewards for verified sales awaiting approval." sub={<span>{cur.pending} claims awaiting verification</span>} />
        <KpiCard label="Loyalty points" value={formatNumber(data.points)} icon={Gift} tone="ai" hint="Advocate points: 50 per verified sale and 5 per qualified lead, lifetime." />
      </div>

      {/* performance chart + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Referral performance" description={`Clicks and verified conversions · ${rangeLabel(range)}`}
          action={<Legend items={[{ label: "Clicks", color: C.c2 }, { label: "Verified", color: C.c3 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="mClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity={0.25} /><stop offset="100%" stopColor={C.c2} stopOpacity={0} /></linearGradient>
                  <linearGradient id="mVer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c3} stopOpacity={0.3} /><stop offset="100%" stopColor={C.c3} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke={C.c2} strokeWidth={2} fill="url(#mClicks)" />
                <Area type="monotone" dataKey="verified" name="Verified" stroke={C.c3} strokeWidth={2} fill="url(#mVer)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Activity" description={activity === "weekly" ? "Last 8 weeks" : "Last 6 months"}
          action={<Tabs value={activity} onValueChange={(v) => setActivity(v as "weekly" | "monthly")}><TabsList className="h-8"><TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger><TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger></TabsList></Tabs>}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity === "weekly" ? data.weekly : data.monthly} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="clicks" name="Clicks" fill={C.c2} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="verified" name="Verified" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* referral tools + leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ReferralToolkit code={mechanic.referralCode} name={mechanic.workshop} className="lg:col-span-2" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" />Leaderboard</CardTitle>
            <CardDescription>Mechanics ranked by verified conversions · {rangeLabel(range)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {top5.map((row) => (
              <div key={row.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", row.id === mechanic.id && "bg-brand-soft ring-1 ring-brand/20")}>
                <span className={cn("w-6 text-center text-sm font-semibold num", row.rank <= 3 ? "text-warning" : "text-muted-foreground")}>{row.rank}</span>
                <EntityAvatar name={row.name} hue={row.hue} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.name}{row.id === mechanic.id && <span className="ml-1 text-xs text-brand">(you)</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.city}</div>
                </div>
                <div className="text-right"><div className="text-sm font-semibold num">{row.verified}</div><div className="text-[11px] text-muted-foreground num">{formatPercent(row.conversionRate)}</div></div>
              </div>
            ))}
            {!meInTop && me && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border-t bg-brand-soft px-2 py-2 pt-2">
                <span className="w-6 text-center text-sm font-semibold num">{me.rank}</span>
                <EntityAvatar name={me.name} hue={me.hue} size="sm" />
                <div className="flex-1 text-sm font-medium">You</div>
                <div className="text-sm font-semibold num">{me.verified}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* achievements */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
          <CardDescription>Earned from your verified activity — locked badges show your progress.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.ach.map((a) => {
            const Icon = ACH_ICON[a.id] ?? Trophy;
            return (
              <div key={a.id} className={cn("rounded-xl border p-4 transition-colors", a.earned ? "border-warning/30 bg-warning-soft/60" : "bg-muted/30")}>
                <div className="flex items-center justify-between">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", a.earned ? "bg-warning text-white" : "bg-muted text-muted-foreground")}><Icon className="h-5 w-5" /></span>
                  {a.earned ? <Badge variant="warning">Earned</Badge> : <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />}
                </div>
                <div className="mt-3 text-sm font-semibold">{a.title}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                {!a.earned && a.target > 1 && (
                  <div className="mt-3"><Progress value={(a.progress / a.target) * 100} className="h-1.5" /><div className="mt-1 text-[11px] text-muted-foreground num">{a.progress} / {a.target}</div></div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* campaigns + recommended products */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Your campaigns</CardTitle><CardDescription className="mt-1">Live and upcoming campaigns you're enrolled in</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/campaigns">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.myCampaigns.length === 0 && <EmptyState title="No active campaigns" description="Explore open campaigns to start earning." className="py-6" />}
            {data.myCampaigns.map(({ c, verified, earned, daysLeft, daysToStart }) => (
              <Link key={c.id} to={`/app/campaigns/${c.id}`} className="block rounded-lg border p-3.5 transition-colors hover:border-action/40 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate font-medium">{c.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(c.rewardPerConversion)} per verified sale · +{c.customerBonusPoints} customer points</div></div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="font-semibold text-foreground num">{verified}</span> your conversions</span>
                  <span><span className="font-semibold text-foreground num">{formatCurrency(earned)}</span> earned</span>
                  <span>{c.status === "scheduled" ? `Starts in ${daysToStart} days` : daysLeft >= 0 ? `${daysLeft} days left` : "Ended"}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Recommended products</CardTitle><CardDescription className="mt-1">Ranked by your conversion rate in live campaigns</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/products">Catalogue</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {data.recProducts.map(({ p, conv, verified, reward, campaign }) => (
              <Link key={p.id} to={`/app/products?open=${p.id}`} className="group overflow-hidden rounded-lg border transition-colors hover:border-action/40">
                <ProductImage category={p.category} name={p.name} className="h-20" size="sm" />
                <div className="p-3">
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-action">{p.name}</div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-positive num">{formatCurrency(reward)} reward</span>
                    <span className="text-muted-foreground num">{verified ? `${formatPercent(conv)} conv.` : "New for you"}</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">via {campaign.name}</div>
                </div>
              </Link>
            ))}
            {data.recProducts.length === 0 && <EmptyState title="No product recommendations yet" className="col-span-full py-6" />}
          </CardContent>
        </Card>
      </div>

      {/* recent referrals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Recent customer referrals</CardTitle><CardDescription className="mt-1">Latest referrals that progressed beyond a click</CardDescription></div>
          <Button variant="ghost" size="sm" asChild><Link to="/app/referrals">All referrals</Link></Button>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Referral</TableHead><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Purchase</TableHead><TableHead className="text-right">Reward</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.recent.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link to={`/app/referrals?open=${r.id}`} className="font-mono text-xs font-medium text-action hover:underline">{r.id}</Link><div className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)}</div></TableCell>
                <TableCell className="font-mono text-xs">{r.customerRef}</TableCell>
                <TableCell className="max-w-[220px] truncate text-[13px]">{productById.get(r.productId)?.name}<div className="text-[11px] text-muted-foreground">{campaignById.get(r.campaignId)?.name}</div></TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right num">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</TableCell>
                <TableCell className="text-right font-medium num">{r.status === "verified" || r.status === "pending" ? formatCurrency(r.reward) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.recent.length === 0 && <EmptyState title="No referrals yet" description="Share your link to get started." />}
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">Member since {formatDate(mechanic.joinedAt)} · Signed in as {user?.email}</div>
      </Card>
    </div>
  );
}
