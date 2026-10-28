import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BadgeCheck, Clock, MapPin, Moon, Send, Store, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { C, ChartCard, ChartTooltip, Legend, SERIES } from "@/components/shared/charts";
import { SortableHead, useTableState } from "@/components/shared/table-kit";
import { RankedBarList } from "@/pages/dashboards/components/RankedBarList";
import { Donut } from "@/pages/dashboards/components/Donut";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { leaderboard, rangeLabel, refsInRange, type AdvocateRow } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { AdvocateType } from "@/types";
import { cn } from "@/lib/utils";

interface Dormant { id: string; type: AdvocateType; name: string; sub: string; city: string; hue: number; joinedAt: string; campaigns: number }

export default function Network() {
  const { role } = useCurrentUser();
  const scope = useScope();
  const range = useUIStore((s) => s.dateRange);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const [dormantType, setDormantType] = useState<"all" | AdvocateType>("all");
  const [mixView, setMixView] = useState<"mechanic" | "shop">("mechanic");
  const [inviting, setInviting] = useState<Dormant[] | null>(null);
  const [inviteCampaign, setInviteCampaign] = useState("");
  const isBrand = role === "brand";
  const liveCampaigns = scope.campaigns.filter((c) => c.status === "active" || c.status === "scheduled");

  const data = useMemo(() => {
    const vShops = shops.filter((s) => s.status === "verified");
    const vMechs = mechanics.filter((m) => m.status === "verified");
    const pending = shops.filter((s) => s.status === "pending").length + mechanics.filter((m) => m.status === "pending").length;
    const verifiedAll = [...vShops.map((s) => ({ ...s, type: "shop" as const })), ...vMechs.map((m) => ({ ...m, type: "mechanic" as const }))];
    const cities = new Set(verifiedAll.map((a) => a.city)).size;
    const states = new Set(verifiedAll.map((a) => a.state)).size;

    // by state, shop/mechanic split
    const st = new Map<string, { shop: number; mechanic: number; cities: Set<string> }>();
    for (const a of verifiedAll) {
      const g = st.get(a.state) ?? { shop: 0, mechanic: 0, cities: new Set<string>() };
      g[a.type]++; g.cities.add(a.city);
      st.set(a.state, g);
    }
    const byState = Array.from(st.entries()).map(([state, g]) => ({
      id: state, label: state, value: g.shop + g.mechanic, sub: `${g.shop} shops · ${g.mechanic} mech. · ${g.cities.size} ${g.cities.size === 1 ? "city" : "cities"}`,
      segments: [{ label: "Shops", value: g.shop, color: C.c1 }, { label: "Mechanics", value: g.mechanic, color: C.c3 }],
    })).sort((a, b) => b.value - a.value);

    // cumulative growth by month (all applicants that are now verified)
    const all = [...shops.map((s) => ({ t: "shop" as const, at: s.joinedAt, ok: s.status === "verified" })), ...mechanics.map((m) => ({ t: "mechanic" as const, at: m.joinedAt, ok: m.status === "verified" }))]
      .filter((x) => x.ok).sort((a, b) => a.at.localeCompare(b.at));
    const growth: { label: string; shops: number; mechanics: number }[] = [];
    if (all.length) {
      const start = new Date(all[0]!.at); start.setDate(1); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setDate(1); end.setHours(0, 0, 0, 0);
      let s = 0, m = 0, i = 0;
      for (const d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const next = new Date(d); next.setMonth(next.getMonth() + 1);
        while (i < all.length && new Date(all[i]!.at) < next) { if (all[i]!.t === "shop") s++; else m++; i++; }
        growth.push({ label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), shops: s, mechanics: m });
      }
    }

    const mix = (vals: string[]) => {
      const c = new Map<string, number>();
      for (const v of vals) c.set(v, (c.get(v) ?? 0) + 1);
      return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ key: label, label, value, color: SERIES[i % SERIES.length]! }));
    };
    const specMix = mix(vMechs.map((m) => m.specialization));
    const catMix = mix(vShops.map((s) => s.category));

    // health — activity measured on the role's scoped referrals
    const inR = refsInRange(scope.referrals, range);
    const clicksBy = new Map<string, number>();
    for (const r of inR) clicksBy.set(r.advocateId, (clicksBy.get(r.advocateId) ?? 0) + 1);
    const brandCampIds = new Set(scope.campaigns.map((c) => c.id));
    // brand: only advocates enrolled in its campaigns are expected to be active for it
    const pool = verifiedAll.filter((a) => !isBrand || a.campaignIds.some((id) => brandCampIds.has(id)));
    const activeCount = pool.filter((a) => (clicksBy.get(a.id) ?? 0) > 0).length;
    const dormant: Dormant[] = pool.filter((a) => !clicksBy.get(a.id)).map((a) => ({
      id: a.id, type: a.type, name: a.name, sub: a.type === "shop" ? (a as typeof vShops[number]).owner : (a as typeof vMechs[number]).workshop,
      city: `${a.city}, ${a.state}`, hue: a.hue, joinedAt: a.joinedAt, campaigns: a.campaignIds.length,
    })).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

    const top = leaderboard(shops, mechanics, scope.referrals, scope.rewards, range).filter((r) => r.clicks > 0);
    return { vShops: vShops.length, vMechs: vMechs.length, pending, cities, states, byState, growth, specMix, catMix, poolSize: pool.length, activeCount, dormant, top };
  }, [shops, mechanics, scope, range, isBrand]);

  const t = useTableState<AdvocateRow>(data.top, {
    sorters: { verified: (r) => r.verified, revenue: (r) => r.revenue, conv: (r) => r.conversionRate, clicks: (r) => r.clicks, rewards: (r) => r.rewards },
    initialSort: { key: "verified", dir: "desc" }, pageSize: 8,
  });

  const dormantShown = data.dormant.filter((d) => dormantType === "all" || d.type === dormantType);
  const healthPct = data.poolSize ? (data.activeCount / data.poolSize) * 100 : 0;
  const openInvite = (list: Dormant[]) => { setInviteCampaign(liveCampaigns[0]?.id ?? ""); setInviting(list); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advocate network"
        description={isBrand
          ? `Network composition is platform-wide; activity and performance reflect your brand's campaigns only · ${rangeLabel(range)}`
          : `Shops and mechanics across the platform — reach, growth and engagement · ${rangeLabel(range)}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/app/mechanics"><Wrench />Mechanics</Link></Button>
          <Button variant="outline" asChild><Link to="/app/shops"><Store />Shops</Link></Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Verified shops" value={formatNumber(data.vShops)} icon={Store} tone="brand" hint="Retail shops that passed verification (platform-wide)." />
        <KpiCard label="Verified mechanics" value={formatNumber(data.vMechs)} icon={Wrench} tone="positive" hint="Mechanics who passed verification (platform-wide)." />
        <KpiCard label="Pending approval" value={formatNumber(data.pending)} icon={Clock} tone="warning" hint="Shop and mechanic applications awaiting admin review."
          sub={role === "admin" ? <Link to="/app/approvals" className="text-action hover:underline">Review queue</Link> : undefined} />
        <KpiCard label="Coverage" value={`${data.cities} cities`} icon={MapPin} tone="action" hint="Distinct cities and states with at least one verified advocate." sub={<span>across {data.states} states</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Network growth" description="Cumulative verified advocates by month joined (all time)"
          action={<Legend items={[{ label: "Shops", color: C.c1 }, { label: "Mechanics", color: C.c3 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.growth} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="shops" name="Shops" stackId="1" stroke={C.c1} fill={C.c1} fillOpacity={0.25} strokeWidth={2} />
                <Area type="monotone" dataKey="mechanics" name="Mechanics" stackId="1" stroke={C.c3} fill={C.c3} fillOpacity={0.25} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Advocates by state" description="Verified advocates, split by type"
          action={<Legend items={[{ label: "Shops", color: C.c1 }, { label: "Mech.", color: C.c3 }]} />}>
          <RankedBarList items={data.byState} limit={9} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={mixView === "mechanic" ? "Mechanic specialisations" : "Shop categories"} description="Composition of the verified network"
          action={<Tabs value={mixView} onValueChange={(v) => setMixView(v as "mechanic" | "shop")}><TabsList className="h-8"><TabsTrigger value="mechanic" className="text-xs">Mechanics</TabsTrigger><TabsTrigger value="shop" className="text-xs">Shops</TabsTrigger></TabsList></Tabs>}>
          <Donut className="sm:grid-cols-1" centerLabel={mixView === "mechanic" ? "mechanics" : "shops"} data={mixView === "mechanic" ? data.specMix : data.catMix} />
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-positive" />Network health</CardTitle>
              <CardDescription className="mt-1">
                {isBrand ? "Verified advocates enrolled in your campaigns" : "Verified advocates"} with at least one referral visit · {rangeLabel(range)}. Dormant = zero visits in the period.
              </CardDescription>
            </div>
            <Select value={dormantType} onValueChange={(v) => setDormantType(v as "all" | AdvocateType)}>
              <SelectTrigger className="h-8 w-32 text-xs" aria-label="Filter dormant advocates"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="shop">Shops</SelectItem><SelectItem value="mechanic">Mechanics</SelectItem></SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[200px,1fr]">
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-semibold tracking-tight num">{formatPercent(healthPct, 0)}</div>
                <div className="text-xs text-muted-foreground">active in period</div>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-positive" style={{ width: `${healthPct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-positive-soft/70 p-2.5"><div className="text-muted-foreground">Active</div><div className="text-lg font-semibold text-positive num">{data.activeCount}</div></div>
                <div className="rounded-lg bg-muted/70 p-2.5"><div className="text-muted-foreground">Dormant</div><div className="text-lg font-semibold num">{data.dormant.length}</div></div>
              </div>
              <Button variant="outline" size="sm" className="w-full" disabled={!dormantShown.length || !liveCampaigns.length} onClick={() => openInvite(dormantShown)}>
                <Send />Invite all {dormantShown.length} to a campaign
              </Button>
            </div>
            <div className="min-w-0">
              {dormantShown.length === 0 ? (
                <EmptyState icon={BadgeCheck} title="No dormant advocates" description="Everyone in this group was active in the period." className="py-8" />
              ) : (
                <ul className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                  {dormantShown.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                      <EntityAvatar name={d.name} hue={d.hue} size="sm" type={d.type} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/app/${d.type === "shop" ? "shops" : "mechanics"}?open=${d.id}`} className="block truncate text-sm font-medium hover:text-action">{d.name}</Link>
                        <div className="truncate text-[11px] text-muted-foreground">{d.sub} · {d.city} · {d.campaigns} campaigns</div>
                      </div>
                      <Badge variant="muted" className="hidden sm:inline-flex"><Moon />Dormant</Badge>
                      <Button size="sm" variant="ghost" disabled={!liveCampaigns.length} onClick={() => openInvite([d])} aria-label={`Invite ${d.name} to a campaign`}><Send /><span className="hidden sm:inline">Invite</span></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Top advocates</CardTitle><CardDescription className="mt-1">{isBrand ? "Performance on your campaigns" : "Platform-wide performance"} · {rangeLabel(range)}</CardDescription></div>
          <Badge variant="outline" className="num"><Users />{data.top.length} active</Badge>
        </CardHeader>
        {data.top.length === 0 ? <EmptyState title="No advocate activity in this period" description="Try widening the date range." /> : (
          <>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Advocate</TableHead>
                <SortableHead label="Visits" sortKey="clicks" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />
                <SortableHead label="Verified" sortKey="verified" sort={t.sort} onSort={t.toggleSort} align="right" />
                <SortableHead label="Conv." sortKey="conv" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden md:table-cell" />
                <SortableHead label="Revenue" sortKey="revenue" sort={t.sort} onSort={t.toggleSort} align="right" />
                <SortableHead label="Rewards" sortKey="rewards" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden lg:table-cell" />
              </TableRow></TableHeader>
              <TableBody>
                {t.pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={cn("font-semibold num", r.rank <= 3 ? "text-warning" : "text-muted-foreground")}>{r.rank}</TableCell>
                    <TableCell>
                      <Link to={`/app/${r.type === "shop" ? "shops" : "mechanics"}?open=${r.id}`} className="flex items-center gap-2.5 hover:text-action">
                        <EntityAvatar name={r.name} hue={r.hue} size="sm" type={r.type} />
                        <div className="min-w-0"><div className="max-w-[200px] truncate text-[13px] font-medium">{r.name}</div><div className="text-[11px] capitalize text-muted-foreground">{r.type} · {r.city}</div></div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-right num sm:table-cell">{formatNumber(r.clicks)}</TableCell>
                    <TableCell className="text-right font-medium num">{formatNumber(r.verified)}</TableCell>
                    <TableCell className="hidden text-right num md:table-cell">{formatPercent(r.conversionRate)}</TableCell>
                    <TableCell className="text-right num">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="hidden text-right num lg:table-cell">{formatCurrency(r.rewards)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="num">Page {t.page} of {t.pageCount}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => t.setPage(t.page - 1)} disabled={t.page <= 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => t.setPage(t.page + 1)} disabled={t.page >= t.pageCount}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!inviting}
        onOpenChange={(o) => !o && setInviting(null)}
        title={inviting && inviting.length === 1 ? `Invite ${inviting[0]!.name}` : `Invite ${inviting?.length ?? 0} dormant advocates`}
        description="Send a nudge to join a live campaign and start referring again."
        confirmLabel="Send invite"
        onConfirm={async () => {
          if (!inviting) return;
          await new Promise((r) => setTimeout(r, 600));
          const camp = liveCampaigns.find((c) => c.id === inviteCampaign);
          toast.success(`Invite sent to ${inviting.length === 1 ? inviting[0]!.name : `${inviting.length} advocates`}`, { description: `Simulated — no message was actually sent. Campaign: ${camp?.name}.` });
        }}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-camp">Campaign</Label>
            <Select value={inviteCampaign} onValueChange={setInviteCampaign}>
              <SelectTrigger id="invite-camp"><SelectValue placeholder="Select a campaign" /></SelectTrigger>
              <SelectContent>{liveCampaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {formatDate(c.endDate, { day: "numeric", month: "short" })}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DemoNotice>Demo action — the invitation is simulated. No SMS, email or WhatsApp message is sent.</DemoNotice>
        </div>
      </ConfirmDialog>
    </div>
  );
}
