import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowUpRight, Award, Coins, Gift, Lock, PackageX, Percent, Sparkles, Ticket, TrendingUp, Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { TierBadge } from "@/components/shared/TierBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { Pagination } from "@/components/shared/table-kit";
import { C, ChartCard, ChartTooltip, SERIES } from "@/components/shared/charts";
import { LoyaltyRedeemDialog } from "./components/LoyaltyRedeemDialog";
import { REWARD_CATALOG } from "@/data/catalog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDataStore } from "@/store/data";
import { LOYALTY_TIERS, customerLoyalty, tierRank } from "@/lib/metrics";
import { formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LoyaltyTier, LoyaltyTxnType, Redemption, RewardItem } from "@/types";

const CATEGORIES: RewardItem["category"][] = ["Service", "Voucher", "Accessory", "Experience"];
const TXN_LABEL: Record<LoyaltyTxnType, string> = { earn: "Earned", bonus: "Bonus", redeem: "Redeemed", expire: "Expired" };

function useStockMap(redemptions: Redemption[]) {
  return useMemo(() => {
    const used = new Map<string, number>();
    for (const r of redemptions) used.set(r.rewardId, (used.get(r.rewardId) ?? 0) + 1);
    return new Map(REWARD_CATALOG.map((i) => [i.id, { used: used.get(i.id) ?? 0, remaining: Math.max(0, i.stock - (used.get(i.id) ?? 0)) }]));
  }, [redemptions]);
}

export default function Loyalty() {
  const { role } = useCurrentUser();
  return role === "customer" ? <CustomerLoyalty /> : <ProgrammeOverview />;
}

