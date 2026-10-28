import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, CheckCircle2, Clock, Download, Gift, Info, MapPin, MousePointerClick, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { AdvocateDetailSheet, ApproveAdvocateButton, RejectAdvocateDialog } from "@/components/shared/AdvocateDetailSheet";
import { CampaignsHint, FilterSelect, SortControl, ViewToggle, percentile, type ViewMode } from "@/pages/app/components/DirectoryKit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { funnel } from "@/lib/metrics";
import { formatNumber, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { Campaign, Shop } from "@/types";

interface ShopRow {
  shop: Shop; campaigns: Campaign[]; clicks: number; verified: number; conversionRate: number; score: number | null;
}

const SCORE_HINT = "Performance score (0–100) = 60% conversion-rate percentile + 40% verified-conversion volume percentile, ranked among all verified shops. Pending or rejected shops are not scored.";

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const tone = score >= 70 ? "bg-positive" : score >= 40 ? "bg-action" : "bg-warning";
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 text-right text-sm font-semibold num">{score}</span>
      <Progress value={score} className="h-1.5 w-14" indicatorClassName={tone} />
    </div>
  );
}

export default function ShopDirectory() {
  const { role, can } = useCurrentUser();
  const scope = useScope();
  const shops = useDataStore((s) => s.shops);
  const allReferrals = useDataStore((s) => s.referrals);
  const campaigns = useDataStore((s) => s.campaigns);
  const { brandById } = useLookups();
  const [params, setParams] = useSearchParams();
  const isCustomer = role === "customer";
  const canApprove = can("approveAdvocates");

  const [view, setView] = useState<ViewMode>(isCustomer ? "grid" : "table");
  const [status, setStatus] = useState("all");
  const [state, setState] = useState("all");
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Shop | null>(null);

  // deep link ?open=<id>
  useEffect(() => {
    const id = params.get("open");
    if (id) setOpenId(id);
  }, [params]);
  const closeSheet = (o: boolean) => {
    if (o) return;
    setOpenId(null);
    if (params.get("open")) { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); }
  };

  const visibleCampaigns = useMemo(() => {
    if (isCustomer) return campaigns.filter((c) => c.status === "active");
    if (role === "brand") return scope.campaigns;
    return campaigns;
  }, [isCustomer, role, campaigns, scope.campaigns]);
  const campaignById = useMemo(() => new Map(visibleCampaigns.map((c) => [c.id, c])), [visibleCampaigns]);

  const rows = useMemo<ShopRow[]>(() => {
    const refs = role === "brand" ? scope.referrals : allReferrals;
    const by = new Map<string, typeof refs>();
    for (const r of refs) if (r.advocateType === "shop") by.set(r.advocateId, [...(by.get(r.advocateId) ?? []), r]);
    const base = shops.filter((s) => !isCustomer || s.status === "verified").map((shop) => {
      const f = funnel(by.get(shop.id) ?? []);
      return { shop, campaigns: shop.campaignIds.map((id) => campaignById.get(id)).filter((c): c is Campaign => !!c), clicks: f.clicks, verified: f.verified, conversionRate: f.conversionRate, score: null as number | null };
    });
    const ver = base.filter((r) => r.shop.status === "verified");
    const crs = ver.map((r) => r.conversionRate), vols = ver.map((r) => r.verified);
    for (const r of ver) r.score = Math.round((0.6 * percentile(crs, r.conversionRate) + 0.4 * percentile(vols, r.verified)) * 100);
    return base;
  }, [shops, allReferrals, scope.referrals, role, isCustomer, campaignById]);

  const states = useMemo(() => Array.from(new Set(rows.map((r) => r.shop.state))).sort(), [rows]);
  const cities = useMemo(() => Array.from(new Set(rows.filter((r) => state === "all" || r.shop.state === state).map((r) => r.shop.city))).sort(), [rows, state]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.shop.category))).sort(), [rows]);

  const filteredRows = useMemo(() => rows.filter((r) =>
    (status === "all" || r.shop.status === status) && (state === "all" || r.shop.state === state) && (city === "all" || r.shop.city === city) &&
    (category === "all" || r.shop.category === category) && (campaign === "all" || r.shop.campaignIds.includes(campaign))
  ), [rows, status, state, city, category, campaign]);

  const t = useTableState(filteredRows, {
    search: (r, q) => [r.shop.name, r.shop.owner, r.shop.city, r.shop.state, r.shop.category, r.shop.referralCode].some((x) => x.toLowerCase().includes(q)),
    sorters: {
      name: (r) => r.shop.name, location: (r) => `${r.shop.city}`, status: (r) => r.shop.status, campaigns: (r) => r.campaigns.length,
      clicks: (r) => r.clicks, verified: (r) => r.verified, score: (r) => r.score ?? -1, joined: (r) => r.shop.joinedAt,
    },
    initialSort: isCustomer ? { key: "name", dir: "asc" } : { key: "score", dir: "desc" },
    pageSize: view === "grid" ? 12 : 10,
  });

  const anyFilter = status !== "all" || state !== "all" || city !== "all" || category !== "all" || campaign !== "all" || !!t.query;
  const clearFilters = () => { setStatus("all"); setState("all"); setCity("all"); setCategory("all"); setCampaign("all"); t.setQuery(""); };
  const counts = useMemo(() => ({
    verified: rows.filter((r) => r.shop.status === "verified").length,
    pending: rows.filter((r) => r.shop.status === "pending").length,
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    verifiedConv: rows.reduce((s, r) => s + r.verified, 0),
  }), [rows]);

  const exportCsv = () => {
    downloadCSV("shop-directory.csv", t.filtered.map((r) => ({
      Shop: r.shop.name, Owner: r.shop.owner, City: r.shop.city, State: r.shop.state, Category: r.shop.category, Status: r.shop.status,
      Campaigns: r.campaigns.map((c) => c.name).join("; "), Clicks: r.clicks, Verified: r.verified, "Conversion rate %": r.conversionRate.toFixed(1), "Performance score": r.score ?? "",
    })));
    toast.success(`Exported ${t.filtered.length} shops`);
  };

  const filters = (
    <FilterBar>
      <SearchInput value={t.query} onChange={t.setQuery} placeholder={isCustomer ? "Search shops or areas…" : "Search shop, owner, city…"} />
      {!isCustomer && <FilterSelect label="Verification status" value={status} onChange={(v) => { setStatus(v); t.resetPage(); }} allLabel="All statuses" options={[{ value: "verified", label: "Verified" }, { value: "pending", label: "Pending approval" }, { value: "rejected", label: "Rejected" }]} />}
      {!isCustomer && <FilterSelect label="State" value={state} onChange={(v) => { setState(v); setCity("all"); t.resetPage(); }} allLabel="All states" options={states.map((s) => ({ value: s, label: s }))} />}
      <FilterSelect label="City" value={city} onChange={(v) => { setCity(v); t.resetPage(); }} allLabel="All cities" options={cities.map((s) => ({ value: s, label: s }))} />
      <FilterSelect label="Category" value={category} onChange={(v) => { setCategory(v); t.resetPage(); }} allLabel="All categories" options={categories.map((s) => ({ value: s, label: s }))} className="sm:w-48" />
      <FilterSelect label="Campaign" value={campaign} onChange={(v) => { setCampaign(v); t.resetPage(); }} allLabel={isCustomer ? "All offers" : "All campaigns"} options={visibleCampaigns.map((c) => ({ value: c.id, label: c.name }))} className="sm:w-52" />
      <div className="flex items-center gap-2 sm:ml-auto">
        {view === "grid" && <SortControl sort={t.sort} onSort={t.toggleSort} options={isCustomer ? [{ key: "name", label: "Name" }, { key: "campaigns", label: "Offers" }] : [{ key: "score", label: "Performance" }, { key: "verified", label: "Verified" }, { key: "clicks", label: "Referrals" }, { key: "name", label: "Name" }, { key: "joined", label: "Joined" }]} />}
        <ViewToggle value={view} onChange={setView} />
      </div>
    </FilterBar>
  );

  const empty = (
    <EmptyState icon={Store} title={anyFilter ? "No shops match these filters" : "No shops yet"}
      description={anyFilter ? "Try a different city or campaign, or clear the filters to see every shop." : "Shops appear here once they register as advocates."}
      action={anyFilter ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined} />
  );

  const actions = (r: ShopRow) => canApprove && r.shop.status === "pending" ? (
    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="outline" onClick={() => setRejecting(r.shop)} aria-label={`Reject ${r.shop.name}`}><XCircle />Reject</Button>
      <ApproveAdvocateButton type="shop" id={r.shop.id} name={r.shop.name} />
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? "Find a participating shop" : "Shop directory"}
        description={isCustomer
          ? "Verified partner shops near you. Buy eligible products here to earn loyalty points and unlock campaign offers."
          : role === "brand" ? "Retail partners in the network. Referral figures cover your brand's campaigns only." : "Every shop advocate on the platform — verification status, campaign participation and referral performance."}
        actions={!isCustomer ? <Button variant="outline" onClick={exportCsv} disabled={t.total === 0}><Download />Export CSV</Button> : undefined}
      />

      {!isCustomer && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Verified shops" value={formatNumber(counts.verified)} icon={BadgeCheck} tone="positive" hint="Shops approved to share referral links and QR codes." />
          <KpiCard label="Pending approval" value={formatNumber(counts.pending)} icon={Clock} tone="warning" hint="Applications awaiting admin verification." />
          <KpiCard label="Referral clicks" value={formatNumber(counts.clicks)} icon={MousePointerClick} tone="action" hint={role === "brand" ? "Lifetime clicks on shop referral links in your brand's campaigns." : "Lifetime clicks on shop referral links."} />
          <KpiCard label="Verified conversions" value={formatNumber(counts.verifiedConv)} icon={CheckCircle2} tone="positive" hint="Purchases confirmed against an invoice. A click is never counted as a sale." />
        </div>
      )}

      <Card>
        {filters}
        {t.total === 0 ? empty : view === "table" ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Shop" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                  <SortableHead label="Location" sortKey="location" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                  {!isCustomer && <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />}
                  <SortableHead label={isCustomer ? "Offers" : "Campaigns"} sortKey="campaigns" sort={t.sort} onSort={t.toggleSort} className="hidden sm:table-cell" />
                  {!isCustomer && <SortableHead label="Referrals" sortKey="clicks" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden lg:table-cell" />}
                  {!isCustomer && <SortableHead label="Verified" sortKey="verified" sort={t.sort} onSort={t.toggleSort} align="right" />}
                  {!isCustomer && (
                    <TableHead className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => t.toggleSort("score")} className="hover:text-foreground">Performance</button>
                        <Hint content={SCORE_HINT}><button type="button" aria-label="How the performance score works" className="text-muted-foreground/70 hover:text-foreground"><Info className="h-3.5 w-3.5" /></button></Hint>
                      </span>
                    </TableHead>
                  )}
                  {canApprove && <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.pageRows.map((r) => (
                  <TableRow key={r.shop.id} className="cursor-pointer" onClick={() => setOpenId(r.shop.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <EntityAvatar name={r.shop.name} hue={r.shop.hue} type="shop" />
                        <div className="min-w-0">
                          <button type="button" className="truncate text-left font-medium hover:text-action" onClick={(e) => { e.stopPropagation(); setOpenId(r.shop.id); }}>{r.shop.name}</button>
                          <div className="truncate text-xs text-muted-foreground">{isCustomer ? r.shop.category : `${r.shop.owner} · ${r.shop.category}`}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-[13px] md:table-cell">{r.shop.city}<div className="text-xs text-muted-foreground">{r.shop.state}</div></TableCell>
                    {!isCustomer && <TableCell><StatusBadge status={r.shop.status} context="verification" /></TableCell>}
                    <TableCell className="hidden sm:table-cell"><CampaignsHint campaigns={r.campaigns} /></TableCell>
                    {!isCustomer && <TableCell className="hidden text-right num lg:table-cell">{formatNumber(r.clicks)}</TableCell>}
                    {!isCustomer && <TableCell className="text-right num"><span className="font-medium">{formatNumber(r.verified)}</span><div className="text-[11px] text-muted-foreground">{r.clicks ? formatPercent(r.conversionRate) : "—"}</div></TableCell>}
                    {!isCustomer && <TableCell className="hidden md:table-cell"><ScoreCell score={r.score} /></TableCell>}
                    {canApprove && <TableCell className="text-right">{actions(r)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
          </>
        ) : (
          <>
            <CardContent className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {t.pageRows.map((r) => (
                <div key={r.shop.id} role="button" tabIndex={0} onClick={() => setOpenId(r.shop.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(r.shop.id); } }}
                  className="group flex flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:border-action/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-start gap-3">
                    <EntityAvatar name={r.shop.name} hue={r.shop.hue} size="lg" type="shop" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium group-hover:text-action">{r.shop.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{isCustomer ? r.shop.category : r.shop.owner}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{r.shop.city}, {r.shop.state}</div>
                    </div>
                    {isCustomer ? <Badge variant="positive"><BadgeCheck />Verified</Badge> : <StatusBadge status={r.shop.status} context="verification" />}
                  </div>
                  {isCustomer ? (
                    <div className="mt-3 space-y-1.5">
                      {r.campaigns.slice(0, 2).map((c) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-md bg-brand-soft/60 px-2.5 py-1.5 text-xs">
                          <Gift className="h-3.5 w-3.5 shrink-0 text-brand" />
                          <span className="min-w-0 flex-1 truncate"><span className="font-medium">{c.name}</span> · {brandById.get(c.brandId)?.name}</span>
                          <span className="shrink-0 font-semibold text-brand num">+{c.customerBonusPoints} pts</span>
                        </div>
                      ))}
                      {r.campaigns.length === 0 && <div className="text-xs text-muted-foreground">Earn standard loyalty points on eligible products.</div>}
                      {r.campaigns.length > 2 && <div className="text-[11px] text-muted-foreground">+{r.campaigns.length - 2} more offers</div>}
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Referrals</div><div className="text-sm font-semibold num">{formatNumber(r.clicks)}</div></div>
                        <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Verified</div><div className="text-sm font-semibold num">{formatNumber(r.verified)}</div></div>
                        <div className="rounded-md bg-muted/60 p-2"><div className="text-[11px] text-muted-foreground">Score</div><div className="text-sm font-semibold num">{r.score ?? "—"}</div></div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">Campaigns <CampaignsHint campaigns={r.campaigns} /></span>
                        <span className={cn(r.score === null && "invisible")}>{r.clicks ? `${formatPercent(r.conversionRate)} conv.` : ""}</span>
                      </div>
                      {actions(r) && <div className="mt-3 border-t pt-3">{actions(r)}</div>}
                    </>
                  )}
                </div>
              ))}
            </CardContent>
            <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
          </>
        )}
        {!isCustomer && view === "grid" && t.total > 0 && (
          <div className="flex items-start gap-1.5 border-t px-4 py-3 text-xs text-muted-foreground"><Info className="mt-px h-3.5 w-3.5 shrink-0" />{SCORE_HINT}</div>
        )}
      </Card>

      <AdvocateDetailSheet type="shop" id={openId} open={!!openId} onOpenChange={closeSheet} />
      {rejecting && <RejectAdvocateDialog type="shop" id={rejecting.id} name={rejecting.name} open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} />}
    </div>
  );
}
