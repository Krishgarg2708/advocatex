import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BadgeCheck, Check, CheckCircle2, ClipboardCheck, Coins, Download, Gift, IndianRupee, KeyRound, Link2, Loader2, Megaphone, MousePointerClick,
  Package, Plus, Settings, ShieldAlert, Store, Users, Wallet, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { C, ChartCard, ChartTooltip, Legend, SERIES } from "@/components/shared/charts";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { RankedBarList } from "./components/RankedBarList";
import { Donut, type DonutSlice } from "./components/Donut";
import { QuickActions } from "./components/QuickActions";
import { ReferralDetailSheet } from "./components/ReferralDetailSheet";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { api } from "@/services/api";
import { campaignParticipants, campaignStats, delta, funnel, inRange, previousRange, rangeLabel, refsInRange, spendOf, timeSeries } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, formatRatio, timeAgo } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import type { AdvocateType, AuditEntry, FlagType, Referral, ReferralStatus } from "@/types";
import { cn } from "@/lib/utils";

/** Internal accounts not represented in the advocate/customer tables: 1 super admin + 4 brand managers. */
const STAFF_ACCOUNTS = 5;

const AUDIT_ICON: Record<AuditEntry["category"], { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  auth: { icon: KeyRound, cls: "bg-muted text-muted-foreground" },
  campaign: { icon: Megaphone, cls: "bg-action-soft text-action" },
  referral: { icon: Link2, cls: "bg-brand-soft text-brand" },
  reward: { icon: Wallet, cls: "bg-positive-soft text-positive" },
  approval: { icon: ClipboardCheck, cls: "bg-warning-soft text-warning" },
  fraud: { icon: ShieldAlert, cls: "bg-destructive/10 text-destructive" },
  product: { icon: Package, cls: "bg-ai-soft text-ai" },
  settings: { icon: Settings, cls: "bg-muted text-muted-foreground" },
  loyalty: { icon: Gift, cls: "bg-ai-soft text-ai" },
};

const FLAG_TYPE_LABEL: Record<FlagType, string> = {
  duplicate_pattern: "Duplicate pattern", high_frequency: "High click frequency", repeated_txn: "Repeated transaction",
  conversion_spike: "Conversion spike", reward_abuse: "Reward abuse",
};

const STATUS_OPTIONS: { value: "all" | ReferralStatus; label: string }[] = [
  { value: "all", label: "All statuses" }, { value: "clicked", label: "Clicked" }, { value: "lead", label: "Qualified lead" },
  { value: "pending", label: "Pending verification" }, { value: "verified", label: "Verified" }, { value: "rejected", label: "Rejected" },
];

interface CampTip { active?: boolean; payload?: { payload?: { name: string; verified: number; conv: number; clicks: number } }[] }
function CampaignTooltip({ active, payload }: CampTip) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="min-w-[170px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lift">
      <div className="mb-1.5 font-medium text-foreground">{d.name}</div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Verified conversions</span><span className="font-medium text-foreground num">{formatNumber(d.verified)}</span></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Referral clicks</span><span className="font-medium text-foreground num">{formatNumber(d.clicks)}</span></div>
      <div className="flex justify-between gap-4 text-muted-foreground"><span>Conversion rate</span><span className="font-medium text-foreground num">{formatPercent(d.conv)}</span></div>
    </div>
  );
}

type Pending = { type: AdvocateType; id: string; name: string; sub: string; city: string; hue: number; joinedAt: string };