/* ------------------------------------------------------------------ customer */
function CustomerLoyalty() {
  const { customer, user } = useCurrentUser();
  const loyalty = useDataStore((s) => s.loyalty);
  const redemptions = useDataStore((s) => s.redemptions);
  const stock = useStockMap(redemptions);
  const [params, setParams] = useSearchParams();
  const [redeemId, setRedeemId] = useState<string | null>(params.get("redeem"));
  useEffect(() => { const r = params.get("redeem"); if (r) setRedeemId(r); }, [params]);

  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [affordable, setAffordable] = useState(false);
  const [txnType, setTxnType] = useState<string>("all");
  const [txnPage, setTxnPage] = useState(1);

  const cid = customer?.id ?? "";
  const lp = useMemo(() => customerLoyalty(loyalty, cid), [loyalty, cid]);
  const myTxns = useMemo(() => loyalty.filter((t) => t.customerId === cid).sort((a, b) => b.date.localeCompare(a.date)), [loyalty, cid]);
  const myRedemptions = useMemo(() => redemptions.filter((r) => r.customerId === cid).sort((a, b) => b.date.localeCompare(a.date)), [redemptions, cid]);
  const earnedThisMonth = useMemo(() => {
    const d = new Date(); const key = `${d.getFullYear()}-${d.getMonth()}`;
    return myTxns.filter((t) => t.points > 0 && (() => { const x = new Date(t.date); return `${x.getFullYear()}-${x.getMonth()}` === key; })()).reduce((s, t) => s + t.points, 0);
  }, [myTxns]);

  const catalogue = useMemo(() => REWARD_CATALOG
    .filter((i) => cat === "all" || i.category === cat)
    .filter((i) => !affordable || i.points <= lp.balance)
    .sort((a, b) => (sort === "asc" ? a.points - b.points : b.points - a.points)), [cat, affordable, sort, lp.balance]);

  const txnFiltered = useMemo(() => myTxns.filter((t) => txnType === "all" || t.type === txnType), [myTxns, txnType]);
  const pageSize = 10;
  const txnPageCount = Math.max(1, Math.ceil(txnFiltered.length / pageSize));
  const txnSafePage = Math.min(txnPage, txnPageCount);

  if (!customer) return <EmptyState icon={Gift} title="No customer profile linked" description="Switch to the Customer demo role to see loyalty points." />;

  const lockReason = (i: RewardItem): string | null => {
    const st = stock.get(i.id)!;
    if (st.remaining <= 0) return "Out of stock";
    if (i.minTier && tierRank(lp.tier) < tierRank(i.minTier)) return `Requires ${i.minTier} tier`;
    if (lp.balance < i.points) return `${formatNumber(i.points - lp.balance)} more points needed`;
    return null;
  };
  const redeemItem = redeemId ? REWARD_CATALOG.find((i) => i.id === redeemId) ?? null : null;
  const closeRedeem = (o: boolean) => {
    if (o) return;
    setRedeemId(null);
    if (params.get("redeem")) { const p = new URLSearchParams(params); p.delete("redeem"); setParams(p, { replace: true }); }
  };
  const nextTierMin = LOYALTY_TIERS.find((t) => t.tier === lp.nextTier)?.min;

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty points & redemption" description="Earn points on every verified purchase at participating shops and workshops, then redeem them for services and vouchers." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ai/10 via-brand/5 to-transparent" aria-hidden />
          <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4 text-ai" />Available points</div>
              <div className="mt-1 text-5xl font-semibold tracking-tight num">{formatNumber(lp.balance)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <TierBadge tier={lp.tier} />
                <span className="num">{formatNumber(lp.lifetime)} lifetime</span><span>·</span><span className="num">{formatNumber(lp.redeemed)} redeemed</span>
              </div>
            </div>
            <div className="w-full rounded-xl border bg-card/80 p-4 sm:w-72">
              <div className="flex items-center justify-between text-sm"><span className="font-medium">{lp.nextTier ? `Progress to ${lp.nextTier}` : "Top tier reached"}</span><Award className="h-4 w-4 text-ai" /></div>
              <Progress value={lp.progress} className="mt-3" indicatorClassName="bg-gradient-to-r from-ai to-brand" />
              <p className="mt-2 text-xs text-muted-foreground num">{lp.nextTier ? `${formatNumber(lp.pointsToNext)} lifetime points to go (${formatNumber(nextTierMin ?? 0)} needed)` : "You enjoy every Platinum benefit."}</p>
              <div className="mt-3 flex justify-between gap-1">
                {LOYALTY_TIERS.map((t) => (
                  <span key={t.tier} className={cn("flex-1 rounded-md py-1 text-center text-[10px] font-medium", tierRank(lp.tier) >= tierRank(t.tier) ? "bg-ai-soft text-ai" : "bg-muted text-muted-foreground")}>{t.tier}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <KpiCard label="Earned this month" value={formatNumber(earnedThisMonth)} icon={TrendingUp} tone="positive" hint="Purchase and bonus points credited this calendar month." />
          <KpiCard label="Rewards redeemed" value={formatNumber(myRedemptions.length)} icon={Ticket} tone="ai" sub={<span>Signed in as {user?.name}</span>} />
        </div>
      </div>

      {/* catalogue */}
      <Card>
        <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div><CardTitle>Reward catalogue</CardTitle><CardDescription className="mt-1">Redeem points for services, vouchers and accessories at partner outlets.</CardDescription></div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={cat} onValueChange={setCat} className="min-w-0 max-w-full">
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                {CATEGORIES.map((c) => <TabsTrigger key={c} value={c} className="text-xs">{c}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <Select value={sort} onValueChange={(v) => setSort(v as "asc" | "desc")}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label="Sort rewards"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="asc">Points: low to high</SelectItem><SelectItem value="desc">Points: high to low</SelectItem></SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Switch id="affordable" checked={affordable} onCheckedChange={setAffordable} /><Label htmlFor="affordable" className="text-xs">Affordable only</Label></div>
          </div>
        </CardHeader>
        <CardContent>
          {catalogue.length === 0 ? (
            <EmptyState icon={Gift} title="No rewards match" description={affordable ? "You can't afford any rewards in this category yet — keep earning!" : "Try another category."}
              action={<Button variant="outline" size="sm" onClick={() => { setCat("all"); setAffordable(false); }}>Clear filters</Button>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {catalogue.map((i) => {
                const reason = lockReason(i);
                const st = stock.get(i.id)!;
                const tierLocked = !!i.minTier && tierRank(lp.tier) < tierRank(i.minTier);
                return (
                  <div key={i.id} className={cn("flex flex-col rounded-xl border p-4 transition-colors", reason ? "bg-muted/30" : "hover:border-ai/40 hover:shadow-sm")}>
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", reason ? "bg-muted text-muted-foreground" : "bg-ai-soft text-ai")}>
                        {st.remaining <= 0 ? <PackageX className="h-5 w-5" /> : tierLocked ? <Lock className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                      </span>
                      <div className="flex flex-col items-end gap-1"><Badge variant="secondary">{i.category}</Badge>{i.minTier && <TierBadge tier={i.minTier} />}</div>
                    </div>
                    <div className="mt-3 font-medium leading-snug">{i.title}</div>
                    <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-muted-foreground">{i.description}</p>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-lg font-semibold num">{formatNumber(i.points)} <span className="text-xs font-normal text-muted-foreground">pts</span></span>
                      <span className={cn("text-[11px] num", st.remaining <= 0 ? "text-destructive" : st.remaining <= 5 ? "text-warning" : "text-muted-foreground")}>{st.remaining <= 0 ? "Out of stock" : `${st.remaining} left`}</span>
                    </div>
                    {reason ? (
                      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setRedeemId(i.id)} aria-label={`${i.title}: ${reason}`}><Lock />{reason}</Button>
                    ) : (
                      <Button variant="ai" size="sm" className="mt-3 w-full" onClick={() => setRedeemId(i.id)}><Sparkles />Redeem</Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <DemoNotice className="mt-4">Redemptions are simulated demo actions — points and stock update in this browser only.</DemoNotice>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div><CardTitle>Points history</CardTitle><CardDescription className="mt-1">Every point earned, awarded as a bonus or redeemed.</CardDescription></div>
            <Select value={txnType} onValueChange={(v) => { setTxnType(v); setTxnPage(1); }}>
              <SelectTrigger className="h-8 w-32 text-xs" aria-label="Filter transactions"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="earn">Earned</SelectItem><SelectItem value="bonus">Bonus</SelectItem><SelectItem value="redeem">Redeemed</SelectItem></SelectContent>
            </Select>
          </CardHeader>
          {txnFiltered.length === 0 ? <EmptyState title="No transactions" description="Nothing of this type yet." /> : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Points</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txnFiltered.slice((txnSafePage - 1) * pageSize, txnSafePage * pageSize).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-[13px]">{formatDate(t.date)}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-[13px]" title={t.description}>{t.description}</TableCell>
                      <TableCell><Badge variant={t.type === "redeem" ? "ai" : t.type === "bonus" ? "warning" : t.type === "expire" ? "muted" : "positive"}>{TXN_LABEL[t.type]}</Badge></TableCell>
                      <TableCell className={cn("text-right font-medium num", t.points > 0 ? "text-positive" : "text-foreground")}>
                        <span className="inline-flex items-center gap-0.5">{t.points > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{t.points > 0 ? "+" : "−"}{formatNumber(Math.abs(t.points))}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={txnSafePage} pageCount={txnPageCount} total={txnFiltered.length} pageSize={pageSize} onPage={setTxnPage} />
            </>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Redemption history</CardTitle><CardDescription>Codes for rewards you've redeemed.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {myRedemptions.length === 0 && <EmptyState icon={Ticket} title="No redemptions yet" description="Redeem a reward from the catalogue above." className="py-6" />}
            {myRedemptions.map((r) => {
              const item = REWARD_CATALOG.find((i) => i.id === r.rewardId);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai"><Ticket className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item?.title ?? r.rewardId}</div>
                    <div className="text-xs text-muted-foreground"><code className="font-mono">{r.code}</code> · {formatDate(r.date)} · <span className="num">{formatNumber(r.points)} pts</span></div>
                  </div>
                  <Badge variant={r.status === "issued" ? "positive" : "muted"}>{r.status === "issued" ? "Issued" : "Used"}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <LoyaltyRedeemDialog item={redeemItem} onOpenChange={closeRedeem} customerId={cid} balance={lp.balance} tier={lp.tier}
        remaining={redeemItem ? stock.get(redeemItem.id)?.remaining ?? 0 : 0} />
    </div>
  );
}

/* ------------------------------------------------------------------ admin / brand */
function ProgrammeOverview() {
  const { role } = useCurrentUser();
  const loyalty = useDataStore((s) => s.loyalty);
  const customers = useDataStore((s) => s.customers);
  const redemptions = useDataStore((s) => s.redemptions);
  const stock = useStockMap(redemptions);

  const data = useMemo(() => {
    const members = customers.map((c) => ({ c, l: customerLoyalty(loyalty, c.id) }));
    const byTier = LOYALTY_TIERS.map((t) => ({ tier: t.tier as LoyaltyTier, count: members.filter((m) => m.l.tier === t.tier).length }));
    let issued = 0, redeemed = 0;
    for (const t of loyalty) { if (t.points > 0) issued += t.points; else redeemed += -t.points; }
    const most = REWARD_CATALOG.map((i) => ({ i, count: stock.get(i.id)?.used ?? 0, points: (stock.get(i.id)?.used ?? 0) * i.points })).sort((a, b) => b.count - a.count);
    const top = [...members].sort((a, b) => b.l.lifetime - a.l.lifetime).slice(0, 8);
    const recent = [...redemptions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const active = members.filter((m) => m.l.lifetime > 0).length;
    return { byTier, issued, redeemed, most, top, recent, members: members.length, active, outstanding: issued - redeemed };
  }, [customers, loyalty, redemptions, stock]);
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const redemptionRate = data.issued ? (data.redeemed / data.issued) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty programme" description={role === "brand" ? "How customers earn and redeem points across the network your products are sold through." : "Programme health across all customers: tiers, points economy and reward demand."} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Members" value={formatNumber(data.members)} icon={Users} tone="brand" sub={<span className="num">{formatNumber(data.active)} with points</span>} />
        <KpiCard label="Points issued" value={formatNumber(data.issued, { compact: true })} icon={Coins} tone="positive" hint="Lifetime points credited from purchases and bonuses." />
        <KpiCard label="Points redeemed" value={formatNumber(data.redeemed, { compact: true })} icon={Ticket} tone="ai" sub={<span className="num">{formatNumber(data.outstanding, { compact: true })} outstanding</span>} />
        <KpiCard label="Redemption rate" value={formatPercent(redemptionRate)} icon={Percent} tone="action" hint="Points redeemed ÷ points issued × 100." />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Members by tier" description="Tier is based on lifetime points earned.">
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byTier} dataKey="count" nameKey="tier" innerRadius={58} outerRadius={88} paddingAngle={2} strokeWidth={0}>
                  {data.byTier.map((_, i) => <Cell key={i} fill={SERIES[(i + 2) % SERIES.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold num">{data.members}</span><span className="text-xs text-muted-foreground">members</span></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {data.byTier.map((t, i) => (
              <div key={t.tier} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES[(i + 2) % SERIES.length] }} />{t.tier}</span>
                <span className="font-semibold num">{t.count}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard className="lg:col-span-2" title="Most redeemed rewards" description="Number of redemptions per catalogue reward.">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.most.map((m) => ({ label: m.i.title.length > 22 ? `${m.i.title.slice(0, 21)}…` : m.i.title, count: m.count }))} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Redemptions" fill={C.c5} radius={[0, 3, 3, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle>Reward catalogue</CardTitle><CardDescription>Read-only view with live stock (stock − redemptions).</CardDescription></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Reward</TableHead><TableHead className="hidden sm:table-cell">Category</TableHead><TableHead>Tier</TableHead><TableHead className="text-right">Points</TableHead><TableHead className="text-right">Redeemed</TableHead><TableHead className="w-40">Stock</TableHead></TableRow></TableHeader>
          <TableBody>
            {REWARD_CATALOG.map((i) => {
              const st = stock.get(i.id)!;
              return (
                <TableRow key={i.id}>
                  <TableCell><div className="text-[13px] font-medium">{i.title}</div><div className="hidden max-w-[320px] truncate text-[11px] text-muted-foreground md:block">{i.description}</div></TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{i.category}</Badge></TableCell>
                  <TableCell>{i.minTier ? <TierBadge tier={i.minTier} /> : <span className="text-xs text-muted-foreground">Any</span>}</TableCell>
                  <TableCell className="text-right num">{formatNumber(i.points)}</TableCell>
                  <TableCell className="text-right num">{st.used}</TableCell>
                  <TableCell>
                    {i.stock === 0 && st.used === 0 ? <Badge variant="destructive">Out of stock</Badge> : (
                      <div><div className="mb-1 flex justify-between text-[11px] num"><span className={cn(st.remaining === 0 && "text-destructive")}>{st.remaining} left</span><span className="text-muted-foreground">of {i.stock}</span></div>
                        <Progress value={i.stock ? (st.remaining / i.stock) * 100 : 0} className="h-1.5" indicatorClassName={st.remaining <= 5 ? "bg-warning" : "bg-positive"} /></div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top customers</CardTitle><CardDescription>By lifetime points (fictional demo customers).</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {data.top.map(({ c, l }, idx) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
                <span className={cn("w-5 text-center text-sm font-semibold num", idx < 3 ? "text-warning" : "text-muted-foreground")}>{idx + 1}</span>
                <EntityAvatar name={c.name} hue={c.hue} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.city}</div></div>
                <TierBadge tier={l.tier} />
                <div className="w-20 text-right"><div className="text-sm font-semibold num">{formatNumber(l.lifetime)}</div><div className="text-[11px] text-muted-foreground num">{formatNumber(l.balance)} avail.</div></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent redemptions</CardTitle><CardDescription>Latest rewards redeemed across all customers.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.recent.length === 0 && <EmptyState icon={Ticket} title="No redemptions yet" className="py-6" />}
            {data.recent.map((r) => {
              const item = REWARD_CATALOG.find((i) => i.id === r.rewardId);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai"><Gift className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item?.title ?? r.rewardId}</div><div className="text-xs text-muted-foreground">{customerName(r.customerId)} · {timeAgo(r.date)}</div></div>
                  <span className="text-sm font-semibold num">{formatNumber(r.points)} pts</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
