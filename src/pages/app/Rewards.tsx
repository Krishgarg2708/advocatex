import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowUpRight, Banknote, CheckCheck, CheckCircle2, Clock, Coins, HandCoins, Hourglass, Info, Megaphone, PiggyBank, Undo2, Wallet, XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Hint } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/table-kit";
import { C, ChartCard, ChartTooltip, Legend } from "@/components/shared/charts";
import { RewardsLedger } from "./components/RewardsLedger";
import { MIN_PAYOUT, RewardsPayoutDialog } from "./components/RewardsPayoutDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { api } from "@/services/api";
import { spendOf, wallet } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RewardTxn } from "@/types";

export default function Rewards() {
  const { role } = useCurrentUser();
  if (role === "admin") return <AdminRewards />;
  if (role === "brand") return <BrandRewards />;
  return <AdvocateWallet />;
}

/* ------------------------------------------------------------------ advocate */
function AdvocateWallet() {
  const { shop, mechanic, advocateId } = useCurrentUser();
  const { rewards } = useScope();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const w = useMemo(() => wallet(rewards), [rewards]);
  const pendingPayouts = useMemo(() => rewards.filter((t) => t.type === "payout" && t.status === "requested").sort((a, b) => b.date.localeCompare(a.date)), [rewards]);
  const pendingCount = useMemo(() => rewards.filter((t) => (t.type === "commission" || t.type === "bonus") && t.status === "pending").length, [rewards]);
  const name = shop?.name ?? mechanic?.name ?? "";
  const canPayout = w.available >= MIN_PAYOUT;

  if (!advocateId) return <EmptyState icon={Wallet} title="No advocate profile linked" description="Switch to a Shop Owner or Mechanic demo role to see a reward wallet." />;

  const payoutButton = (
    <Button variant="positive" disabled={!canPayout} onClick={() => setPayoutOpen(true)}><Banknote />Request payout</Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards & commissions"
        description="Your reward wallet. Rewards are earned only on verified conversions and become available once approved."
        actions={<>
          <Button variant="outline" asChild><Link to="/app/referrals"><ArrowUpRight />View referrals</Link></Button>
          {canPayout ? payoutButton : <Hint content={`You need at least ${formatCurrency(MIN_PAYOUT)} available to request a payout.`}><span tabIndex={0}>{payoutButton}</span></Hint>}
        </>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-positive/10 via-action/10 to-brand/10" aria-hidden />
          <CardContent className="relative grid gap-6 p-5 sm:grid-cols-[1.2fr,1fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Wallet className="h-4 w-4 text-positive" />Available to withdraw</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight text-positive num">{formatCurrency(w.available)}</div>
              <p className="mt-1 text-xs text-muted-foreground">Approved rewards minus payouts requested or paid.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {payoutButton}
                {!canPayout && <span className="text-xs text-muted-foreground">Minimum payout is {formatCurrency(MIN_PAYOUT)} — {formatCurrency(MIN_PAYOUT - w.available)} to go.</span>}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Total earned", w.totalEarned, "Pending + approved rewards (lifetime)"],
                ["Pending approval", w.pending, `${pendingCount} rewards awaiting admin approval`],
                ["In payout", w.inProcess, "Requested, awaiting approval"],
                ["Paid out", w.paidOut, "Simulated payouts marked paid"],
              ].map(([l, v, h]) => (
                <div key={String(l)} className="flex items-center justify-between rounded-md bg-card/80 px-3 py-2 ring-1 ring-border">
                  <div><div className="font-medium">{l}</div><div className="text-[11px] text-muted-foreground">{h}</div></div>
                  <div className="font-semibold num">{formatCurrency(Number(v))}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info className="h-4 w-4 text-action" />How rewards work</CardTitle>
            <CardDescription>From a verified sale to your bank — all simulated.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-[13px]">
              {[
                ["Purchase verified", "The brand matches the invoice. A reward is created as pending approval."],
                ["Reward approved", "An admin approves it — it becomes available in your wallet."],
                ["Request payout", `Withdraw ${formatCurrency(MIN_PAYOUT)} or more via UPI or bank (simulated).`],
                ["Payout approved", "The request is marked paid. No real money moves in this demo."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">{i + 1}</span>
                  <div><div className="font-medium">{t}</div><div className="text-muted-foreground">{d}</div></div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total earned" value={formatCurrency(w.totalEarned)} icon={Coins} tone="brand" hint="All non-reversed commissions and bonuses (pending + approved)." />
        <KpiCard label="Available" value={formatCurrency(w.available)} icon={Wallet} tone="positive" hint="Approved rewards not yet requested as a payout." />
        <KpiCard label="Pending" value={formatCurrency(w.pending)} icon={Clock} tone="warning" hint="Rewards for verified sales that still need approval." />
        <KpiCard label="In payout" value={formatCurrency(w.inProcess)} icon={Hourglass} tone="action" hint="Payout requests awaiting approval." />
        <KpiCard label="Redeemed / paid out" value={formatCurrency(w.paidOut)} icon={HandCoins} tone="neutral" hint="Payouts marked as paid (simulated)." sub={<span className="num">{formatPercent(w.redemptionRate)} of approved</span>} />
        <KpiCard label="Reversed" value={formatCurrency(w.reversed)} icon={Undo2} tone="destructive" hint="Rewards reversed after review (e.g. returned goods or rejected claims)." />
      </div>

      {pendingPayouts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payout requests in progress</CardTitle><CardDescription>Awaiting admin approval</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {pendingPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-action-soft text-action"><Hourglass className="h-4 w-4" /></span>
                  <div><div className="text-sm font-medium num">{formatCurrency(p.amount)}</div><div className="text-xs text-muted-foreground">Requested {timeAgo(p.date)} · <span className="font-mono">{p.id}</span></div></div></div>
                <StatusBadge status={p.status} context="reward" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DemoNotice>Simulated wallet — balances are computed in this browser from the ledger below. No real money is transferred.</DemoNotice>
      <RewardsLedger rows={rewards} filename="advocatex-my-reward-ledger" />

      <RewardsPayoutDialog open={payoutOpen} onOpenChange={setPayoutOpen} advocateId={advocateId} available={w.available} payeeName={shop?.owner ?? mechanic?.name ?? name} />
    </div>
  );
}

/* ------------------------------------------------------------------ admin */
function AdminRewards() {
  const rewards = useDataStore((s) => s.rewards);
  const { advocate, campaignById } = useLookups();
  const w = useMemo(() => wallet(rewards), [rewards]);
  const pending = useMemo(() => rewards.filter((t) => (t.type === "commission" || t.type === "bonus") && t.status === "pending").sort((a, b) => b.date.localeCompare(a.date)), [rewards]);
  const payouts = useMemo(() => rewards.filter((t) => t.type === "payout" && t.status === "requested").sort((a, b) => b.date.localeCompare(a.date)), [rewards]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(pending.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = pending.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedRows = pending.filter((t) => selected.has(t.id));
  const selectedTotal = selectedRows.reduce((s, t) => s + t.amount, 0);
  const [approveOne, setApproveOne] = useState<RewardTxn | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [payoutAction, setPayoutAction] = useState<{ t: RewardTxn; status: "paid" | "rejected" } | null>(null);

  const pageAll = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const pageSome = pageRows.some((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const togglePage = (on: boolean) => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (on ? n.add(r.id) : n.delete(r.id))); return n; });

  return (
    <div className="space-y-6">
      <PageHeader title="Rewards & commissions" description="Approve advocate rewards and payout requests across the network. All money movement is simulated." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total rewards accrued" value={formatCurrency(w.totalEarned)} icon={Coins} tone="brand" hint="Pending + approved commissions and bonuses across all advocates (campaign spend)." />
        <KpiCard label="Pending approval" value={formatCurrency(w.pending)} icon={Clock} tone="warning" sub={<span className="num">{pending.length} rewards</span>} />
        <KpiCard label="Available to advocates" value={formatCurrency(w.available)} icon={Wallet} tone="positive" hint="Approved rewards not yet requested as payouts." />
        <KpiCard label="Payouts requested" value={formatCurrency(w.inProcess)} icon={Hourglass} tone="action" sub={<span className="num">{payouts.length} requests</span>} />
        <KpiCard label="Paid out" value={formatCurrency(w.paidOut)} icon={HandCoins} tone="neutral" sub={<span className="num">{formatPercent(w.redemptionRate)} redemption rate</span>} hint="Paid-out ÷ approved rewards × 100." />
        <KpiCard label="Reversed" value={formatCurrency(w.reversed)} icon={Undo2} tone="destructive" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div><CardTitle>Pending reward approvals</CardTitle><CardDescription className="mt-1">Rewards for verified purchases. Approving makes them available in the advocate's wallet.</CardDescription></div>
            <Button size="sm" variant="positive" disabled={!selectedRows.length} onClick={() => setBulkOpen(true)}><CheckCheck />Approve selected{selectedRows.length ? ` (${selectedRows.length})` : ""}</Button>
          </CardHeader>
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up" description="There are no rewards waiting for approval." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox aria-label="Select all on this page" checked={pageAll ? true : pageSome ? "indeterminate" : false} onCheckedChange={(v) => togglePage(v === true)} /></TableHead>
                    <TableHead>Advocate</TableHead>
                    <TableHead>Referral</TableHead>
                    <TableHead className="hidden md:table-cell">Campaign</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((t) => {
                    const a = advocate(t.advocateId);
                    return (
                      <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                        <TableCell><Checkbox aria-label={`Select ${t.id}`} checked={selected.has(t.id)} onCheckedChange={(v) => toggle(t.id, v === true)} /></TableCell>
                        <TableCell><div className="flex items-center gap-2">{a && <EntityAvatar name={a.name} hue={a.hue} size="sm" type={a.type} />}<div className="min-w-0"><div className="max-w-[160px] truncate text-[13px] font-medium">{a?.name ?? t.advocateId}</div><div className="text-[11px] capitalize text-muted-foreground">{t.advocateType} · {t.type}</div></div></div></TableCell>
                        <TableCell>{t.referralId ? <Link to={`/app/referrals?open=${t.referralId}`} className="font-mono text-xs font-medium text-action hover:underline">{t.referralId}</Link> : "—"}</TableCell>
                        <TableCell className="hidden max-w-[180px] truncate text-[13px] md:table-cell">{t.campaignId ? campaignById.get(t.campaignId)?.name : "—"}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-[13px] sm:table-cell">{formatDate(t.date, { day: "numeric", month: "short" })}</TableCell>
                        <TableCell className="text-right font-medium num">{formatCurrency(t.amount)}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setApproveOne(t)}><CheckCircle2 />Approve</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={safePage} pageCount={pageCount} total={pending.length} pageSize={pageSize} onPage={setPage} />
            </>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Payout requests</CardTitle><CardDescription>Advocates withdrawing available rewards (simulated).</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {payouts.length === 0 && <EmptyState icon={Banknote} title="No open payout requests" className="py-8" />}
            {payouts.map((t) => {
              const a = advocate(t.advocateId);
              const aw = wallet(rewards, t.advocateId);
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {a && <EntityAvatar name={a.name} hue={a.hue} size="md" type={a.type} />}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a?.name ?? t.advocateId}</div><div className="text-xs text-muted-foreground">{timeAgo(t.date)} · {formatCurrency(aw.available)} still available</div></div>
                    <div className="text-right text-sm font-semibold num">{formatCurrency(t.amount)}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPayoutAction({ t, status: "rejected" })}><XCircle />Decline</Button>
                    <Button size="sm" variant="positive" onClick={() => setPayoutAction({ t, status: "paid" })}><CheckCircle2 />Approve payout</Button>
                  </div>
                </div>
              );
            })}
            <DemoNotice className="mt-2">Approving marks the payout as paid in the demo ledger. No real money is transferred.</DemoNotice>
          </CardContent>
        </Card>
      </div>

      <RewardsLedger rows={rewards} showAdvocate title="Platform reward ledger" description="Every reward, payout and reversal across all advocates." filename="advocatex-platform-reward-ledger" />

      <ConfirmDialog open={!!approveOne} onOpenChange={(o) => !o && setApproveOne(null)} title="Approve this reward?" confirmLabel="Approve reward" variant="positive"
        description={approveOne && <p>{formatCurrency(approveOne.amount)} for {advocate(approveOne.advocateId)?.name ?? approveOne.advocateId} ({approveOne.referralId ?? approveOne.id}) becomes available in their wallet. Simulated action.</p>}
        onConfirm={async () => {
          if (!approveOne) return;
          await api.rewards.approve(approveOne.id);
          setSelected((s) => { const n = new Set(s); n.delete(approveOne.id); return n; });
          toast.success("Reward approved", { description: `${formatCurrency(approveOne.amount)} is now available to the advocate.` });
        }} />

      <ConfirmDialog open={bulkOpen} onOpenChange={setBulkOpen} title={`Approve ${selectedRows.length} rewards?`} confirmLabel={`Approve ${formatCurrency(selectedTotal)}`} variant="positive"
        description={<p>{selectedRows.length} rewards totalling <span className="font-semibold text-foreground">{formatCurrency(selectedTotal)}</span> across {new Set(selectedRows.map((r) => r.advocateId)).size} advocates will become available. Simulated action.</p>}
        onConfirm={async () => {
          const ids = selectedRows.map((r) => r.id);
          await Promise.all(ids.map((id) => api.rewards.approve(id)));
          setSelected(new Set());
          toast.success(`${ids.length} rewards approved`, { description: `${formatCurrency(selectedTotal)} released to advocate wallets.` });
        }} />

      <ConfirmDialog open={!!payoutAction} onOpenChange={(o) => !o && setPayoutAction(null)}
        title={payoutAction?.status === "paid" ? "Approve payout?" : "Decline payout?"}
        confirmLabel={payoutAction?.status === "paid" ? "Approve payout" : "Decline payout"}
        variant={payoutAction?.status === "paid" ? "positive" : "destructive"}
        description={payoutAction && (payoutAction.status === "paid"
          ? <p>{formatCurrency(payoutAction.t.amount)} to {advocate(payoutAction.t.advocateId)?.name} will be marked as paid. This is simulated — no real money is transferred.</p>
          : <p>The {formatCurrency(payoutAction.t.amount)} request from {advocate(payoutAction.t.advocateId)?.name} will be removed and the amount returned to their available balance.</p>)}
        onConfirm={async () => {
          if (!payoutAction) return;
          await api.rewards.setPayoutStatus(payoutAction.t.id, payoutAction.status);
          toast.success(payoutAction.status === "paid" ? "Payout approved (simulated)" : "Payout declined");
        }} />
    </div>
  );
}

/* ------------------------------------------------------------------ brand */
function BrandRewards() {
  const { campaigns, rewards } = useScope();
  const w = useMemo(() => wallet(rewards), [rewards]);
  const rows = useMemo(() => campaigns.map((c) => {
    const spend = spendOf(rewards, (t) => t.campaignId === c.id);
    const pending = rewards.filter((t) => t.campaignId === c.id && t.status === "pending").reduce((s, t) => s + t.amount, 0);
    return { c, spend, pending, util: c.budget ? (spend / c.budget) * 100 : 0, txns: rewards.filter((t) => t.campaignId === c.id && (t.type === "commission" || t.type === "bonus")).length };
  }).sort((a, b) => b.spend - a.spend), [campaigns, rewards]);
  const totalBudget = rows.reduce((s, r) => s + r.c.budget, 0);
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const chart = rows.filter((r) => r.c.budget > 0).map((r) => ({ label: r.c.name.length > 18 ? `${r.c.name.slice(0, 17)}…` : r.c.name, spend: r.spend, budget: r.c.budget }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reward spend" description="Advocate rewards paid out of your campaigns. Spend = commissions and bonuses (pending + approved), excluding reversals."
        actions={<Button variant="outline" asChild><Link to="/app/campaigns"><Megaphone />Manage campaigns</Link></Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total spend" value={formatCurrency(totalSpend)} icon={PiggyBank} tone="brand" hint="Advocate rewards accrued on your campaigns." />
        <KpiCard label="Budget utilised" value={formatPercent(totalBudget ? (totalSpend / totalBudget) * 100 : 0)} icon={Coins} tone="action" sub={<span className="num">of {formatCurrency(totalBudget, { compact: true })}</span>} />
        <KpiCard label="Pending approval" value={formatCurrency(w.pending)} icon={Clock} tone="warning" hint="Rewards for verified sales not yet approved by the platform." />
        <KpiCard label="Reversed" value={formatCurrency(w.reversed)} icon={Undo2} tone="destructive" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title="Spend vs budget" description="Lifetime advocate reward spend against each campaign's budget."
          action={<Legend items={[{ label: "Spend", color: C.c1 }, { label: "Budget", color: C.grid }]} />}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v, { compact: true })} width={56} />
                <Tooltip content={<ChartTooltip format={(v) => formatCurrency(v)} />} />
                <Bar dataKey="budget" name="Budget" fill={C.grid} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="spend" name="Spend" fill={C.c1} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>By campaign</CardTitle><CardDescription>Read-only — rewards are approved by the platform admin.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {rows.length === 0 && <EmptyState title="No campaigns yet" className="py-6" />}
            {rows.map(({ c, spend, pending, util, txns }) => (
              <div key={c.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <Link to={`/app/campaigns/${c.id}`} className="truncate font-medium hover:text-action">{c.name}</Link>
                  <span className="shrink-0 num text-muted-foreground"><span className="font-semibold text-foreground">{formatCurrency(spend)}</span> / {formatCurrency(c.budget, { compact: true })}</span>
                </div>
                <Progress value={util} indicatorClassName={cn(util >= 90 ? "bg-destructive" : util >= 70 ? "bg-warning" : "bg-brand")} />
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <StatusBadge status={c.status} className="scale-90" />
                  <span className="num">{formatPercent(util)} used</span>
                  <span className="num">{formatNumber(txns)} rewards</span>
                  {pending > 0 && <Badge variant="warning" className="num">{formatCurrency(pending)} pending</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RewardsLedger rows={rewards} showAdvocate title="Campaign reward ledger" description="Reward transactions created by your campaigns." filename="advocatex-brand-reward-ledger" />
    </div>
  );
}
