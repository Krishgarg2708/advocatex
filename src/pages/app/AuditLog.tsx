import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, Filter, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { useDataStore } from "@/store/data";
import { ROLE_LABEL } from "@/store/auth";
import { rangeFromPreset } from "@/store/ui";
import { inRange, rangeLabel } from "@/lib/metrics";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { AuditEntry, DateRange, Role } from "@/types";

type Category = AuditEntry["category"];
const CATEGORY: Record<Category, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  auth: { label: "Auth", variant: "muted" },
  campaign: { label: "Campaign", variant: "default" },
  referral: { label: "Referral", variant: "action" },
  reward: { label: "Reward", variant: "positive" },
  approval: { label: "Approval", variant: "secondary" },
  fraud: { label: "Fraud", variant: "destructive" },
  product: { label: "Product", variant: "outline" },
  settings: { label: "Settings", variant: "muted" },
  loyalty: { label: "Loyalty", variant: "ai" },
};
const CATS = Object.keys(CATEGORY) as Category[];
const roleLabel = (r: Role | "system") => (r === "system" ? "System" : ROLE_LABEL[r]);
const ALL = "all";

export default function AuditLog() {
  const audit = useDataStore((s) => s.audit);
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("90d"));
  const [category, setCategory] = useState(ALL);
  const [actorRole, setActorRole] = useState(ALL);
  const [params, setParams] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  useEffect(() => { const o = params.get("open"); if (o) setOpenId(o); }, [params]);

  const ranged = useMemo(() => audit.filter((e) => inRange(e.at, range)), [audit, range]);
  const byCategory = useMemo(() => {
    const m = new Map<Category, number>();
    for (const e of ranged) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return CATS.map((c) => ({ c, n: m.get(c) ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  }, [ranged]);
  const roles = useMemo(() => Array.from(new Set(audit.map((e) => e.role))), [audit]);
  const filtered = useMemo(() => ranged.filter((e) => (category === ALL || e.category === category) && (actorRole === ALL || e.role === actorRole)), [ranged, category, actorRole]);

  const t = useTableState<AuditEntry>(filtered, {
    search: (e, q) => e.action.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || (e.details ?? "").toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
    sorters: { at: (e) => e.at, actor: (e) => e.actor, category: (e) => e.category },
    initialSort: { key: "at", dir: "desc" },
    pageSize: 20,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { t.resetPage(); }, [category, actorRole, range]);

  const filtersActive = category !== ALL || actorRole !== ALL || !!t.query;
  const clear = () => { setCategory(ALL); setActorRole(ALL); t.setQuery(""); };
  const doExport = () => {
    if (!t.filtered.length) { toast.error("Nothing to export"); return; }
    downloadCSV(`advocatex-audit-log-${range.from}_${range.to}.csv`, t.filtered.map((e) => ({ id: e.id, time: e.at, actor: e.actor, role: roleLabel(e.role), action: e.action, category: CATEGORY[e.category].label, target: e.target, details: e.details ?? "" })));
    toast.success(`Exported ${formatNumber(t.filtered.length)} audit events`);
  };
  const selected = openId ? audit.find((e) => e.id === openId) : undefined;
  const close = () => { setOpenId(null); if (params.get("open")) { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); } };

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="A chronological record of every significant action taken on the platform — approvals, verifications, payouts, redemptions and settings changes."
        actions={<>
          <DateRangePicker value={range} onChange={setRange} />
          <Button variant="outline" onClick={doExport}><Download />Export CSV</Button>
        </>} />

      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <div className="text-xs text-muted-foreground">Events · {rangeLabel(range)}</div>
            <div className="text-2xl font-semibold tracking-tight num">{formatNumber(ranged.length)}</div>
          </div>
          <div className="hidden h-10 w-px bg-border sm:block" aria-hidden />
          <div className="flex flex-wrap gap-1.5">
            {byCategory.length === 0 && <span className="text-sm text-muted-foreground">No events in this range.</span>}
            {byCategory.map(({ c, n }) => (
              <button key={c} type="button" onClick={() => setCategory(category === c ? ALL : c)} aria-pressed={category === c}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", category === c ? "border-action bg-action-soft text-action" : "hover:bg-muted")}>
                {CATEGORY[c].label}<span className="font-semibold num">{n}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search action, actor, target…" className="sm:w-72" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{CATS.map((c) => <SelectItem key={c} value={c}>{CATEGORY[c].label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={actorRole} onValueChange={setActorRole}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by actor role"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All actor roles</SelectItem>{roles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
          </Select>
          {filtersActive && <Button variant="ghost" size="sm" onClick={clear}><Filter />Clear filters</Button>}
          <span className="text-xs text-muted-foreground num sm:ml-auto">{formatNumber(t.total)} events</span>
        </FilterBar>
        {t.total === 0 ? (
          <EmptyState icon={ScrollText} title="No audit events match" description={ranged.length ? "Try different filters or search terms." : "No events were recorded in this date range."}
            action={filtersActive ? <Button variant="outline" size="sm" onClick={clear}>Clear filters</Button> : <Button variant="outline" size="sm" onClick={() => setRange(rangeFromPreset("90d"))}>Show last 90 days</Button>} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Time" sortKey="at" sort={t.sort} onSort={t.toggleSort} />
                  <SortableHead label="Actor" sortKey="actor" sort={t.sort} onSort={t.toggleSort} />
                  <TableHead>Action</TableHead>
                  <SortableHead label="Category" sortKey="category" sort={t.sort} onSort={t.toggleSort} className="hidden sm:table-cell" />
                  <TableHead className="hidden md:table-cell">Target</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.pageRows.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpenId(e.id)} tabIndex={0} onKeyDown={(k) => { if (k.key === "Enter") setOpenId(e.id); }}>
                    <TableCell className="whitespace-nowrap text-[13px]">{formatDateTime(e.at)}<div className="text-[11px] text-muted-foreground">{timeAgo(e.at)}</div></TableCell>
                    <TableCell><div className="text-[13px] font-medium">{e.actor}</div><Badge variant={e.role === "system" ? "muted" : e.role === "admin" ? "default" : "secondary"} className="mt-0.5">{roleLabel(e.role)}</Badge></TableCell>
                    <TableCell className="text-[13px] font-medium">{e.action}</TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant={CATEGORY[e.category].variant}>{CATEGORY[e.category].label}</Badge></TableCell>
                    <TableCell className="hidden max-w-[240px] truncate text-[13px] md:table-cell" title={e.target}>{e.target}</TableCell>
                    <TableCell className="hidden max-w-[260px] truncate text-xs text-muted-foreground lg:table-cell" title={e.details}>{e.details ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
          </>
        )}
      </Card>
      <DemoNotice>The audit log is stored in this browser and resets with demo data. In production it must be append-only and written server-side.</DemoNotice>

      <Sheet open={!!openId} onOpenChange={(o) => !o && close()}>
        <SheetContent>
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.action}</SheetTitle>
                <SheetDescription>{formatDateTime(selected.at)} · {timeAgo(selected.at)}</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <dl className="divide-y rounded-lg border text-sm">
                  {([
                    ["Event ID", <code key="i" className="font-mono text-xs">{selected.id}</code>],
                    ["Timestamp", <span key="t" className="font-mono text-xs">{selected.at}</span>],
                    ["Actor", selected.actor],
                    ["Actor role", <Badge key="r" variant="secondary">{roleLabel(selected.role)}</Badge>],
                    ["Category", <Badge key="c" variant={CATEGORY[selected.category].variant}>{CATEGORY[selected.category].label}</Badge>],
                    ["Target", selected.target],
                    ["Details", selected.details ?? "—"],
                  ] as [string, React.ReactNode][]).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4 px-3 py-2.5"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-medium">{v}</dd></div>
                  ))}
                </dl>
              </SheetBody>
            </>
          ) : (
            <SheetHeader><SheetTitle>Event not found</SheetTitle><SheetDescription>It may have been cleared by a demo data reset.</SheetDescription></SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