export default function AdminDashboard() {
  const range = useUIStore((s) => s.dateRange);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const customers = useDataStore((s) => s.customers);
  const campaigns = useDataStore((s) => s.campaigns);
  const referrals = useDataStore((s) => s.referrals);
  const rewards = useDataStore((s) => s.rewards);
  const flags = useDataStore((s) => s.flags);
  const audit = useDataStore((s) => s.audit);
  const { advocate, advocateName, campaignById, brandById, shopById, mechById } = useLookups();
  const [rewardView, setRewardView] = useState<"campaign" | "type">("campaign");

  const data = useMemo(() => {
    const prevR = previousRange(range);
    const cur = funnel(refsInRange(referrals, range));
    const prev = funnel(refsInRange(referrals, prevR));
    const activeMechIds = (r: typeof range) => {
      const ids = new Set(refsInRange(referrals, r).filter((x) => x.advocateType === "mechanic").map((x) => x.advocateId));
      return mechanics.filter((m) => m.status === "verified" && ids.has(m.id)).length;
    };
    const activeShopIds = (r: typeof range) => {
      const ids = new Set(refsInRange(referrals, r).filter((x) => x.advocateType === "shop").map((x) => x.advocateId));
      return shops.filter((s) => s.status === "verified" && ids.has(s.id)).length;
    };
    const spend = spendOf(rewards, undefined, range);
    const prevSpend = spendOf(rewards, undefined, prevR);
    const joinedInRange = [...shops, ...mechanics, ...customers].filter((x) => inRange(x.joinedAt, range)).length;
    const series = timeSeries(referrals, rewards, range);

    const verifiedShops = shops.filter((s) => s.status === "verified").length;
    const verifiedMechs = mechanics.filter((m) => m.status === "verified").length;
    const inR = refsInRange(referrals, range);
    const fShop = funnel(inR.filter((r) => r.advocateType === "shop"));
    const fMech = funnel(inR.filter((r) => r.advocateType === "mechanic"));
    const participation = [
      { label: "Verified advocates", shops: verifiedShops, mechanics: verifiedMechs },
      { label: "Active in period", shops: activeShopIds(range), mechanics: activeMechIds(range) },
      { label: "Verified conversions", shops: fShop.verified, mechanics: fMech.verified },
    ];

    const camp = campaigns.map((c) => ({ c, s: campaignStats(c, referrals, rewards, campaignParticipants(c, shops, mechanics), range) }));
    const campChart = camp.filter((x) => x.s.clicks > 0 || x.c.status === "active").sort((a, b) => b.s.verified - a.s.verified)
      .map((x) => ({ name: x.c.name, verified: x.s.verified, conv: x.s.conversionRate, clicks: x.s.clicks }));
    const topCampaigns = [...camp].filter((x) => x.s.clicks > 0).sort((a, b) => b.s.revenue - a.s.revenue).slice(0, 5);

    // reward distribution
    const byCamp = camp.map((x, i) => ({ key: x.c.id, label: x.c.name, value: x.s.spend, color: SERIES[i % SERIES.length]! })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    const rewardByCampaign: DonutSlice[] = byCamp.slice(0, 5).map((x, i) => ({ ...x, color: SERIES[i]! }));
    const other = byCamp.slice(5).reduce((s, x) => s + x.value, 0);
    if (other > 0) rewardByCampaign.push({ key: "other", label: "Other campaigns", value: other, color: C.muted });
    const rewardByType: DonutSlice[] = [
      { key: "shop-c", label: "Shop commissions", value: spendOf(rewards, (t) => t.advocateType === "shop" && t.type === "commission", range), color: C.c1 },
      { key: "mech-c", label: "Mechanic commissions", value: spendOf(rewards, (t) => t.advocateType === "mechanic" && t.type === "commission", range), color: C.c3 },
      { key: "bonus", label: "Performance bonuses", value: spendOf(rewards, (t) => t.type === "bonus", range), color: C.c5 },
    ];

    // geography: verified conversions by advocate state
    const geo = new Map<string, { shop: number; mechanic: number }>();
    for (const r of inR) {
      if (r.status !== "verified") continue;
      const st = r.advocateType === "shop" ? shopById.get(r.advocateId)?.state : mechById.get(r.advocateId)?.state;
      if (!st) continue;
      const g = geo.get(st) ?? { shop: 0, mechanic: 0 };
      g[r.advocateType]++;
      geo.set(st, g);
    }
    const geoItems = Array.from(geo.entries()).map(([state, g]) => ({
      id: state, label: state, value: g.shop + g.mechanic, sub: `${g.shop} shop · ${g.mechanic} mech.`,
      segments: [{ label: "Shops", value: g.shop, color: C.c1 }, { label: "Mechanics", value: g.mechanic, color: C.c3 }],
    })).sort((a, b) => b.value - a.value);

    return {
      cur, prev, spend, prevSpend, joinedInRange, series, participation, campChart, topCampaigns, rewardByCampaign, rewardByType, geoItems,
      activeMech: activeMechIds(range), prevActiveMech: activeMechIds(prevR), verifiedShops,
    };
  }, [range, referrals, rewards, campaigns, shops, mechanics, customers, shopById, mechById]);

  const totalUsers = shops.length + mechanics.length + customers.length + STAFF_ACCOUNTS;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const scheduledCampaigns = campaigns.filter((c) => c.status === "scheduled").length;
  const pendingShops: Pending[] = shops.filter((s) => s.status === "pending").map((s) => ({ type: "shop", id: s.id, name: s.name, sub: `${s.owner} · ${s.category}`, city: `${s.city}, ${s.state}`, hue: s.hue, joinedAt: s.joinedAt }));
  const pendingMechs: Pending[] = mechanics.filter((m) => m.status === "pending").map((m) => ({ type: "mechanic", id: m.id, name: m.name, sub: `${m.workshop} · ${m.specialization}`, city: `${m.city}, ${m.state}`, hue: m.hue, joinedAt: m.joinedAt }));
  const openFlags = useMemo(() => flags.filter((f) => f.status === "new" || f.status === "under_review").sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)), [flags]);
  const feed = useMemo(() => [...audit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8), [audit]);

  /* -------- approvals -------- */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const approve = async (p: Pending) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      await api.advocates.setStatus(p.type, p.id, "verified");
      toast.success(`${p.name} approved`, { description: `Now a verified ${p.type} advocate.` });
    } finally { setBusyId(null); }
  };

  /* -------- export -------- */
  const exportReport = () => {
    const rows = campaigns.map((c) => {
      const s = campaignStats(c, referrals, rewards, campaignParticipants(c, shops, mechanics), range);
      return {
        campaign_id: c.id, campaign: c.name, brand: brandById.get(c.brandId)?.name ?? c.brandId, status: c.status,
        participants: s.advocates, active_advocates: s.activeAdvocates, referral_clicks: s.clicks, qualified_leads: s.leads,
        pending_verification: s.pending, verified_conversions: s.verified, conversion_rate_pct: s.conversionRate.toFixed(2),
        attributed_revenue_inr: Math.round(s.revenue), rewards_issued_inr: Math.round(s.spend), roas: s.roas.toFixed(2), budget_inr: c.budget,
        budget_utilisation_pct: s.budgetUtil.toFixed(1),
      };
    });
    downloadCSV(`advocatex-platform-report-${range.from}-to-${range.to}.csv`, rows);
    toast.success("Platform report exported", { description: `${rows.length} campaigns · ${rangeLabel(range)}` });
  };

  /* -------- platform activity table -------- */
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AdvocateType>("all");
  const tableRows = useMemo(() => refsInRange(referrals, range)
    .filter((r) => (statusFilter === "all" || r.status === statusFilter) && (typeFilter === "all" || r.advocateType === typeFilter)),
  [referrals, range, statusFilter, typeFilter]);
  const t = useTableState<Referral>(tableRows, {
    search: (r, q) => r.id.toLowerCase().includes(q) || r.customerRef.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      || advocateName(r.advocateId).toLowerCase().includes(q) || (campaignById.get(r.campaignId)?.name.toLowerCase().includes(q) ?? false),
    sorters: { date: (r) => r.createdAt, advocate: (r) => advocateName(r.advocateId), status: (r) => r.status, value: (r) => r.purchaseValue, reward: (r) => (r.status === "verified" || r.status === "pending" ? r.reward : 0) },
    initialSort: { key: "date", dir: "desc" },
    pageSize: 8,
  });
  const filtersActive = statusFilter !== "all" || typeFilter !== "all" || t.query !== "";
  const clearFilters = () => { setStatusFilter("all"); setTypeFilter("all"); t.setQuery(""); };

  const [params, setParams] = useSearchParams();
  const [openRef, setOpenRef] = useState<Referral | null>(null);
  useEffect(() => {
    const id = params.get("open");
    if (id) { const r = referrals.find((x) => x.id === id); if (r) setOpenRef(r); }
  }, [params, referrals]);
  const closeSheet = (o: boolean) => {
    if (o) return;
    setOpenRef(null);
    if (params.has("open")) { params.delete("open"); setParams(params, { replace: true }); }
  };
  // keep the drawer in sync with store mutations
  const liveOpen = openRef ? referrals.find((r) => r.id === openRef.id) ?? openRef : null;

  const { cur, prev } = data;
  const approvalList = (list: Pending[], label: string, Icon: typeof Store) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}</h3>
        <Badge variant={list.length ? "warning" : "muted"}>{list.length} pending</Badge>
      </div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">All caught up — no applications waiting.</div>
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 4).map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
              <EntityAvatar name={p.name} hue={p.hue} type={p.type} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{p.city} · applied {timeAgo(p.joinedAt)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon-sm" variant="outline" aria-label={`Reject ${p.name}`} disabled={busyId === p.id} onClick={() => { setRejectReason(""); setRejecting(p); }}><X className="text-destructive" /></Button>
                <Button size="icon-sm" variant="positive" aria-label={`Approve ${p.name}`} disabled={!!busyId} onClick={() => approve(p)}>
                  {busyId === p.id ? <Loader2 className="animate-spin" /> : <Check />}
                </Button>
              </div>
            </li>
          ))}
          {list.length > 4 && <li className="text-center text-xs text-muted-foreground">+{list.length - 4} more in the approval queue</li>}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description={`Network health, programme performance and items needing your attention · ${rangeLabel(range)}`}
        actions={<>
          <Button variant="outline" onClick={exportReport}><Download />Export report</Button>
          <Button asChild><Link to="/app/approvals"><ClipboardCheck />Review approvals{pendingShops.length + pendingMechs.length > 0 && <Badge variant="secondary" className="ml-0.5 bg-white/20 text-white">{pendingShops.length + pendingMechs.length}</Badge>}</Link></Button>
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total users" value={formatNumber(totalUsers)} icon={Users} tone="brand"
          hint={`${shops.length} shops + ${mechanics.length} mechanics + ${customers.length} loyalty customers + ${STAFF_ACCOUNTS} internal accounts (1 super admin, 4 brand managers). Includes pending and rejected applicants.`}
          sub={<span>+{data.joinedInRange} joined in period</span>} />
        <KpiCard label="Verified shops" value={formatNumber(data.verifiedShops)} icon={Store} tone="action" hint="Retail shops that passed verification and can earn rewards."
          sub={<span>{pendingShops.length} awaiting approval</span>} />
        <KpiCard label="Active mechanics" value={formatNumber(data.activeMech)} icon={Wrench} tone="positive" delta={delta(data.activeMech, data.prevActiveMech)}
          hint="Verified mechanics with at least one referral click in the selected period." />
        <KpiCard label="Active campaigns" value={formatNumber(activeCampaigns)} icon={Megaphone} tone="ai" hint="Campaigns currently live across all brands."
          sub={<span>{scheduledCampaigns} scheduled</span>} />
        <KpiCard label="Total referrals" value={formatNumber(cur.clicks)} icon={MousePointerClick} tone="action" delta={delta(cur.clicks, prev.clicks)}
          hint="Referral link / QR visits (clicks) recorded in the period. A click is not a sale." />
        <KpiCard label="Verified conversions" value={formatNumber(cur.verified)} icon={CheckCircle2} tone="positive" delta={delta(cur.verified, prev.verified)}
          hint="Referrals from this period's clicks whose purchase was verified against an invoice." sub={<span>{formatPercent(cur.conversionRate)} conv.</span>} />
        <KpiCard label="Attributed revenue" value={formatCurrency(cur.revenue)} icon={IndianRupee} tone="brand" delta={delta(cur.revenue, prev.revenue)}
          hint="Sum of verified purchase values attributed to advocate referrals. This is revenue, not profit." />
        <KpiCard label="Rewards issued" value={formatCurrency(data.spend)} icon={Coins} tone="warning" delta={delta(data.spend, data.prevSpend)}
          hint="Advocate commissions and bonuses accrued in the period (pending + approved, excluding reversals). Simulated — no money moved." />
      </div>

      {/* growth + users */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Referral growth" description={`Clicks, qualified leads and verified conversions across the network · ${rangeLabel(range)}`}
          action={<Legend items={[{ label: "Clicks", color: C.c2 }, { label: "Leads", color: C.c4 }, { label: "Verified", color: C.c3 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="aClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity={0.22} /><stop offset="100%" stopColor={C.c2} stopOpacity={0} /></linearGradient>
                  <linearGradient id="aVer" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c3} stopOpacity={0.3} /><stop offset="100%" stopColor={C.c3} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke={C.c2} strokeWidth={2} fill="url(#aClicks)" />
                <Area type="monotone" dataKey="leads" name="Leads" stroke={C.c4} strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="verified" name="Verified" stroke={C.c3} strokeWidth={2} fill="url(#aVer)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Users by role" description="All registered accounts on the platform">
          <Donut centerLabel="users" data={[
            { key: "cust", label: "Customers", value: customers.length, color: C.c4 },
            { key: "mech", label: "Mechanics", value: mechanics.length, color: C.c3 },
            { key: "shop", label: "Shops", value: shops.length, color: C.c1 },
            { key: "staff", label: "Staff & brand", value: STAFF_ACCOUNTS, color: C.c5 },
          ]} />
        </ChartCard>
      </div>

      {/* approvals + fraud */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Pending approvals</CardTitle><CardDescription className="mt-1">New advocates waiting for verification — approve to let them start earning</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/approvals">Open approval queue</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {approvalList(pendingShops, "Shops", Store)}
            {approvalList(pendingMechs, "Mechanics", Wrench)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />Flagged activity</CardTitle><CardDescription className="mt-1">Open fraud signals, newest first</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/fraud">Fraud monitor</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openFlags.length === 0 && <EmptyState icon={BadgeCheck} title="No open flags" description="Nothing suspicious needs review right now." className="py-6" />}
            {openFlags.slice(0, 4).map((f) => (
              <Link key={f.id} to={`/app/fraud?open=${f.id}`} className="block rounded-lg border p-3 transition-colors hover:border-destructive/30 hover:bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{advocateName(f.advocateId)}</span>
                  <StatusBadge status={f.severity} context="severity" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.reason}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{f.id}</span><span>·</span><span>{FLAG_TYPE_LABEL[f.type]}</span><span>·</span><span>{timeAgo(f.detectedAt)}</span>
                  <StatusBadge status={f.status} context="flag" className="ml-auto" />
                </div>
              </Link>
            ))}
            {openFlags.length > 4 && <p className="pt-1 text-center text-xs text-muted-foreground">+{openFlags.length - 4} more open flags</p>}
          </CardContent>
        </Card>
      </div>

      {/* campaign performance + participation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Campaign performance" description={`Verified conversions per campaign; conversion rate shown on the right · ${rangeLabel(range)}`}>
          {data.campChart.length === 0 ? <EmptyState title="No campaign activity in this period" className="py-10" /> : (
            <div style={{ height: Math.max(180, data.campChart.length * 38) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.campChart} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} interval={0} />
                  <Tooltip content={<CampaignTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                  <Bar dataKey="verified" name="Verified" fill={C.c1} radius={[0, 4, 4, 0]} maxBarSize={20}>
                    <LabelList dataKey="conv" position="right" formatter={(v: number) => formatPercent(v)} style={{ fontSize: 11, fill: C.muted }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Shop vs mechanic participation" description={`Verified advocates, how many were active, and what they converted · ${rangeLabel(range)}`}
          action={<Legend items={[{ label: "Shops", color: C.c1 }, { label: "Mechanics", color: C.c3 }]} />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.participation} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} barGap={3}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="shops" name="Shops" fill={C.c1} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="mechanics" name="Mechanics" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* rewards + geography + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Reward distribution" description={`Where advocate rewards went · ${rangeLabel(range)}`}
          action={<Tabs value={rewardView} onValueChange={(v) => setRewardView(v as "campaign" | "type")}><TabsList className="h-8"><TabsTrigger value="campaign" className="text-xs">Campaign</TabsTrigger><TabsTrigger value="type" className="text-xs">Type</TabsTrigger></TabsList></Tabs>}>
          <Donut className="sm:grid-cols-1" centerLabel="issued" format={(v) => formatCurrency(v, { compact: true })}
            data={rewardView === "campaign" ? data.rewardByCampaign : data.rewardByType} />
        </ChartCard>

        <ChartCard title="Geographic distribution" description="States ranked by verified conversions (advocate location)"
          action={<Legend items={[{ label: "Shops", color: C.c1 }, { label: "Mechanics", color: C.c3 }]} />}>
          <RankedBarList items={data.geoItems} limit={8} />
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Latest platform activity</CardTitle><CardDescription className="mt-1">From the audit log</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/audit">Audit log</Link></Button>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3.5">
              {feed.map((e) => {
                const m = AUDIT_ICON[e.category];
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.cls)}><m.icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-snug"><span className="font-medium">{e.actor}</span> <span className="text-muted-foreground">{e.action.toLowerCase()}</span></div>
                      <div className="truncate text-xs text-muted-foreground" title={e.target}>{e.target}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(e.at)}</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* top campaigns + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle>Top-performing campaigns</CardTitle><CardDescription className="mt-1">Ranked by attributed revenue · {rangeLabel(range)}</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/campaigns">All campaigns</Link></Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Campaign</TableHead><TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="text-right">Verified</TableHead><TableHead className="hidden text-right sm:table-cell">Conv.</TableHead>
              <TableHead className="text-right">Revenue</TableHead><TableHead className="hidden text-right md:table-cell">ROAS</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.topCampaigns.map(({ c, s }) => (
                <TableRow key={c.id}>
                  <TableCell><Link to={`/app/campaigns/${c.id}`} className="font-medium hover:text-action hover:underline">{c.name}</Link><div className="text-[11px] text-muted-foreground">{brandById.get(c.brandId)?.name}</div></TableCell>
                  <TableCell className="hidden md:table-cell"><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right num">{formatNumber(s.verified)}</TableCell>
                  <TableCell className="hidden text-right num sm:table-cell">{formatPercent(s.conversionRate)}</TableCell>
                  <TableCell className="text-right font-medium num">{formatCurrency(s.revenue)}</TableCell>
                  <TableCell className="hidden text-right num md:table-cell">{formatRatio(s.roas)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.topCampaigns.length === 0 && <EmptyState title="No campaign activity in this period" description="Try a wider date range." />}
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common admin tasks</CardDescription></CardHeader>
          <CardContent>
            <QuickActions className="sm:grid-cols-1" actions={[
              { label: "Review approvals", description: `${pendingShops.length + pendingMechs.length} advocates waiting`, icon: ClipboardCheck, tone: "warning", to: "/app/approvals" },
              { label: "Fraud monitor", description: `${openFlags.length} open flags`, icon: ShieldAlert, tone: "destructive", to: "/app/fraud" },
              { label: "Create campaign", description: "Launch a new advocacy campaign", icon: Plus, tone: "action", to: "/app/campaigns/new" },
              { label: "Export platform report", description: `Per-campaign CSV · ${rangeLabel(range)}`, icon: Download, tone: "positive", onClick: exportReport },
            ]} />
          </CardContent>
        </Card>
      </div>

      {/* platform activity table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Platform activity</CardTitle><CardDescription className="mt-1">Every referral started in the period · click a row for the full lifecycle</CardDescription></div>
          <Button variant="ghost" size="sm" asChild><Link to="/app/referrals">Referrals</Link></Button>
        </CardHeader>
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search ID, advocate, campaign…" />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as "all" | ReferralStatus); t.resetPage(); }}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as "all" | AdvocateType); t.resetPage(); }}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by advocate type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All advocates</SelectItem><SelectItem value="shop">Shops</SelectItem><SelectItem value="mechanic">Mechanics</SelectItem></SelectContent>
          </Select>
          {filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
          <span className="text-xs text-muted-foreground sm:ml-auto num">{formatNumber(t.total)} referrals</span>
        </FilterBar>
        {t.total === 0 ? (
          <EmptyState title="No referrals match" description="Adjust the search or filters, or widen the date range." action={filtersActive ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
        ) : (
          <>
            <Table>
              <TableHeader><TableRow>
                <SortableHead label="Referral" sortKey="date" sort={t.sort} onSort={t.toggleSort} />
                <SortableHead label="Advocate" sortKey="advocate" sort={t.sort} onSort={t.toggleSort} />
                <TableHead className="hidden lg:table-cell">Campaign</TableHead>
                <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                <SortableHead label="Purchase" sortKey="value" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />
                <SortableHead label="Reward" sortKey="reward" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden md:table-cell" />
              </TableRow></TableHeader>
              <TableBody>
                {t.pageRows.map((r) => {
                  const a = advocate(r.advocateId);
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenRef(r)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenRef(r); } }} aria-label={`Open referral ${r.id}`}>
                      <TableCell><span className="font-mono text-xs font-medium text-action">{r.id}</span><div className="text-[11px] text-muted-foreground">{formatDate(r.createdAt, { day: "numeric", month: "short" })} · {r.channel}</div></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {a && <EntityAvatar name={a.name} hue={a.hue} size="sm" />}
                          <div className="min-w-0"><div className="max-w-[180px] truncate text-[13px] font-medium">{a?.name ?? r.advocateId}</div><div className="text-[11px] capitalize text-muted-foreground">{r.advocateType}</div></div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-[13px] lg:table-cell">{campaignById.get(r.campaignId)?.name}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="hidden text-right num sm:table-cell">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</TableCell>
                      <TableCell className="hidden text-right font-medium num md:table-cell">{r.status === "verified" || r.status === "pending" ? formatCurrency(r.reward) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
          </>
        )}
      </Card>

      <ReferralDetailSheet referral={liveOpen} onOpenChange={closeSheet} />

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${rejecting?.name ?? "application"}?`}
        description={<>The {rejecting?.type} will not be able to join campaigns or earn rewards. This is recorded in the audit log.</>}
        confirmLabel="Reject application"
        variant="destructive"
        onConfirm={async () => {
          if (!rejecting) return;
          await api.advocates.setStatus(rejecting.type, rejecting.id, "rejected", rejectReason.trim() || undefined);
          toast.success(`${rejecting.name} rejected`, { description: rejectReason.trim() || "No reason provided." });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="reject-reason">Reason (optional)</Label>
          <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. GSTIN could not be verified" />
        </div>
      </ConfirmDialog>
    </div>
  );
}
