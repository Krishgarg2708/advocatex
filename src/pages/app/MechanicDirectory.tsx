import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, CalendarClock, Clock, Download, MapPin, Percent, Users, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { TierBadge } from "@/components/shared/TierBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { AdvocateDetailSheet, ApproveAdvocateButton, RejectAdvocateDialog } from "@/components/shared/AdvocateDetailSheet";
import { FilterSelect, SortControl, ViewToggle, type ViewMode } from "@/pages/app/components/DirectoryKit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useDataStore } from "@/store/data";
import { ADVOCATE_TIER_STEPS, advocateTier, funnel } from "@/lib/metrics";
import { formatNumber, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import type { AdvocateTier, Mechanic } from "@/types";

interface MechRow { m: Mechanic; clicks: number; verified: number; conversionRate: number; tier: AdvocateTier; lifetimeVerified: number }
const TIER_ORDER: Record<AdvocateTier, number> = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 };

export default function MechanicDirectory() {
  const { role, can, shop } = useCurrentUser();
  const scope = useScope();
  const mechanics = useDataStore((s) => s.mechanics);
  const allReferrals = useDataStore((s) => s.referrals);
  const [params, setParams] = useSearchParams();
  const isShop = role === "shop";
  const canApprove = can("approveAdvocates");

  const [view, setView] = useState<ViewMode>("table");
  const [status, setStatus] = useState("all");
  const [spec, setSpec] = useState("all");
  const [state, setState] = useState("all");
  const [tier, setTier] = useState("all");
  const [networkOnly, setNetworkOnly] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Mechanic | null>(null);

  useEffect(() => { const id = params.get("open"); if (id) setOpenId(id); }, [params]);
  const closeSheet = (o: boolean) => {
    if (o) return;
    setOpenId(null);
    if (params.get("open")) { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); }
  };

  const rows = useMemo<MechRow[]>(() => {
    const refs = role === "brand" ? scope.referrals : allReferrals;
    const by = new Map<string, typeof refs>();
    const lifetime = new Map<string, number>();
    for (const r of refs) if (r.advocateType === "mechanic") by.set(r.advocateId, [...(by.get(r.advocateId) ?? []), r]);
    for (const r of allReferrals) if (r.advocateType === "mechanic" && r.status === "verified") lifetime.set(r.advocateId, (lifetime.get(r.advocateId) ?? 0) + 1);
    let list = mechanics;
    if (isShop) {
      // the shop's network: verified mechanics in the same state, or sharing at least one campaign
      list = mechanics.filter((m) => m.status === "verified");
    }
    return list.map((m) => {
      const f = funnel(by.get(m.id) ?? []);
      const lv = lifetime.get(m.id) ?? 0;
      return { m, clicks: f.clicks, verified: f.verified, conversionRate: f.conversionRate, tier: advocateTier(lv), lifetimeVerified: lv };
    });
  }, [mechanics, allReferrals, scope.referrals, role, isShop]);

  const inNetwork = (m: Mechanic) => !!shop && (m.state === shop.state || m.campaignIds.some((c) => shop.campaignIds.includes(c)));
  const specs = useMemo(() => Array.from(new Set(rows.map((r) => r.m.specialization))).sort(), [rows]);
  const states = useMemo(() => Array.from(new Set(rows.map((r) => r.m.state))).sort(), [rows]);

  const filteredRows = useMemo(() => rows.filter((r) =>
    (status === "all" || r.m.status === status) && (spec === "all" || r.m.specialization === spec) && (state === "all" || r.m.state === state) &&
    (tier === "all" || (r.m.status === "verified" && r.tier === tier)) && (!isShop || !networkOnly || inNetwork(r.m))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [rows, status, spec, state, tier, isShop, networkOnly, shop]);

  const t = useTableState(filteredRows, {
    search: (r, q) => [r.m.name, r.m.workshop, r.m.city, r.m.state, r.m.specialization, r.m.referralCode].some((x) => x.toLowerCase().includes(q)),
    sorters: {
      name: (r) => r.m.name, workshop: (r) => r.m.workshop, spec: (r) => r.m.specialization, exp: (r) => r.m.experienceYears, location: (r) => r.m.city,
      status: (r) => r.m.status, clicks: (r) => r.clicks, conv: (r) => r.conversionRate, tier: (r) => (r.m.status === "verified" ? TIER_ORDER[r.tier] * 1000 + r.lifetimeVerified : -1),
    },
    initialSort: { key: "tier", dir: "desc" },
    pageSize: view === "grid" ? 12 : 10,
  });

  const anyFilter = status !== "all" || spec !== "all" || state !== "all" || tier !== "all" || !!t.query;
  const clearFilters = () => { setStatus("all"); setSpec("all"); setState("all"); setTier("all"); t.setQuery(""); };

  const kpi = useMemo(() => {
    const ver = rows.filter((r) => r.m.status === "verified");
    const clicks = ver.reduce((s, r) => s + r.clicks, 0), verified = ver.reduce((s, r) => s + r.verified, 0);
    return { verified: ver.length, pending: rows.filter((r) => r.m.status === "pending").length, conv: clicks ? (verified / clicks) * 100 : 0, gold: ver.filter((r) => r.tier === "Gold" || r.tier === "Platinum").length, avgExp: ver.length ? ver.reduce((s, r) => s + r.m.experienceYears, 0) / ver.length : 0 };
  }, [rows]);

  const exportCsv = () => {
    downloadCSV("mechanic-directory.csv", t.filtered.map((r) => ({
      Name: r.m.name, Workshop: r.m.workshop, Specialization: r.m.specialization, "Experience (yrs)": r.m.experienceYears, City: r.m.city, State: r.m.state,
      Status: r.m.status, Referrals: r.clicks, Verified: r.verified, "Conversion rate %": r.conversionRate.toFixed(1), Tier: r.m.status === "verified" ? r.tier : "",
    })));
    toast.success(`Exported ${t.filtered.length} mechanics`);
  };

  const actions = (r: MechRow) => canApprove && r.m.status === "pending" ? (
    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="outline" onClick={() => setRejecting(r.m)} aria-label={`Reject ${r.m.name}`}><XCircle />Reject</Button>
      <ApproveAdvocateButton type="mechanic" id={r.m.id} name={r.m.name} />
    </div>
  ) : null;

  const tierCell = (r: MechRow) => r.m.status === "verified" ? <TierBadge tier={r.tier} /> : <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isShop ? "Mechanics in your network" : "Mechanic directory"}
        description={isShop
          ? `Verified mechanic advocates near ${shop?.city ?? "you"} or enrolled in the same campaigns as your shop. Read-only — useful for coordinating fitment and referrals.`
          : role === "brand" ? "Mechanic advocates in the network. Referral figures cover your brand's campaigns only." : "Every mechanic advocate — specialization, verification, referral performance and advocate tier."}
        actions={!isShop ? <Button variant="outline" onClick={exportCsv} disabled={t.total === 0}><Download />Export CSV</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Verified mechanics" value={formatNumber(kpi.verified)} icon={BadgeCheck} tone="positive" hint="Mechanics approved to share referral links and QR codes." />
        {isShop
          ? <KpiCard label="Avg. experience" value={`${kpi.avgExp.toFixed(1)} yrs`} icon={CalendarClock} tone="brand" hint="Average years of experience across verified mechanics." />
          : <KpiCard label="Pending approval" value={formatNumber(kpi.pending)} icon={Clock} tone="warning" hint="Applications awaiting admin verification." />}
        <KpiCard label="Network conversion rate" value={formatPercent(kpi.conv)} icon={Percent} tone="action" hint="Verified conversions ÷ referral clicks × 100, across verified mechanics (lifetime)." />
        <KpiCard label="Gold & Platinum" value={formatNumber(kpi.gold)} icon={Users} tone="ai" hint={`Advocate tier is based on lifetime verified conversions: ${ADVOCATE_TIER_STEPS.map((s) => `${s.tier} ${s.min}+`).join(", ")}.`} />
      </div>

      <Card>
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search name, workshop, city…" />
          {!isShop && <FilterSelect label="Verification status" value={status} onChange={(v) => { setStatus(v); t.resetPage(); }} allLabel="All statuses" options={[{ value: "verified", label: "Verified" }, { value: "pending", label: "Pending approval" }, { value: "rejected", label: "Rejected" }]} />}
          <FilterSelect label="Specialization" value={spec} onChange={(v) => { setSpec(v); t.resetPage(); }} allLabel="All specializations" options={specs.map((s) => ({ value: s, label: s }))} className="sm:w-48" />
          <FilterSelect label="State" value={state} onChange={(v) => { setState(v); t.resetPage(); }} allLabel="All states" options={states.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Advocate tier" value={tier} onChange={(v) => { setTier(v); t.resetPage(); }} allLabel="All tiers" options={ADVOCATE_TIER_STEPS.map((s) => ({ value: s.tier, label: s.tier }))} className="sm:w-32" />
          {isShop && (
            <FilterSelect label="Network scope" value={networkOnly ? "all" : "everyone"} onChange={(v) => { setNetworkOnly(v === "all"); t.resetPage(); }} allLabel="My network" options={[{ value: "everyone", label: "All verified mechanics" }]} className="sm:w-48" />
          )}
          <div className="flex items-center gap-2 sm:ml-auto">
            {view === "grid" && <SortControl sort={t.sort} onSort={t.toggleSort} options={[{ key: "tier", label: "Tier" }, { key: "conv", label: "Conversion" }, { key: "clicks", label: "Referrals" }, { key: "exp", label: "Experience" }, { key: "name", label: "Name" }]} />}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </FilterBar>

        {t.total === 0 ? (
          <EmptyState icon={Wrench} title={anyFilter ? "No mechanics match these filters" : isShop ? "No mechanics in your network yet" : "No mechanics yet"}
            description={anyFilter ? "Try another specialization or state, or clear the filters." : isShop ? "Switch the scope to 'All verified mechanics' to browse the full network." : "Mechanics appear here once they register as advocates."}
            action={anyFilter ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
        ) : view === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mechanic" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                <SortableHead label="Specialization" sortKey="spec" sort={t.sort} onSort={t.toggleSort} className="hidden lg:table-cell" />
                <SortableHead label="Experience" sortKey="exp" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden xl:table-cell" />
                <SortableHead label="Location" sortKey="location" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                {!isShop && <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />}
                <SortableHead label="Referrals" sortKey="clicks" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />
                <SortableHead label="Conv. rate" sortKey="conv" sort={t.sort} onSort={t.toggleSort} align="right" />
                <SortableHead label="Tier" sortKey="tier" sort={t.sort} onSort={t.toggleSort} />
                {canApprove && <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.pageRows.map((r) => (
                <TableRow key={r.m.id} className="cursor-pointer" onClick={() => setOpenId(r.m.id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EntityAvatar name={r.m.name} hue={r.m.hue} type="mechanic" />
                      <div className="min-w-0">
                        <button type="button" className="truncate text-left font-medium hover:text-action" onClick={(e) => { e.stopPropagation(); setOpenId(r.m.id); }}>{r.m.name}</button>
                        <div className="truncate text-xs text-muted-foreground">{r.m.workshop}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-[13px] lg:table-cell">{r.m.specialization}</TableCell>
                  <TableCell className="hidden text-right text-[13px] num xl:table-cell">{r.m.experienceYears} yrs</TableCell>
                  <TableCell className="hidden text-[13px] md:table-cell">{r.m.city}<div className="text-xs text-muted-foreground">{r.m.state}</div></TableCell>
                  {!isShop && <TableCell><StatusBadge status={r.m.status} context="verification" /></TableCell>}
                  <TableCell className="hidden text-right num sm:table-cell">{formatNumber(r.clicks)}</TableCell>
                  <TableCell className="text-right num"><span className="font-medium">{r.clicks ? formatPercent(r.conversionRate) : "—"}</span><div className="text-[11px] text-muted-foreground">{r.verified} verified</div></TableCell>
                  <TableCell>{tierCell(r)}</TableCell>
                  {canApprove && <TableCell className="text-right">{actions(r)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <CardContent className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {t.pageRows.map((r) => (
              <div key={r.m.id} role="button" tabIndex={0} onClick={() => setOpenId(r.m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(r.m.id); } }}
                className="group flex flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:border-action/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-start gap-3">
                  <EntityAvatar name={r.m.name} hue={r.m.hue} size="lg" type="mechanic" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium group-hover:text-action">{r.m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.m.workshop}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.m.city}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{r.m.experienceYears} yrs</span>
                    </div>
                  </div>
                  {r.m.status === "verified" ? <TierBadge tier={r.tier} /> : <StatusBadge status={r.m.status} context="verification" />}
                </div>
                <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs"><Wrench className="h-3 w-3 text-muted-foreground" />{r.m.specialization}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Referrals</div><div className="text-sm font-semibold num">{formatNumber(r.clicks)}</div></div>
                  <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Verified</div><div className="text-sm font-semibold num">{formatNumber(r.verified)}</div></div>
                  <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Conv.</div><div className="text-sm font-semibold num">{r.clicks ? formatPercent(r.conversionRate) : "—"}</div></div>
                </div>
                {actions(r) && <div className="mt-3 border-t pt-3">{actions(r)}</div>}
              </div>
            ))}
          </CardContent>
        )}
        <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
      </Card>

      {isShop && <DemoNotice>Contact details are demo data. Mechanic approvals are managed by the platform admin.</DemoNotice>}

      <AdvocateDetailSheet type="mechanic" id={openId} open={!!openId} onOpenChange={closeSheet} />
      {rejecting && <RejectAdvocateDialog type="mechanic" id={rejecting.id} name={rejecting.name} open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} />}
    </div>
  );
}
