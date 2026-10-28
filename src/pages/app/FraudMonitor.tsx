import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Eye, FlaskConical, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { C, ChartCard, ChartTooltip, Legend } from "@/components/shared/charts";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { FraudFlagSheet } from "./components/FraudFlagSheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { FLAG_TYPE_LABEL, scopeFlags } from "@/lib/insights";
import { inRange, rangeLabel } from "@/lib/metrics";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import type { FlagSeverity, FlagStatus, FlagType } from "@/types";

const SEVERITIES: FlagSeverity[] = ["critical", "high", "medium", "low"];
const SEV_RANK: Record<FlagSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEV_COLOR: Record<FlagSeverity, string> = { critical: C.c6, high: C.c5, medium: C.c4, low: C.c2 };
const SEV_LABEL: Record<FlagSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABEL: Record<FlagStatus, string> = { new: "New", under_review: "Under review", resolved: "Resolved", dismissed: "Dismissed" };
const TYPES = Object.keys(FLAG_TYPE_LABEL) as FlagType[];
const SHORT_TYPE: Record<FlagType, string> = { duplicate_pattern: "Duplicate", high_frequency: "High frequency", repeated_txn: "Repeated txn", conversion_spike: "Spike", reward_abuse: "Reward abuse" };

const RULES: { type: FlagType; description: string }[] = [
  { type: "duplicate_pattern", description: "The same customer or visitor appears on several referrals for one advocate in a short window (one reward per customer per product category per 30 days)." },
  { type: "high_frequency", description: "More than 10 clicks per hour from fewer than 3 visitors, or daily clicks far above the advocate's own average." },
  { type: "repeated_txn", description: "An invoice or transaction reference is reused across multiple purchase claims. Each claim needs a unique reference." },
  { type: "conversion_spike", description: "Daily purchase claims exceed 5× the advocate's 30-day average, especially with very short click-to-purchase times." },
  { type: "reward_abuse", description: "Rewards reversed after an invoice audit, or claims that don't match the participating workshop or shop." },
];

