import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, Eye, Filter, Info, MousePointerClick, ShieldCheck, Link2, UserCheck, Wallet, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge, REFERRAL_STATUS_LABEL } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { ReferralsDetailSheet } from "./components/ReferralsDetailSheet";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { rangeFromPreset, useUIStore } from "@/store/ui";
import { funnel, rangeLabel, refsInRange } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import type { DateRange, Referral, ReferralStatus } from "@/types";

const STATUSES: ReferralStatus[] = ["clicked", "lead", "pending", "verified", "rejected"];
const ALL = "all";

export default function Referrals() {
  const { role, can, advocateId } = useCurrentUser();
  const { referrals, campaigns } = useScope();
  const { advocate, advocateName, campaignById } = useLookups();
  const globalRange = useUIStore((s) => s.dateRange);
  const [range, setRange] = useState<DateRange>(globalRange);
  useEffect(() => setRange(globalRange), [globalRange]);
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  useEffect(() => { const o = params.get("open"); if (o) setOpenId(o); }, [params]);

  const [status, setStatus] = useState<string>(ALL);
  const [campaign, setCampaign] = useState<string>(ALL);
  const [advFilter, setAdvFilter] = useState<string>(ALL);
  const [advType, setAdvType] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isAdvocate = role === "shop" || role === "mechanic";
  const showAdvocate = !isAdvocate;

  const inRange = useMemo(() => refsInRange(referrals, range), [referrals, range]);
  const summary = useMemo(() => funnel(inRange), [inRange]);

  const advocateOptions = useMemo(() => {
    const ids = Array.from(new Set(referrals.map((r) => r.advocateId)));
    return ids.map((id) => ({ id, name: advocateName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [referrals, advocateName]);
  const campaignOptions = useMemo(() => {
    const ids = new Set(referrals.map((r) => r.campaignId));
    return campaigns.filter((c) => ids.has(c.id));
  }, [referrals, campaigns]);

  const filteredRows = useMemo(() => inRange.filter((r) =>
    (status === ALL || r.status === status) &&
    (campaign === ALL || r.campaignId === campaign) &&
    (advFilter === ALL || r.advocateId === advFilter) &&
    (advType === ALL || r.advocateType === advType)
  ), [inRange, status, campaign, advFilter, advType]);

  const t = useTableState<Referral>(filteredRows, {
    search: (r, q) => r.id.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.customerRef.toLowerCase().includes(q) || (r.txnRef ?? "").toLowerCase().includes(q) || advocateName(r.advocateId).toLowerCase().includes(q),
    sorters: {
      id: (r) => r.id, advocate: (r) => advocateName(r.advocateId), code: (r) => r.code, campaign: (r) => campaignById.get(r.campaignId)?.name ?? "",
      date: (r) => r.createdAt, status: (r) => STATUSES.indexOf(r.status), value: (r) => r.purchaseValue, reward: (r) => r.reward,
    },
    initialSort: { key: "date", dir: "desc" },
    pageSize: 15,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { t.resetPage(); }, [status, campaign, advFilter, advType, range]);

  // only selections that are visible under the current filters count toward export
  const selectedVisible = useMemo(() => t.filtered.filter((r) => selected.has(r.id)), [t.filtered, selected]);
  const pageAllSelected = t.pageRows.length > 0 && t.pageRows.every((r) => selected.has(r.id));
  const pageSomeSelected = t.pageRows.some((r) => selected.has(r.id));

  const toggleRow = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const togglePage = (on: boolean) => setSelected((s) => { const n = new Set(s); t.pageRows.forEach((r) => (on ? n.add(r.id) : n.delete(r.id))); return n; });

  const filtersActive = status !== ALL || campaign !== ALL || advFilter !== ALL || advType !== ALL || !!t.query;
  const clearFilters = () => { setStatus(ALL); setCampaign(ALL); setAdvFilter(ALL); setAdvType(ALL); t.setQuery(""); };

  const exportRows = selectedVisible.length ? selectedVisible : t.filtered;
  const doExport = () => {
    if (!exportRows.length) { toast.error("Nothing to export"); return; }
    downloadCSV(`advocatex-referrals-${range.from}_${range.to}.csv`, exportRows.map((r) => ({
      referral_id: r.id, advocate: advocateName(r.advocateId), advocate_type: r.advocateType, referral_code: r.code, customer_identifier: r.customerRef,
      campaign: campaignById.get(r.campaignId)?.name ?? r.campaignId, channel: r.channel, clicked_at: r.createdAt, lead_at: r.leadAt ?? "", purchase_at: r.purchaseAt ?? "",
      verified_at: r.verifiedAt ?? "", rejected_at: r.rejectedAt ?? "", reject_reason: r.rejectReason ?? "", status: REFERRAL_STATUS_LABEL[r.status], purchase_value_inr: r.purchaseValue,
      reward_inr: r.status === "verified" || r.status === "pending" ? r.reward : 0, invoice_ref: r.txnRef ?? "",
    })));
    toast.success(`Exported ${formatNumber(exportRows.length)} referral${exportRows.length === 1 ? "" : "s"}`, { description: selectedVisible.length ? "Selected rows only." : "All rows matching the current filters." });
  };

  const openRow = (id: string) => { setOpenId(id); };
  const closeDrawer = () => {
    setOpenId(null);
    if (params.get("open")) { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral tracking"
        description={isAdvocate ? "Follow every customer you referred — from first click to verified purchase." : "Every referral across the network, from first click to verified purchase."}
        actions={<>
          <DateRangePicker value={range} onChange={setRange} />
          <Button variant="outline" onClick={doExport}><Download />{selectedVisible.length ? `Export selected (${selectedVisible.length})` : `Export all filtered (${formatNumber(t.total)})`}</Button>
        </>}
      />

      <div className="flex items-start gap-3 rounded-xl border border-action/20 bg-action-soft/50 p-4 text-[13px]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-action" />
        <div>
          <span className="font-medium">A click is not a sale.</span>{" "}
          <span className="text-muted-foreground">Referrals move from <em>clicked</em> → <em>qualified lead</em> → <em>pending verification</em> (purchase claimed) → <em>verified</em> or <em>rejected</em>. Only verified conversions earn advocate rewards. Conversion rate = verified ÷ clicks.</span>
        </div>
      </div>

      {isAdvocate && summary.pending > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/50 p-4 text-[13px]">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <span className="font-medium">{summary.pending} purchase{summary.pending === 1 ? "" : "s"} pending verification.</span>{" "}
            <span className="text-muted-foreground">The brand is checking the invoices. Once verified, {formatCurrency(summary.pendingReward)} in rewards moves to your wallet as pending approval.</span>
            <button type="button" className="ml-1 font-medium text-action hover:underline" onClick={() => setStatus("pending")}>Show them</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total clicks" value={formatNumber(summary.clicks)} icon={MousePointerClick} tone="action" hint="Referral link or QR visits in the selected range. A click is not a sale." sub={<span>{rangeLabel(range)}</span>} />
        <KpiCard label="Qualified leads" value={formatNumber(summary.leads)} icon={UserCheck} tone="brand" hint="Clicks where the customer shared details or visited." sub={<span className="num">{formatPercent(summary.clicks ? (summary.leads / summary.clicks) * 100 : 0)} of clicks</span>} />
        <KpiCard label="Pending verification" value={formatNumber(summary.pending)} icon={Clock} tone="warning" hint="Purchases claimed and awaiting invoice verification." />
        <KpiCard label="Verified conversions" value={formatNumber(summary.verified)} icon={CheckCircle2} tone="positive" hint="Purchases confirmed against an invoice. Only these earn rewards." sub={<span className="num">{formatPercent(summary.conversionRate)} conversion rate</span>} />
        <KpiCard label="Rejected" value={formatNumber(summary.rejected)} icon={XCircle} tone="destructive" hint="Purchase claims that failed verification." />
        <KpiCard label="Reward pending" value={formatCurrency(summary.pendingReward)} icon={Wallet} tone="warning" hint="Rewards that will be earned if the pending purchases are verified." />
      </div>

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search ID, code, customer, invoice…" className="sm:w-72" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{REFERRAL_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by campaign"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All campaigns</SelectItem>
              {campaignOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {showAdvocate && (
            <>
              <Select value={advFilter} onValueChange={setAdvFilter}>
                <SelectTrigger className="sm:w-48" aria-label="Filter by advocate"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All advocates</SelectItem>
                  {advocateOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={advType} onValueChange={setAdvType}>
                <SelectTrigger className="sm:w-40" aria-label="Filter by advocate type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Shops & mechanics</SelectItem>
                  <SelectItem value="shop">Shops only</SelectItem>
                  <SelectItem value="mechanic">Mechanics only</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {filtersActive && <Button variant="ghost" size="sm" onClick={clearFilters}><Filter />Clear filters</Button>}
          <div className="text-xs text-muted-foreground sm:ml-auto">
            {selectedVisible.length > 0 ? (
              <span className="inline-flex items-center gap-2"><span className="num">{selectedVisible.length} selected</span><button type="button" className="font-medium text-action hover:underline" onClick={() => setSelected(new Set())}>Clear</button></span>
            ) : <span className="num">{formatNumber(t.total)} referrals</span>}
          </div>
        </FilterBar>

        {t.total === 0 ? (
          <EmptyState icon={Link2} title={inRange.length ? "No referrals match these filters" : "No referrals in this date range"}
            description={inRange.length ? "Try a different status, campaign or search term." : "Widen the date range to see older referrals."}
            action={filtersActive ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : <Button variant="outline" size="sm" onClick={() => setRange(rangeFromPreset("90d"))}>Show last 90 days</Button>} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Select all rows on this page" checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false} onCheckedChange={(v) => togglePage(v === true)} />
                  </TableHead>
                  <SortableHead label="Referral ID" sortKey="id" sort={t.sort} onSort={t.toggleSort} />
                  {showAdvocate && <SortableHead label="Advocate" sortKey="advocate" sort={t.sort} onSort={t.toggleSort} />}
                  <SortableHead label="Code" sortKey="code" sort={t.sort} onSort={t.toggleSort} className="hidden lg:table-cell" />
                  <TableHead className="hidden md:table-cell">Customer</TableHead>
                  <SortableHead label="Campaign" sortKey="campaign" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                  <SortableHead label="Date" sortKey="date" sort={t.sort} onSort={t.toggleSort} />
                  <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                  <SortableHead label="Purchase" sortKey="value" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <SortableHead label="Reward" sortKey="reward" sort={t.sort} onSort={t.toggleSort} align="right" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.pageRows.map((r) => {
                  const adv = advocate(r.advocateId);
                  const camp = campaignById.get(r.campaignId);
                  const earns = r.status === "verified" || r.status === "pending";
                  return (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined} className="cursor-pointer" onClick={() => openRow(r.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${r.id}`} checked={selected.has(r.id)} onCheckedChange={(v) => toggleRow(r.id, v === true)} />
                      </TableCell>
                      <TableCell><span className="font-mono text-xs font-medium text-action">{r.id}</span><div className="text-[11px] text-muted-foreground">{r.channel}</div></TableCell>
                      {showAdvocate && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {adv && <EntityAvatar name={adv.name} hue={adv.hue} size="sm" type={adv.type} />}
                            <div className="min-w-0"><div className="max-w-[160px] truncate text-[13px] font-medium">{adv?.name ?? r.advocateId}</div><div className="text-[11px] capitalize text-muted-foreground">{r.advocateType}</div></div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="hidden font-mono text-xs lg:table-cell">{r.code}</TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{r.customerRef}</TableCell>
                      <TableCell className="hidden max-w-[200px] truncate text-[13px] md:table-cell">{camp?.name ?? r.campaignId}</TableCell>
                      <TableCell className="whitespace-nowrap text-[13px]">{formatDate(r.createdAt, { day: "numeric", month: "short" })}<div className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right num">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</TableCell>
                      <TableCell className={`text-right font-medium num ${r.status === "verified" ? "text-positive" : ""}`}>{earns ? formatCurrency(r.reward || camp?.rewardPerConversion || 0) : "—"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "pending" && can("verifyReferrals") ? (
                          <Button size="sm" variant="outline" onClick={() => openRow(r.id)}><ShieldCheck />Review</Button>
                        ) : (
                          <Button size="icon-sm" variant="ghost" aria-label={`View ${r.id}`} onClick={() => openRow(r.id)}><Eye /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
          </>
        )}
      </Card>

      <ReferralsDetailSheet id={openId} onClose={closeDrawer} inScope={isAdvocate ? (r) => r.advocateId === advocateId : role === "brand" ? (r) => campaigns.some((c) => c.id === r.campaignId) : undefined} />
    </div>
  );
}
