import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, CircleDollarSign, Clock, Coins, Gauge, IndianRupee, MapPin, Megaphone, MousePointerClick,
  Pencil, Percent, ShieldCheck, Store, TrendingUp, UserCheck, UserPlus, Users, Wallet, Wrench, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ProductImage } from "@/components/shared/ProductImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { ReferralToolkit } from "@/components/shared/ReferralToolkit";
import { AdvocateDetailSheet } from "@/components/shared/AdvocateDetailSheet";
import { C, ChartCard, ChartTooltip, FunnelBars, Legend } from "@/components/shared/charts";
import { Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { budgetTone, campaignTiming, isoToday, statusActions, useStatusAction } from "@/pages/app/components/CampaignKit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { campaignParticipants, campaignStats, funnel, spendOf, timeSeries } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, formatRatio, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdvocateType, DateRange, Referral } from "@/types";

interface AdvRow { id: string; type: AdvocateType; name: string; subtitle: string; city: string; hue: number; clicks: number; verified: number; conv: number; rewards: number }
type EventKind = "clicked" | "lead" | "pending" | "verified" | "rejected";
const EVENT_LABEL: Record<EventKind, string> = { clicked: "clicked a referral link", lead: "became a qualified lead", pending: "purchase claimed — awaiting verification", verified: "purchase verified", rejected: "claim rejected" };
const EVENT_ICON: Record<EventKind, React.ComponentType<{ className?: string }>> = { clicked: MousePointerClick, lead: UserCheck, pending: Clock, verified: CheckCircle2, rejected: XCircle };
const EVENT_TONE: Record<EventKind, string> = { clicked: "bg-muted text-muted-foreground", lead: "bg-action-soft text-action", pending: "bg-warning-soft text-warning", verified: "bg-positive-soft text-positive", rejected: "bg-destructive/10 text-destructive" };

export default function CampaignDetails() {
  const { id } = useParams();
  const { can, shop, mechanic } = useCurrentUser();
  const scope = useScope();
  const allReferrals = useDataStore((s) => s.referrals);
  const allRewards = useDataStore((s) => s.rewards);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const { brandById, productById, advocate: advLookup } = useLookups();
  const status = useStatusAction();
  const [sheet, setSheet] = useState<{ id: string; type: AdvocateType } | null>(null);
  const [joining, setJoining] = useState(false);

  const c = scope.campaigns.find((x) => x.id === id);
  const me = shop ?? mechanic;
  const isAdvocate = !!me;
  const canManage = can("manageCampaigns");

  const data = useMemo(() => {
    if (!c) return null;
    const campRefs = allReferrals.filter((r) => r.campaignId === c.id);
    const campTxns = allRewards.filter((t) => t.campaignId === c.id);
    const participants = campaignParticipants(c, shops, mechanics);
    const stats = campaignStats(c, allReferrals, allRewards, participants);
    const today = isoToday();
    const end = c.endDate < today ? c.endDate : today;
    const started = c.startDate <= today;
    const range: DateRange = { preset: "custom", from: c.startDate, to: started ? end : c.startDate };
    const ownRefs = me ? campRefs.filter((r) => r.advocateId === me.id) : [];
    const seriesRefs = me ? ownRefs : campRefs;
    const series = started ? timeSeries(seriesRefs, campTxns.filter((t) => !me || t.advocateId === me.id), range) : [];
    const own = me ? { f: funnel(ownRefs), earned: spendOf(campTxns, (t) => t.advocateId === me.id), pending: campTxns.filter((t) => t.advocateId === me.id && (t.type === "commission" || t.type === "bonus") && t.status === "pending").reduce((s, t) => s + t.amount, 0) } : null;

    // participating advocates with per-advocate stats
    const by = new Map<string, Referral[]>();
    for (const r of campRefs) by.set(r.advocateId, [...(by.get(r.advocateId) ?? []), r]);
    const advRows: AdvRow[] = [
      ...shops.filter((s) => s.campaignIds.includes(c.id)).map((s) => ({ id: s.id, type: "shop" as const, name: s.name, subtitle: s.owner, city: s.city, hue: s.hue })),
      ...mechanics.filter((m) => m.campaignIds.includes(c.id)).map((m) => ({ id: m.id, type: "mechanic" as const, name: m.name, subtitle: m.workshop, city: m.city, hue: m.hue })),
    ].map((a) => {
      const f = funnel(by.get(a.id) ?? []);
      return { ...a, clicks: f.clicks, verified: f.verified, conv: f.conversionRate, rewards: spendOf(campTxns, (t) => t.advocateId === a.id) };
    });

    // rewards distributed
    const earnTxns = campTxns.filter((t) => t.type === "commission" || t.type === "bonus");
    const sumBy = (type: AdvocateType, st: "pending" | "approved") => earnTxns.filter((t) => t.advocateType === type && t.status === st).reduce((s, t) => s + t.amount, 0);
    const rewardsSplit = {
      shop: { pending: sumBy("shop", "pending"), approved: sumBy("shop", "approved") },
      mechanic: { pending: sumBy("mechanic", "pending"), approved: sumBy("mechanic", "approved") },
      reversed: earnTxns.filter((t) => t.status === "reversed").reduce((s, t) => s + t.amount, 0),
    };
    const totalSpend = spendOf(campTxns);
    const topAdvocateSpend = Math.max(0, ...advRows.map((a) => a.rewards));

    // recent activity — latest referral events
    const events: { key: string; at: string; kind: EventKind; r: Referral }[] = [];
    for (const r of seriesRefs) {
      events.push({ key: `${r.id}-c`, at: r.createdAt, kind: "clicked", r });
      if (r.leadAt) events.push({ key: `${r.id}-l`, at: r.leadAt, kind: "lead", r });
      if (r.purchaseAt) events.push({ key: `${r.id}-p`, at: r.purchaseAt, kind: "pending", r });
      if (r.verifiedAt && r.status === "verified") events.push({ key: `${r.id}-v`, at: r.verifiedAt, kind: "verified", r });
      if (r.rejectedAt) events.push({ key: `${r.id}-x`, at: r.rejectedAt, kind: "rejected", r });
    }
    events.sort((a, b) => b.at.localeCompare(a.at));

    return { stats, series, own, advRows, rewardsSplit, totalSpend, topAdvocateSpend, events: events.slice(0, 8), started };
  }, [c, allReferrals, allRewards, shops, mechanics, me]);

  const t = useTableState(data?.advRows ?? [], {
    search: (r, q) => [r.name, r.subtitle, r.city].some((x) => x.toLowerCase().includes(q)),
    sorters: { name: (r) => r.name, type: (r) => r.type, clicks: (r) => r.clicks, verified: (r) => r.verified, conv: (r) => r.conv, rewards: (r) => r.rewards },
    initialSort: { key: "verified", dir: "desc" }, pageSize: 8,
  });

  if (!c || !data) {
    return (
      <div className="space-y-6">
        <Card><EmptyState icon={Megaphone} title="Campaign not found" description="It may have been removed, or it isn't available to your role."
          action={<Button variant="outline" asChild><Link to="/app/campaigns"><ArrowLeft />Back to campaigns</Link></Button>} /></Card>
      </div>
    );
  }

  const { stats, own } = data;
  const brand = brandById.get(c.brandId);
  const timing = campaignTiming(c);
  const actions = canManage ? statusActions(c) : [];
  const enrolled = !!me && me.campaignIds.includes(c.id);
  const remaining = Math.max(0, c.budget - data.totalSpend);
  const eligibleProducts = c.productIds.map((pid) => productById.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
  const prodPerf = (pid: string) => funnel(allReferrals.filter((r) => r.campaignId === c.id && r.productId === pid && (!me || r.advocateId === me.id)));
  const fSource = own ? own.f : stats;
  const totalRewards = data.rewardsSplit.shop.pending + data.rewardsSplit.shop.approved + data.rewardsSplit.mechanic.pending + data.rewardsSplit.mechanic.approved;

  const simulateJoin = async () => {
    setJoining(true);
    await new Promise((r) => setTimeout(r, 600));
    setJoining(false);
    toast.success("Enrolment request sent (simulated)", { description: `${brand?.name} approves enrolment. In this demo your enrolment isn't changed.` });
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-muted-foreground"><Link to="/app/campaigns"><ArrowLeft />All campaigns</Link></Button>
        <PageHeader className="mb-0"
          eyebrow={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><span className="text-xs font-medium text-muted-foreground">{brand?.name}</span>{isAdvocate && (enrolled ? <Badge variant="positive"><BadgeCheck />Enrolled</Badge> : <Badge variant="action">Open to join</Badge>)}</div>}
          title={c.name}
          description={c.description}
          actions={<>
            {canManage && actions.map((a) => (
              <Button key={a.to} variant={a.variant === "destructive" ? "outline" : a.variant === "outline" ? "outline" : "positive"} className={cn(a.variant === "destructive" && "text-destructive hover:text-destructive")} onClick={() => status.request(c, a)}>{a.label}</Button>
            ))}
            {canManage && <Button asChild><Link to={`/app/campaigns/${c.id}/edit`}><Pencil />Edit</Link></Button>}
            {isAdvocate && !enrolled && <Button onClick={simulateJoin} disabled={joining}><UserPlus />{joining ? "Sending…" : "Join campaign"}</Button>}
          </>}
        />
      </div>

      {/* overview */}
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Schedule</div>
            <div className="mt-1 text-sm font-medium">{formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
            <div className={cn("text-xs", timing.urgent ? "font-medium text-warning" : "text-muted-foreground")}>{timing.label}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5" />Rewards</div>
            <div className="mt-1 text-sm font-medium">{formatCurrency(c.rewardPerConversion)} per verified conversion</div>
            <div className="text-xs text-muted-foreground">+{c.customerBonusPoints} bonus points for the customer</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Advocate types</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {c.advocateTypes.map((a) => <Badge key={a} variant="secondary">{a === "shop" ? <Store /> : <Wrench />}{a === "shop" ? "Shops" : "Mechanics"}</Badge>)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Eligibility</div>
            <p className="mt-1 text-[13px]">{c.eligibility || "No additional requirements."}</p>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Target locations · {c.locations.length} states</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{c.locations.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      {own ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Your clicks" value={formatNumber(own.f.clicks)} icon={MousePointerClick} tone="action" hint="Visits to your referral link for this campaign (campaign lifetime)." />
          <KpiCard label="Your leads" value={formatNumber(own.f.leads)} icon={UserCheck} tone="brand" hint="Clicks that became qualified leads." />
          <KpiCard label="Your verified" value={formatNumber(own.f.verified)} icon={CheckCircle2} tone="positive" hint="Purchases confirmed against an invoice — only these earn rewards." />
          <KpiCard label="Your conversion" value={formatPercent(own.f.conversionRate)} icon={Percent} tone="positive" hint="Verified ÷ clicks × 100." />
          <KpiCard label="Rewards earned" value={formatCurrency(own.earned)} icon={Wallet} tone="positive" hint="Pending + approved rewards from this campaign (simulated)." sub={<span>{formatCurrency(own.pending)} pending</span>} />
          <KpiCard label="Campaign budget used" value={formatPercent(stats.budgetUtil, 0)} icon={Gauge} tone={stats.budgetUtil > 85 ? "warning" : "neutral"} hint="Share of the campaign budget already committed to advocate rewards." />
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Campaign lifetime · independent of the global date filter</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Referral clicks" value={formatNumber(stats.clicks)} icon={MousePointerClick} tone="action" hint="Visits to advocate links and QR codes for this campaign. A click is never a sale." />
            <KpiCard label="Qualified leads" value={formatNumber(stats.leads)} icon={UserCheck} tone="brand" hint="Clicks where the customer shared details or visited." />
            <KpiCard label="Verified conversions" value={formatNumber(stats.verified)} icon={CheckCircle2} tone="positive" hint="Purchases confirmed against an invoice." sub={<span>{stats.pending} pending verification</span>} />
            <KpiCard label="Conversion rate" value={formatPercent(stats.conversionRate)} icon={Percent} tone="positive" hint="Verified conversions ÷ referral clicks × 100." />
            <KpiCard label="Attributed revenue" value={formatCurrency(stats.revenue, { compact: true })} icon={IndianRupee} tone="brand" hint="Value of verified purchases attributed to advocates. Not profit." />
            <KpiCard label="Campaign spend" value={formatCurrency(stats.spend, { compact: true })} icon={CircleDollarSign} tone="warning" hint="Advocate rewards accrued (pending + approved, excluding reversed)." />
            <KpiCard label="ROAS" value={formatRatio(stats.roas)} icon={TrendingUp} tone="ai" hint="Attributed revenue ÷ campaign spend." />
            <KpiCard label="Budget utilisation" value={formatPercent(stats.budgetUtil, 0)} icon={Gauge} tone={stats.budgetUtil > 85 ? "warning" : "positive"} hint="Spend ÷ budget × 100." sub={<span>of {formatCurrency(c.budget, { compact: true })}</span>} />
          </div>
        </div>
      )}

      {/* performance chart + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title={own ? "Your referral performance" : "Referral performance"}
          description={data.started ? `Clicks and verified conversions from ${formatDate(c.startDate, { day: "numeric", month: "short" })} to ${formatDate(c.endDate < isoToday() ? c.endDate : isoToday(), { day: "numeric", month: "short" })}${data.series.length > 45 ? " · weekly" : ""}` : "This campaign hasn't started yet"}
          action={data.started ? <Legend items={[{ label: "Clicks", color: C.c2 }, { label: "Verified", color: C.c3 }]} /> : undefined}>
          {data.started ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cdClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity={0.25} /><stop offset="100%" stopColor={C.c2} stopOpacity={0} /></linearGradient>
                    <linearGradient id="cdVer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c3} stopOpacity={0.3} /><stop offset="100%" stopColor={C.c3} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="clicks" name="Clicks" stroke={C.c2} strokeWidth={2} fill="url(#cdClicks)" />
                  <Area type="monotone" dataKey="verified" name="Verified" stroke={C.c3} strokeWidth={2} fill="url(#cdVer)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={Clock} title={`Starts ${formatDate(c.startDate)}`} description="Performance appears once advocates begin sharing." className="h-[260px]" />}
        </ChartCard>

        <ChartCard title="Conversion funnel" description={own ? "Your referrals in this campaign" : "From click to verified purchase · campaign lifetime"}>
          <FunnelBars stages={[
            { label: "Referral clicks", value: fSource.clicks },
            { label: "Qualified leads", value: fSource.leads },
            { label: "Purchases claimed", value: fSource.purchases },
            { label: "Verified conversions", value: fSource.verified },
          ]} />
          <p className="mt-4 text-xs text-muted-foreground">{fSource.rejected} claims rejected · {fSource.pending} awaiting verification</p>
        </ChartCard>
      </div>

      {/* toolkit for advocates */}
      {me && enrolled && c.status === "active" && <ReferralToolkit code={me.referralCode} name={shop ? shop.name : mechanic!.workshop} />}
      {me && !enrolled && <DemoNotice>You're not enrolled in this campaign yet. Joining is simulated — in production, {brand?.name} approves enrolment and your referral link starts tracking for it.</DemoNotice>}

      {/* eligible products */}
      <Card>
        <CardHeader><CardTitle>Eligible products</CardTitle><CardDescription>Verified purchases of these products earn the campaign reward</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {eligibleProducts.map((p) => {
            const pf = prodPerf(p.id);
            return (
              <Link key={p.id} to={`/app/products?open=${p.id}`} className="group overflow-hidden rounded-lg border transition-colors hover:border-action/40">
                <ProductImage category={p.category} name={p.name} className="h-20" size="sm" />
                <div className="p-3">
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-action">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatCurrency(p.price)} · {p.category}</div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground num">
                    <span><span className="font-semibold text-foreground">{pf.verified}</span> verified</span>
                    <span>{formatCurrency(pf.revenue, { compact: true })} revenue</span>
                  </div>
                </div>
              </Link>
            );
          })}
          {eligibleProducts.length === 0 && <EmptyState icon={Megaphone} title="No products linked" className="col-span-full py-6" />}
        </CardContent>
      </Card>

      {/* participating advocates (admin/brand) */}
      {!isAdvocate && (
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Participating advocates</CardTitle><CardDescription className="mt-1">{data.advRows.length} enrolled · {stats.activeAdvocates} with referral activity</CardDescription></div>
            <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search advocates…" />
          </CardHeader>
          {t.total === 0 ? (
            <EmptyState icon={Users} title={t.query ? "No advocates match" : "No advocates enrolled yet"} description={t.query ? undefined : c.status === "draft" ? "Advocates can enrol once the campaign is scheduled or live." : undefined}
              action={t.query ? <Button variant="outline" size="sm" onClick={() => t.setQuery("")}>Clear search</Button> : undefined} />
          ) : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <SortableHead label="Advocate" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                  <SortableHead label="Type" sortKey="type" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                  <SortableHead label="Clicks" sortKey="clicks" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />
                  <SortableHead label="Verified" sortKey="verified" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortableHead label="Conv." sortKey="conv" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden lg:table-cell" />
                  <SortableHead label="Rewards" sortKey="rewards" sort={t.sort} onSort={t.toggleSort} align="right" />
                </TableRow></TableHeader>
                <TableBody>
                  {t.pageRows.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => setSheet({ id: a.id, type: a.type })}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <EntityAvatar name={a.name} hue={a.hue} type={a.type} />
                          <div className="min-w-0"><div className="truncate font-medium">{a.name}</div><div className="truncate text-xs text-muted-foreground">{a.subtitle} · {a.city}</div></div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><Badge variant="secondary">{a.type === "shop" ? "Shop" : "Mechanic"}</Badge></TableCell>
                      <TableCell className="hidden text-right num sm:table-cell">{formatNumber(a.clicks)}</TableCell>
                      <TableCell className="text-right font-medium num">{formatNumber(a.verified)}</TableCell>
                      <TableCell className="hidden text-right num lg:table-cell">{a.clicks ? formatPercent(a.conv) : "—"}</TableCell>
                      <TableCell className="text-right num">{formatCurrency(a.rewards)}{a.rewards > c.maxRewardPerAdvocate * 0.85 && <div className="text-[11px] text-warning">near cap</div>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
            </>
          )}
        </Card>
      )}

      {/* rewards / budget / activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {!isAdvocate && (
          <Card>
            <CardHeader><CardTitle>Rewards distributed</CardTitle><CardDescription>Advocate rewards by type and approval status (simulated)</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {(["shop", "mechanic"] as const).map((type) => {
                const v = data.rewardsSplit[type];
                const total = v.pending + v.approved;
                return (
                  <div key={type}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span className="inline-flex items-center gap-1.5 font-medium">{type === "shop" ? <Store className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}{type === "shop" ? "Shops" : "Mechanics"}</span>
                      <span className="font-semibold num">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="bg-positive" style={{ width: `${totalRewards ? (v.approved / totalRewards) * 100 : 0}%` }} />
                      <div className="bg-warning" style={{ width: `${totalRewards ? (v.pending / totalRewards) * 100 : 0}%` }} />
                    </div>
                    <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground num"><span>{formatCurrency(v.approved)} approved</span><span>{formatCurrency(v.pending)} pending</span></div>
                  </div>
                );
              })}
              <Legend items={[{ label: "Approved", color: "hsl(var(--positive))" }, { label: "Pending approval", color: "hsl(var(--warning))" }]} />
              {data.rewardsSplit.reversed > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(data.rewardsSplit.reversed)} reversed after audit (excluded from spend).</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Budget utilisation</CardTitle><CardDescription>Rewards committed against the campaign budget</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-3xl font-semibold tracking-tight num", stats.budgetUtil > 85 && "text-warning")}>{formatPercent(stats.budgetUtil, 0)}</span>
                <span className="text-xs text-muted-foreground num">{formatCurrency(data.totalSpend)} of {formatCurrency(c.budget)}</span>
              </div>
              <Progress value={stats.budgetUtil} className="mt-2 h-2.5" indicatorClassName={budgetTone(stats.budgetUtil)} />
              {stats.budgetUtil > 85 && <p className="mt-1.5 text-xs text-warning">Budget is nearly exhausted — consider topping up or pausing.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/60 p-2.5"><div className="text-muted-foreground">Remaining budget</div><div className="mt-0.5 text-sm font-semibold num">{formatCurrency(remaining)}</div></div>
              <div className="rounded-md bg-muted/60 p-2.5"><div className="text-muted-foreground">Conversions left</div><div className="mt-0.5 text-sm font-semibold num">~{formatNumber(Math.floor(remaining / Math.max(1, c.rewardPerConversion)))}</div></div>
              <div className="rounded-md bg-muted/60 p-2.5"><div className="text-muted-foreground">Max per advocate</div><div className="mt-0.5 text-sm font-semibold num">{formatCurrency(c.maxRewardPerAdvocate)}</div></div>
              <div className="rounded-md bg-muted/60 p-2.5"><div className="text-muted-foreground">{own ? "Your cap used" : "Top advocate"}</div><div className="mt-0.5 text-sm font-semibold num">{own ? formatPercent((own.earned / Math.max(1, c.maxRewardPerAdvocate)) * 100, 0) : formatCurrency(data.topAdvocateSpend)}</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(isAdvocate && "lg:col-span-2")}>
          <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>{own ? "Latest events on your referrals" : "Latest referral events in this campaign"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {data.events.length === 0 && <EmptyState title="No activity yet" className="py-6" />}
            {data.events.map((e) => {
              const Icon = EVENT_ICON[e.kind];
              const adv = advLookup(e.r.advocateId);
              return (
                <div key={e.key} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", EVENT_TONE[e.kind])}><Icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1 text-[13px]">
                    <div className="truncate"><span className="font-mono text-xs">{e.r.customerRef}</span> {EVENT_LABEL[e.kind]}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{isAdvocate ? productById.get(e.r.productId)?.name : `via ${adv?.name ?? e.r.advocateId}`} · {timeAgo(e.at)}{e.kind === "verified" && ` · ${formatCurrency(e.r.purchaseValue)}`}</div>
                  </div>
                </div>
              );
            })}
            {(can("viewAllReferrals") || isAdvocate) && <Button variant="ghost" size="sm" asChild className="w-full"><Link to="/app/referrals">Open referral tracking</Link></Button>}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">Created {formatDate(c.createdAt)} · Last updated {timeAgo(c.updatedAt)}</p>
      {status.dialog}
      <AdvocateDetailSheet type={sheet?.type ?? "shop"} id={sheet?.id ?? null} open={!!sheet} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
