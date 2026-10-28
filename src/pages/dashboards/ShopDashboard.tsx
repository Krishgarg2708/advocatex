import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BadgeCheck, CheckCircle2, Clock, Coins, FileText, Globe, Hash, History, Link2, MapPin, MessageCircle, MousePointerClick, Percent, QrCode,
  Repeat, ShieldAlert, Store, Target, Trophy, Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RankedBarList } from "./components/RankedBarList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { DAY_MS, advocateTier, delta, funnel, leaderboard, previousRange, rangeLabel, refsInRange, timeSeries, wallet } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import type { Referral } from "@/types";
import { cn } from "@/lib/utils";

const CHANNELS: { key: Referral["channel"]; icon: React.ComponentType<{ className?: string }>; color: string; label: string }[] = [
  { key: "In-store", icon: Store, color: C.c1, label: "In-store" },
  { key: "QR", icon: QrCode, color: C.c2, label: "QR scan" },
  { key: "WhatsApp", icon: MessageCircle, color: C.c3, label: "WhatsApp" },
  { key: "Link", icon: Globe, color: C.c4, label: "Link" },
];

export default function ShopDashboard() {
  const { shop, user } = useCurrentUser();
  const range = useUIStore((s) => s.dateRange);
  const referrals = useDataStore((s) => s.referrals);
  const rewards = useDataStore((s) => s.rewards);
  const campaigns = useDataStore((s) => s.campaigns);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const { campaignById, productById, brandById } = useLookups();

  const data = useMemo(() => {
    if (!shop) return null;
    const mine = referrals.filter((r) => r.advocateId === shop.id);
    const inR = refsInRange(mine, range);
    const cur = funnel(inR);
    const prev = funnel(refsInRange(mine, previousRange(range)));
    const lifetime = funnel(mine);
    const w = wallet(rewards, shop.id);
    const series = timeSeries(mine, rewards.filter((t) => t.advocateId === shop.id), range);
    const board = leaderboard(shops, mechanics, referrals, rewards, range, "shop");
    const me = board.find((x) => x.id === shop.id);

    // channel mix (clicks + verified) in range
    const channels = CHANNELS.map((ch) => {
      const rs = inR.filter((r) => r.channel === ch.key);
      const f = funnel(rs);
      return { ...ch, clicks: f.clicks, verified: f.verified, conv: f.conversionRate };
    });

    // top products sold through the shop (verified, in range)
    const byProd = new Map<string, { units: number; revenue: number }>();
    for (const r of inR) {
      if (r.status !== "verified") continue;
      const p = byProd.get(r.productId) ?? { units: 0, revenue: 0 };
      p.units++; p.revenue += r.purchaseValue;
      byProd.set(r.productId, p);
    }
    const topProducts = Array.from(byProd.entries()).map(([id, v]) => ({ p: productById.get(id), ...v })).filter((x) => x.p).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const now = Date.now();
    const active = campaigns.filter((c) => shop.campaignIds.includes(c.id) && (c.status === "active" || c.status === "scheduled")).map((c) => {
      const cr = mine.filter((r) => r.campaignId === c.id && r.status === "verified");
      return { c, verified: cr.length, earned: cr.reduce((s, r) => s + r.reward, 0), daysLeft: Math.ceil((new Date(c.endDate).getTime() - now) / DAY_MS), daysToStart: Math.ceil((new Date(c.startDate).getTime() - now) / DAY_MS) };
    });
    const openToJoin = campaigns.filter((c) => c.status === "active" && c.advocateTypes.includes("shop") && !shop.campaignIds.includes(c.id)).length;
    const recent = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
    return { cur, prev, lifetime, w, series, board, me, channels, topProducts, active, openToJoin, recent, tier: advocateTier(lifetime.verified) };
  }, [shop, referrals, rewards, campaigns, shops, mechanics, range, productById]);

  if (!shop || !data) return <EmptyState icon={Store} title="No shop profile linked" description="Switch to the Shop Owner demo role to see this dashboard." />;
  const { cur, prev, w } = data;
  const top5 = data.board.slice(0, 5);
  const meInTop = top5.some((x) => x.id === shop.id);
  const channelMax = Math.max(1, ...data.channels.map((c) => c.clicks));
  const verified = shop.status === "verified";

  return (
    <div className="space-y-6">
      <PageHeader
        title={shop.name}
        description={`Good to see you, ${shop.owner.split(" ")[0]}. Here's what your counter referrals delivered · ${rangeLabel(range)}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/app/rewards"><History />Reward history</Link></Button>
          <Button variant="outline" asChild><Link to="/app/referrals"><Repeat />Referral details</Link></Button>
          <Button asChild><Link to="/app/campaigns"><Target />Explore campaigns</Link></Button>
        </>}
      />

      {/* business profile + toolkit */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-action/10 via-brand/10 to-ai/10" aria-hidden />
          <CardContent className="relative space-y-4 p-5">
            <div className="flex items-start gap-4">
              <EntityAvatar name={shop.name} hue={shop.hue} size="xl" type="shop" className="ring-4 ring-card" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {verified ? <Badge variant="positive"><BadgeCheck />Verified business</Badge> : <StatusBadge status={shop.status} context="verification" />}
                  <TierBadge tier={data.tier} />
                </div>
                <div className="mt-2 text-sm font-medium">{shop.owner}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />{shop.category}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{shop.city}, {shop.state}</span>
                </div>
              </div>
            </div>
            {!verified && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/60 p-3 text-xs">
                <ShieldAlert className="mt-px h-4 w-4 shrink-0 text-warning" />
                <span>{shop.status === "pending" ? "Your business is awaiting verification. Referrals are tracked, but rewards unlock after approval." : "Verification was not approved. Update your business details in Settings and contact support."}</span>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border bg-card/80 p-3"><dt className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" />Referral code</dt><dd className="mt-0.5 font-mono text-sm font-semibold">{shop.referralCode}</dd></div>
              <div className="rounded-lg border bg-card/80 p-3"><dt className="flex items-center gap-1 text-muted-foreground"><FileText className="h-3 w-3" />GSTIN</dt><dd className="mt-0.5 truncate font-mono text-[13px]">{shop.gstin}</dd></div>
              <div className="rounded-lg border bg-card/80 p-3"><dt className="text-muted-foreground">Shop ranking</dt><dd className="mt-0.5 text-lg font-semibold num">{data.me ? `#${data.me.rank}` : "—"}<span className="ml-1 text-[11px] font-normal text-muted-foreground">of {data.board.length}</span></dd></div>
              <div className="rounded-lg border bg-card/80 p-3"><dt className="text-muted-foreground">Lifetime verified sales</dt><dd className="mt-0.5 text-lg font-semibold num">{formatNumber(data.lifetime.verified)}</dd></div>
            </dl>
            <div className="text-[11px] text-muted-foreground">Partner since {formatDate(shop.joinedAt)} · {shop.campaignIds.length} campaigns joined</div>
          </CardContent>
        </Card>
        <ReferralToolkit code={shop.referralCode} name={shop.name} className="lg:col-span-3" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total referrals" value={formatNumber(cur.clicks)} icon={MousePointerClick} tone="action" delta={delta(cur.clicks, prev.clicks)} hint="Customer visits through your link, QR code, WhatsApp shares or in-store code." />
        <KpiCard label="Verified sales" value={formatNumber(cur.verified)} icon={CheckCircle2} tone="positive" delta={delta(cur.verified, prev.verified)} hint="Purchases confirmed against an invoice. Only these earn rewards." sub={<span>{cur.pending} awaiting verification</span>} />
        <KpiCard label="Conversion rate" value={formatPercent(cur.conversionRate)} icon={Percent} tone="positive" delta={delta(cur.conversionRate, prev.conversionRate)} hint="Verified sales ÷ referral visits × 100." />
        <KpiCard label="Pending rewards" value={formatCurrency(w.pending)} icon={Clock} tone="warning" hint="Rewards for verified sales awaiting admin approval." sub={<span>+{formatCurrency(cur.pendingReward)} on unverified claims</span>} />
        <KpiCard label="Available rewards" value={formatCurrency(w.available)} icon={Wallet} tone="positive" hint="Approved rewards in your wallet that you can request as a payout (simulated)." className="col-span-2 md:col-span-1" />
      </div>

      {/* performance + channel mix */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Sales performance" description={`Referral visits (bars) and verified sales (line) · ${rangeLabel(range)}`}
          action={<Legend items={[{ label: "Visits", color: C.c2 }, { label: "Verified sales", color: C.c3 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.series} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="clicks" name="Visits" fill={C.c2} fillOpacity={0.55} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Line type="monotone" dataKey="verified" name="Verified sales" stroke={C.c3} strokeWidth={2.25} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>How customers find you</CardTitle>
            <CardDescription>Referral channel mix · {rangeLabel(range)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.channels.map((ch) => (
              <div key={ch.key} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ch.icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between text-[13px]">
                    <span className="font-medium">{ch.label}</span>
                    <span className="num"><span className="font-semibold">{ch.clicks}</span><span className="ml-1.5 text-xs text-muted-foreground">{ch.verified} sales · {formatPercent(ch.conv)}</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(ch.clicks / channelMax) * 100}%`, background: ch.color }} /></div>
                </div>
              </div>
            ))}
            {cur.clicks === 0 && <p className="text-center text-xs text-muted-foreground">No referral visits in this period yet.</p>}
          </CardContent>
        </Card>
      </div>

      {/* leaderboard + top products */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" />Shop leaderboard</CardTitle>
            <CardDescription>Verified shops ranked by verified sales · {rangeLabel(range)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {top5.map((row) => (
              <div key={row.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", row.id === shop.id && "bg-brand-soft ring-1 ring-brand/20")}>
                <span className={cn("w-6 text-center text-sm font-semibold num", row.rank <= 3 ? "text-warning" : "text-muted-foreground")}>{row.rank}</span>
                <EntityAvatar name={row.name} hue={row.hue} size="sm" type="shop" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.name}{row.id === shop.id && <span className="ml-1 text-xs text-brand">(you)</span>}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.city}</div>
                </div>
                <div className="text-right"><div className="text-sm font-semibold num">{row.verified}</div><div className="text-[11px] text-muted-foreground num">{formatCurrency(row.revenue, { compact: true })}</div></div>
              </div>
            ))}
            {!meInTop && data.me && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border-t bg-brand-soft px-2 py-2">
                <span className="w-6 text-center text-sm font-semibold num">{data.me.rank}</span>
                <EntityAvatar name={shop.name} hue={shop.hue} size="sm" type="shop" />
                <div className="flex-1 text-sm font-medium">You</div>
                <div className="text-sm font-semibold num">{data.me.verified}</div>
              </div>
            )}
            {!data.me && <p className="pt-2 text-center text-xs text-muted-foreground">Your shop joins the leaderboard once verified.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Top products sold through your shop</CardTitle><CardDescription className="mt-1">Verified referral sales by revenue · {rangeLabel(range)}</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/products">Catalogue</Link></Button>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? <EmptyState icon={Coins} title="No verified sales in this period" description="Products appear here once a referred purchase is verified." className="py-8" /> : (
              <div className="grid gap-5 md:grid-cols-[1fr,1fr]">
                <ul className="space-y-2.5">
                  {data.topProducts.map(({ p, units, revenue }) => (
                    <li key={p!.id}>
                      <Link to={`/app/products?open=${p!.id}`} className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/50">
                        <ProductImage category={p!.category} name={p!.name} size="sm" className="h-10 w-10 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{p!.name}</div>
                          <div className="text-[11px] text-muted-foreground">{brandById.get(p!.brandId)?.name} · {units} sold</div>
                        </div>
                        <span className="text-sm font-semibold num">{formatCurrency(revenue)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-muted/40 p-4">
                  <div className="mb-3 text-xs font-medium text-muted-foreground">Share of verified revenue</div>
                  <RankedBarList showRank={false} format={(v) => formatCurrency(v, { compact: true })}
                    items={data.topProducts.map(({ p, revenue }) => ({ id: p!.id, label: p!.category, value: revenue, sub: formatPercent(cur.revenue ? (revenue / cur.revenue) * 100 : 0, 0) }))} />
                  <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">Avg. order value <span className="font-semibold text-foreground num">{formatCurrency(cur.avgOrderValue)}</span> · total <span className="font-semibold text-foreground num">{formatCurrency(cur.revenue)}</span></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* campaigns + recent referrals */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Active campaigns</CardTitle><CardDescription className="mt-1">{data.openToJoin > 0 ? `${data.openToJoin} more live campaign${data.openToJoin === 1 ? "" : "s"} open to join` : "Campaigns you're enrolled in"}</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/campaigns">Explore</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.active.length === 0 && <EmptyState title="No active campaigns" description="Explore open campaigns to start earning." className="py-6" action={<Button size="sm" asChild><Link to="/app/campaigns">Explore campaigns</Link></Button>} />}
            {data.active.map(({ c, verified: v, earned, daysLeft, daysToStart }) => (
              <Link key={c.id} to={`/app/campaigns/${c.id}`} className="block rounded-lg border p-3.5 transition-colors hover:border-action/40 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate font-medium">{c.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{brandById.get(c.brandId)?.name} · {formatCurrency(c.rewardPerConversion)} per verified sale</div></div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="font-semibold text-foreground num">{v}</span> your sales</span>
                  <span><span className="font-semibold text-foreground num">{formatCurrency(earned)}</span> earned</span>
                  <span>{c.status === "scheduled" ? `Starts in ${daysToStart} days` : daysLeft >= 0 ? `${daysLeft} days left` : "Ended"}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Recent referrals</CardTitle><CardDescription className="mt-1">Latest customer referrals through your shop</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/referrals"><Link2 />All referrals</Link></Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Referral</TableHead><TableHead className="hidden sm:table-cell">Product</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Purchase</TableHead><TableHead className="hidden text-right md:table-cell">Reward</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Link to={`/app/referrals?open=${r.id}`} className="font-mono text-xs font-medium text-action hover:underline">{r.id}</Link><div className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt)} · {r.channel}</div></TableCell>
                  <TableCell className="hidden max-w-[200px] truncate text-[13px] sm:table-cell">{productById.get(r.productId)?.name}<div className="truncate text-[11px] text-muted-foreground">{campaignById.get(r.campaignId)?.name}</div></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right num">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</TableCell>
                  <TableCell className="hidden text-right font-medium num md:table-cell">{r.status === "verified" || r.status === "pending" ? formatCurrency(r.reward) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.recent.length === 0 && <EmptyState title="No referrals yet" description="Share your link or QR code to get started." />}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
            <span>Wallet: {formatCurrency(w.available)} available · {formatCurrency(w.paidOut)} paid out (simulated)</span>
            <span>Signed in as {user?.email}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
