import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, Filter, ReceiptText } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { useLookups } from "@/hooks/useLookups";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { RewardTxn, RewardTxnStatus, RewardTxnType } from "@/types";

const ALL = "all";
export const TXN_TYPE_LABEL: Record<RewardTxnType, string> = { commission: "Commission", bonus: "Bonus", payout: "Payout", reversal: "Reversal" };
const STATUS_LABEL: Record<RewardTxnStatus, string> = { pending: "Pending approval", approved: "Available", requested: "Payout requested", paid: "Paid out", reversed: "Reversed" };

/** Signed amount: earnings are credits, payouts/reversals debit the wallet. */
export const signedAmount = (t: RewardTxn) => (t.type === "commission" || t.type === "bonus" ? (t.status === "reversed" ? 0 : t.amount) : -t.amount);

export function AmountCell({ t }: { t: RewardTxn }) {
  const credit = t.type === "commission" || t.type === "bonus";
  return (
    <span className={cn("font-medium num", t.status === "reversed" ? "text-muted-foreground line-through" : credit ? "text-positive" : "text-foreground")}>
      {credit ? "+" : "−"}{formatCurrency(t.amount)}
    </span>
  );
}

export function RewardsLedger({ rows, showAdvocate, title = "Reward ledger", description, filename = "advocatex-reward-ledger" }: {
  rows: RewardTxn[]; showAdvocate?: boolean; title?: string; description?: string; filename?: string;
}) {
  const { advocate, advocateName, campaignById } = useLookups();
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [campaign, setCampaign] = useState(ALL);
  const [adv, setAdv] = useState(ALL);

  const campaignOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.campaignId).filter(Boolean) as string[])).map((id) => ({ id, name: campaignById.get(id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name)), [rows, campaignById]);
  const advocateOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.advocateId))).map((id) => ({ id, name: advocateName(id) })).sort((a, b) => a.name.localeCompare(b.name)), [rows, advocateName]);
  const statusOptions = useMemo(() => (Object.keys(STATUS_LABEL) as RewardTxnStatus[]).filter((s) => rows.some((r) => r.status === s)), [rows]);

  const filtered = useMemo(() => rows.filter((r) =>
    (type === ALL || r.type === type) && (status === ALL || r.status === status) && (campaign === ALL || r.campaignId === campaign) && (adv === ALL || r.advocateId === adv)
  ), [rows, type, status, campaign, adv]);

  const t = useTableState<RewardTxn>(filtered, {
    search: (r, q) => r.id.toLowerCase().includes(q) || (r.referralId ?? "").toLowerCase().includes(q) || r.note.toLowerCase().includes(q) || advocateName(r.advocateId).toLowerCase().includes(q) || (campaignById.get(r.campaignId ?? "")?.name ?? "").toLowerCase().includes(q),
    sorters: { date: (r) => r.date, amount: (r) => r.amount, type: (r) => r.type, status: (r) => r.status, advocate: (r) => advocateName(r.advocateId), campaign: (r) => campaignById.get(r.campaignId ?? "")?.name ?? "" },
    initialSort: { key: "date", dir: "desc" },
    pageSize: 12,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { t.resetPage(); }, [type, status, campaign, adv]);

  const filtersActive = type !== ALL || status !== ALL || campaign !== ALL || adv !== ALL || !!t.query;
  const clear = () => { setType(ALL); setStatus(ALL); setCampaign(ALL); setAdv(ALL); t.setQuery(""); };

  const doExport = () => {
    if (!t.filtered.length) { toast.error("Nothing to export"); return; }
    downloadCSV(`${filename}.csv`, t.filtered.map((r) => ({
      txn_id: r.id, date: r.date, ...(showAdvocate ? { advocate: advocateName(r.advocateId), advocate_type: r.advocateType } : {}),
      type: TXN_TYPE_LABEL[r.type], status: STATUS_LABEL[r.status], amount_inr: r.amount, signed_amount_inr: signedAmount(r),
      referral_id: r.referralId ?? "", campaign: r.campaignId ? campaignById.get(r.campaignId)?.name ?? r.campaignId : "", note: r.note,
    })));
    toast.success(`Exported ${formatNumber(t.filtered.length)} ledger entries`);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description ?? "Every credit and debit to the reward wallet. Balances above are computed from these same entries."}</CardDescription></div>
        <Button variant="outline" size="sm" onClick={doExport}><Download />Export CSV</Button>
      </CardHeader>
      <FilterBar className="border-t">
        <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search txn, referral, note…" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All types</SelectItem>{(Object.keys(TXN_TYPE_LABEL) as RewardTxnType[]).map((k) => <SelectItem key={k} value={k}>{TXN_TYPE_LABEL[k]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{statusOptions.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={campaign} onValueChange={setCampaign}>
          <SelectTrigger className="sm:w-52" aria-label="Filter by campaign"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All campaigns</SelectItem>{campaignOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        {showAdvocate && (
          <Select value={adv} onValueChange={setAdv}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by advocate"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All advocates</SelectItem>{advocateOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {filtersActive && <Button variant="ghost" size="sm" onClick={clear}><Filter />Clear</Button>}
        <span className="text-xs text-muted-foreground num sm:ml-auto">{formatNumber(t.total)} entries</span>
      </FilterBar>
      {t.total === 0 ? (
        <EmptyState icon={ReceiptText} title={rows.length ? "No ledger entries match" : "No reward transactions yet"} description={rows.length ? "Try different filters." : "Rewards appear here once a referral is verified."}
          action={filtersActive ? <Button variant="outline" size="sm" onClick={clear}>Clear filters</Button> : undefined} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Date" sortKey="date" sort={t.sort} onSort={t.toggleSort} />
                {showAdvocate && <SortableHead label="Advocate" sortKey="advocate" sort={t.sort} onSort={t.toggleSort} />}
                <SortableHead label="Type" sortKey="type" sort={t.sort} onSort={t.toggleSort} />
                <TableHead>Referral</TableHead>
                <SortableHead label="Campaign" sortKey="campaign" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                <SortableHead label="Amount" sortKey="amount" sort={t.sort} onSort={t.toggleSort} align="right" />
                <SortableHead label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                <TableHead className="hidden lg:table-cell">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.pageRows.map((r) => {
                const a = advocate(r.advocateId);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-[13px]">{formatDate(r.date)}<div className="font-mono text-[11px] text-muted-foreground">{r.id}</div></TableCell>
                    {showAdvocate && (
                      <TableCell>
                        <div className="flex items-center gap-2">{a && <EntityAvatar name={a.name} hue={a.hue} size="sm" type={a.type} />}<span className="max-w-[150px] truncate text-[13px] font-medium">{a?.name ?? r.advocateId}</span></div>
                      </TableCell>
                    )}
                    <TableCell><Badge variant={r.type === "bonus" ? "ai" : r.type === "payout" ? "outline" : r.type === "reversal" ? "destructive" : "secondary"}>{TXN_TYPE_LABEL[r.type]}</Badge></TableCell>
                    <TableCell>{r.referralId ? <Link to={`/app/referrals?open=${r.referralId}`} className="font-mono text-xs font-medium text-action hover:underline">{r.referralId}</Link> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-[13px] md:table-cell">{r.campaignId ? campaignById.get(r.campaignId)?.name ?? r.campaignId : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right"><AmountCell t={r} /></TableCell>
                    <TableCell><StatusBadge status={r.status} context="reward" /></TableCell>
                    <TableCell className="hidden max-w-[240px] truncate text-xs text-muted-foreground lg:table-cell" title={r.note}>{r.note}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
        </>
      )}
    </Card>
  );
}