export default function FraudMonitor() {
  const { role, can } = useCurrentUser();
  const canReview = can("reviewFraud");
  const scope = useScope();
  const allFlags = useDataStore((s) => s.flags);
  const range = useUIStore((s) => s.dateRange);
  const { advocate } = useLookups();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<"all" | "open" | FlagStatus>("all");
  const [severity, setSeverity] = useState<"all" | FlagSeverity>("all");
  const [type, setType] = useState<"all" | FlagType>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const flags = useMemo(() => scopeFlags(allFlags, scope.referrals, role), [allFlags, scope.referrals, role]);

  useEffect(() => {
    const id = params.get("open");
    if (id && flags.some((f) => f.id === id)) setOpenId(id);
  }, [params, flags]);
  const closeSheet = (o: boolean) => {
    if (o) return;
    setOpenId(null);
    if (params.has("open")) { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); }
  };

  const summary = useMemo(() => ({
    open: flags.filter((f) => f.status === "new" || f.status === "under_review").length,
    newCount: flags.filter((f) => f.status === "new").length,
    severe: flags.filter((f) => (f.status === "new" || f.status === "under_review") && (f.severity === "critical" || f.severity === "high")).length,
    review: flags.filter((f) => f.status === "under_review").length,
    closedInRange: flags.filter((f) => (f.status === "resolved" || f.status === "dismissed") && inRange(f.detectedAt, range)).length,
    resolvedInRange: flags.filter((f) => f.status === "resolved" && inRange(f.detectedAt, range)).length,
  }), [flags, range]);

  const chart = useMemo(() => TYPES.map((t) => {
    const row: Record<string, string | number> = { type: SHORT_TYPE[t], full: FLAG_TYPE_LABEL[t] };
    for (const s of SEVERITIES) row[s] = flags.filter((f) => f.type === t && f.severity === s).length;
    return row;
  }), [flags]);

  const rows = useMemo(() => flags
    .filter((f) => status === "all" || (status === "open" ? f.status === "new" || f.status === "under_review" : f.status === status))
    .filter((f) => severity === "all" || f.severity === severity)
    .filter((f) => type === "all" || f.type === type)
    .map((f) => ({ f, adv: advocate(f.advocateId) })), [flags, status, severity, type, advocate]);

  const t = useTableState(rows, {
    search: (r, q) => [r.f.id, r.f.reason, r.adv?.name ?? "", FLAG_TYPE_LABEL[r.f.type]].some((s) => s.toLowerCase().includes(q)),
    sorters: { id: (r) => r.f.id, severity: (r) => SEV_RANK[r.f.severity], advocate: (r) => r.adv?.name ?? "", detected: (r) => r.f.detectedAt, status: (r) => r.f.status },
    initialSort: { key: "detected", dir: "desc" },
  });
  const filtered = status !== "all" || severity !== "all" || type !== "all" || !!t.query;
  const clear = () => { setStatus("all"); setSeverity("all"); setType("all"); t.setQuery(""); };
  const current = flags.find((f) => f.id === openId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={!canReview ? <Badge variant="secondary">Read-only · alerts linked to your campaigns</Badge> : undefined}
        title="Fraud monitoring"
        description="Rule-based alerts on referral, transaction and reward patterns that may need a human review."
        actions={<Button variant="outline" onClick={() => { setStatus("open"); setSeverity("all"); setType("all"); t.resetPage(); }}><Eye />Show open alerts</Button>}
      />

      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 px-4 py-3 text-[13px]" role="note">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">These are simulated, rule-based alerts — not proof of fraud.</span> Each alert lists the rule that fired and the sample evidence behind it.
          Always review the linked referral records before taking action against an advocate.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Open alerts" value={formatNumber(summary.open)} icon={ShieldAlert} tone="destructive" hint="Alerts with status New or Under review." sub={<span>{summary.newCount} new</span>} />
        <KpiCard label="Critical / high" value={formatNumber(summary.severe)} icon={AlertTriangle} tone="warning" hint="Open alerts with critical or high severity." />
        <KpiCard label="Under review" value={formatNumber(summary.review)} icon={ShieldQuestion} tone="action" hint="Alerts an admin is currently investigating." />
        <KpiCard label="Resolved in range" value={formatNumber(summary.resolvedInRange)} icon={CheckCircle2} tone="positive" hint={`Alerts detected in ${rangeLabel(range).toLowerCase()} that were resolved after review.`} sub={<span>{summary.closedInRange - summary.resolvedInRange} dismissed</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title="Alerts by type and severity" description={`All ${flags.length} alerts in scope, stacked by severity.`}
          action={<Legend items={SEVERITIES.map((s) => ({ label: SEV_LABEL[s], color: SEV_COLOR[s] }))} />}>
          {flags.length ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="type" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: C.grid, opacity: 0.4 }} content={<ChartTooltip format={(v) => `${v} alert${v === 1 ? "" : "s"}`} />} />
                  {[...SEVERITIES].reverse().map((s, i) => (
                    <Bar key={s} dataKey={s} name={SEV_LABEL[s]} stackId="sev" fill={SEV_COLOR[s]} maxBarSize={40} radius={i === SEVERITIES.length - 1 ? [3, 3, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={ShieldAlert} title="No alerts in scope" className="py-10" />}
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detection rules</CardTitle>
            <CardDescription>The five simulated rules that can raise an alert.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RULES.map((r) => (
              <div key={r.type} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive/70" aria-hidden />
                <div>
                  <div className="text-[13px] font-medium">{FLAG_TYPE_LABEL[r.type]} <span className="ml-1 text-xs font-normal text-muted-foreground num">{flags.filter((f) => f.type === r.type).length} alerts</span></div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Alerts</CardTitle>
          <CardDescription>Select an alert to see its evidence and linked referrals{canReview ? " and to review it" : ""}.</CardDescription>
        </CardHeader>
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search ID, advocate, reason…" />
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); t.resetPage(); }}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open (new + review)</SelectItem>
              {(Object.keys(STATUS_LABEL) as FlagStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => { setSeverity(v as typeof severity); t.resetPage(); }}>
            <SelectTrigger className="sm:w-36" aria-label="Filter by severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{SEV_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { setType(v as typeof type); t.resetPage(); }}>
            <SelectTrigger className="sm:w-56" aria-label="Filter by type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All alert types</SelectItem>
              {TYPES.map((x) => <SelectItem key={x} value={x}>{FLAG_TYPE_LABEL[x]}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtered && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
        </FilterBar>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Flag ID" sortKey="id" sort={t.sort} onSort={t.toggleSort} />
              <SortableHead label="Severity" sortKey="severity" sort={t.sort} onSort={t.toggleSort} />
              <SortableHead label="Advocate" sortKey="advocate" sort={t.sort} onSort={t.toggleSort} />
              <TableHead className="hidden lg:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <SortableHead label="Detected" sortKey="detected" sort={t.sort} onSort={t.toggleSort} className="hidden sm:table-cell" />
              <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
              <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.pageRows.map(({ f, adv }) => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => setOpenId(f.id)}>
                <TableCell className="font-mono text-xs font-medium">{f.id}</TableCell>
                <TableCell><StatusBadge status={f.severity} context="severity" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <EntityAvatar name={adv?.name ?? f.advocateId} hue={adv?.hue} size="sm" type={f.advocateType} />
                    <div className="min-w-0"><div className="max-w-[160px] truncate text-[13px] font-medium">{adv?.name ?? f.advocateId}</div><div className="text-[11px] text-muted-foreground">{f.advocateType === "shop" ? "Shop" : "Mechanic"}</div></div>
                  </div>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-[13px] lg:table-cell">{FLAG_TYPE_LABEL[f.type]}</TableCell>
                <TableCell className="hidden max-w-[300px] md:table-cell"><p className="line-clamp-2 text-[13px] text-muted-foreground">{f.reason}</p></TableCell>
                <TableCell className="hidden whitespace-nowrap text-[13px] sm:table-cell">{formatDateTime(f.detectedAt)}<div className="text-[11px] text-muted-foreground">{timeAgo(f.detectedAt)}</div></TableCell>
                <TableCell><StatusBadge status={f.status} context="flag" /></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setOpenId(f.id); }} aria-label={`${canReview && (f.status === "new" || f.status === "under_review") ? "Review" : "View"} ${f.id}`}>
                    {canReview && (f.status === "new" || f.status === "under_review") ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {t.total === 0 && (
          <EmptyState icon={ShieldAlert} title={flags.length ? "No alerts match these filters" : "No alerts in your scope"}
            description={flags.length ? "Try a different status, severity or type." : "No rule-based alerts involve your campaigns' referrals."}
            action={filtered ? <Button variant="outline" size="sm" onClick={clear}>Clear filters</Button> : undefined} />
        )}
        <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
      </Card>

      <FraudFlagSheet flag={current} open={!!current} onOpenChange={closeSheet} canReview={canReview} />
    </div>
  );
}
