import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, ClipboardCheck, Clock, History, MapPin, Store, Wallet, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AdvocateDetailSheet, ApproveAdvocateButton, RejectAdvocateDialog } from "@/components/shared/AdvocateDetailSheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { api } from "@/services/api";
import { wallet } from "@/lib/metrics";
import { formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdvocateType, Mechanic, RewardTxn, Shop } from "@/types";

type Tab = "shops" | "mechanics" | "payouts" | "decided";
interface Doc { label: string; ok: boolean }

/** Deterministic, simulated document checklist derived from the record id. */
function docsFor(type: AdvocateType, e: Shop | Mechanic): Doc[] {
  const seed = Array.from(e.id + e.name).reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const docs: Doc[] = [];
  if (type === "shop") docs.push({ label: `GSTIN ${(e as Shop).gstin}`, ok: seed % 5 !== 0 });
  docs.push({ label: type === "shop" ? "Storefront photo" : "Workshop photo", ok: seed % 3 !== 1 });
  docs.push({ label: "Owner ID verified", ok: seed % 4 !== 2 });
  docs.push({ label: "Phone number confirmed", ok: true });
  return docs;
}

function DocsChecklist({ docs }: { docs: Doc[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {docs.map((d) => (
        <li key={d.label} className={cn("inline-flex items-center gap-1 text-xs", d.ok ? "text-foreground/80" : "text-warning")}>
          {d.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-positive" /> : <Clock className="h-3.5 w-3.5" />}{d.label}{!d.ok && " — awaiting"}
        </li>
      ))}
    </ul>
  );
}

function AdvocateQueue({ type, items, onOpen }: { type: AdvocateType; items: (Shop | Mechanic)[]; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Shop | Mechanic | null>(null);
  const ids = items.map((i) => i.id);
  const sel = ids.filter((id) => selected.has(id));
  const all = items.length > 0 && sel.length === items.length;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const noun = type === "shop" ? "shop" : "mechanic";

  if (items.length === 0) {
    return <Card><EmptyState icon={CheckCircle2} title="You're all caught up" description={`No ${noun} applications are waiting for review.`}
      action={<Button variant="outline" size="sm" asChild><Link to={type === "shop" ? "/app/shops" : "/app/mechanics"}>Open {noun} directory</Link></Button>} /></Card>;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <label htmlFor={`all-${type}`} className="flex items-center gap-2 text-[13px] font-medium">
          <Checkbox id={`all-${type}`} checked={all ? true : sel.length ? "indeterminate" : false} onCheckedChange={() => setSelected(all ? new Set() : new Set(ids))} />
          {sel.length ? `${sel.length} selected` : "Select all"}
        </label>
        <div className="ml-auto flex gap-2">
          {sel.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>}
          <Button size="sm" variant="positive" disabled={sel.length === 0} onClick={() => setBulkOpen(true)}><Check />Approve selected</Button>
        </div>
      </div>
      <ul className="divide-y">
        {items.map((e) => {
          const docs = docsFor(type, e);
          const missing = docs.filter((d) => !d.ok).length;
          const shop = type === "shop" ? (e as Shop) : null;
          const mech = type === "mechanic" ? (e as Mechanic) : null;
          return (
            <li key={e.id} className={cn("flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center", selected.has(e.id) && "bg-action-soft/30")}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox className="mt-3" checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} aria-label={`Select ${e.name}`} />
                <EntityAvatar name={e.name} hue={e.hue} size="lg" type={type} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onOpen(e.id)} className="truncate text-left font-medium hover:text-action">{e.name}</button>
                    <StatusBadge status={e.status} context="verification" />
                    {missing > 0 ? <Badge variant="warning">{missing} document{missing > 1 ? "s" : ""} pending</Badge> : <Badge variant="positive">Documents complete</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{shop ? `Owner: ${shop.owner} · ${shop.category}` : `${mech!.workshop} · ${mech!.specialization} · ${mech!.experienceYears} yrs`}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.city}, {e.state}</span>
                    <span>Applied {timeAgo(e.joinedAt)}</span>
                  </div>
                  <div className="mt-2"><DocsChecklist docs={docs} /></div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 pl-7 md:pl-0">
                <Button size="sm" variant="ghost" onClick={() => onOpen(e.id)}>Details</Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(e)}><XCircle />Reject</Button>
                <ApproveAdvocateButton type={type} id={e.id} name={e.name} onDone={() => setSelected((s) => { const n = new Set(s); n.delete(e.id); return n; })} />
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog open={bulkOpen} onOpenChange={setBulkOpen} title={`Approve ${sel.length} ${noun}${sel.length === 1 ? "" : "s"}?`} confirmLabel="Approve all" variant="positive"
        description={<>
          <p>They become verified advocates and can start sharing referral links. Each approval is recorded in the audit log.</p>
          {sel.some((id) => docsFor(type, items.find((i) => i.id === id)!).some((d) => !d.ok)) && <p className="mt-2 text-warning">Some selected applications still have pending documents.</p>}
        </>}
        onConfirm={async () => {
          const names = sel.map((id) => items.find((i) => i.id === id)?.name ?? id);
          for (const id of sel) await api.advocates.setStatus(type, id, "verified");
          setSelected(new Set());
          toast.success(`${names.length} ${noun}${names.length === 1 ? "" : "s"} approved`, { description: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "") });
        }} />
      {rejecting && <RejectAdvocateDialog type={type} id={rejecting.id} name={rejecting.name} open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}
        onDone={() => setSelected((s) => { const n = new Set(s); n.delete(rejecting.id); return n; })} />}
    </Card>
  );
}

export default function Approvals() {
  const { can } = useCurrentUser();
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const rewards = useDataStore((s) => s.rewards);
  const audit = useDataStore((s) => s.audit);
  const { advocate } = useLookups();
  const [tab, setTab] = useState<Tab>("shops");
  const [sheet, setSheet] = useState<{ type: AdvocateType; id: string } | null>(null);
  const [payout, setPayout] = useState<{ txn: RewardTxn; to: "paid" | "rejected" } | null>(null);

  const pendingShops = useMemo(() => shops.filter((s) => s.status === "pending").sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)), [shops]);
  const pendingMechs = useMemo(() => mechanics.filter((m) => m.status === "pending").sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)), [mechanics]);
  const payouts = useMemo(() => rewards.filter((t) => t.type === "payout" && t.status === "requested").sort((a, b) => a.date.localeCompare(b.date)), [rewards]);
  const decided = useMemo(() => {
    const rejected = [
      ...shops.filter((s) => s.status === "rejected").map((s) => ({ type: "shop" as const, e: s as Shop | Mechanic })),
      ...mechanics.filter((m) => m.status === "rejected").map((m) => ({ type: "mechanic" as const, e: m as Shop | Mechanic })),
    ];
    const entries = audit.filter((a) => a.category === "approval" || (a.category === "reward" && /payout/i.test(a.action))).slice(0, 25);
    return { rejected, entries };
  }, [shops, mechanics, audit]);

  if (!can("approveAdvocates")) {
    return <Card><EmptyState icon={ClipboardCheck} title="Admins only" description="The approval queue is available to platform administrators." /></Card>;
  }

  const payoutTotal = payouts.reduce((s, t) => s + t.amount, 0);
  const tabCount = (n: number) => <span className={cn("rounded-full px-1.5 text-[11px] num", n ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground")}>{n}</span>;

  return (
    <div className="space-y-6">
      <PageHeader title="Approval queue" description="Review advocate applications and payout requests. Every decision updates the directories, dashboards and audit log." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Shops awaiting review" value={String(pendingShops.length)} icon={Store} tone={pendingShops.length ? "warning" : "positive"} hint="Shop applications pending verification." />
        <KpiCard label="Mechanics awaiting review" value={String(pendingMechs.length)} icon={Wrench} tone={pendingMechs.length ? "warning" : "positive"} hint="Mechanic applications pending verification." />
        <KpiCard label="Payout requests" value={String(payouts.length)} icon={Wallet} tone="action" hint="Advocate withdrawal requests (simulated)." sub={<span>{formatCurrency(payoutTotal)} requested</span>} />
        <KpiCard label="Oldest pending" value={(() => { const o = [...pendingShops, ...pendingMechs].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]; return o ? timeAgo(o.joinedAt) : "—"; })()} icon={Clock} tone="neutral" hint="Age of the oldest application in the queue." />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="shops" className="gap-1.5"><Store className="h-3.5 w-3.5" />Shops {tabCount(pendingShops.length)}</TabsTrigger>
          <TabsTrigger value="mechanics" className="gap-1.5"><Wrench className="h-3.5 w-3.5" />Mechanics {tabCount(pendingMechs.length)}</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5"><Wallet className="h-3.5 w-3.5" />Payout requests {tabCount(payouts.length)}</TabsTrigger>
          <TabsTrigger value="decided" className="gap-1.5"><History className="h-3.5 w-3.5" />Recently decided</TabsTrigger>
        </TabsList>

        <TabsContent value="shops" className="mt-4 space-y-3">
          <AdvocateQueue type="shop" items={pendingShops} onOpen={(id) => setSheet({ type: "shop", id })} />
          <DemoNotice>Document checks are simulated from demo data. Approvals update local state only — no real KYC or GST verification takes place.</DemoNotice>
        </TabsContent>
        <TabsContent value="mechanics" className="mt-4 space-y-3">
          <AdvocateQueue type="mechanic" items={pendingMechs} onOpen={(id) => setSheet({ type: "mechanic", id })} />
          <DemoNotice>Document checks are simulated from demo data. Approvals update local state only.</DemoNotice>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4 space-y-3">
          {payouts.length === 0 ? (
            <Card><EmptyState icon={CheckCircle2} title="You're all caught up" description="No payout requests are waiting. Advocates request payouts from their reward wallet." /></Card>
          ) : (
            <Card>
              <ul className="divide-y">
                {payouts.map((t) => {
                  const a = advocate(t.advocateId);
                  const w = wallet(rewards, t.advocateId);
                  return (
                    <li key={t.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <EntityAvatar name={a?.name ?? t.advocateId} hue={a?.hue} size="lg" type={t.advocateType} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => setSheet({ type: t.advocateType, id: t.advocateId })} className="truncate text-left font-medium hover:text-action">{a?.name ?? t.advocateId}</button>
                          <div className="text-xs text-muted-foreground">{a?.subtitle} · {a?.city} · requested {formatDateTime(t.date)}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground num">Lifetime earned {formatCurrency(w.totalEarned)} · paid out {formatCurrency(w.paidOut)} · ref <span className="font-mono">{t.id}</span></div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-[60px] md:pl-0">
                        <div className="text-right"><div className="text-lg font-semibold num">{formatCurrency(t.amount)}</div><StatusBadge status={t.status} /></div>
                        <Button size="sm" variant="outline" onClick={() => setPayout({ txn: t, to: "rejected" })}><XCircle />Decline</Button>
                        <Button size="sm" variant="positive" onClick={() => setPayout({ txn: t, to: "paid" })}><Check />Approve</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <DemoNotice>Payouts are simulated. Approving marks the request as paid in the demo ledger — no money moves and no bank transfer is made.</DemoNotice>
        </TabsContent>

        <TabsContent value="decided" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Rejected applications</CardTitle><CardDescription>Can be reconsidered from the profile drawer</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {decided.rejected.length === 0 && <EmptyState title="No rejected applications" className="py-6" />}
                {decided.rejected.map(({ type, e }) => (
                  <button key={e.id} type="button" onClick={() => setSheet({ type, id: e.id })} className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/40">
                    <EntityAvatar name={e.name} hue={e.hue} type={type} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{e.name}</div><div className="text-[11px] text-muted-foreground">{type === "shop" ? "Shop" : "Mechanic"} · {e.city} · applied {formatDate(e.joinedAt)}</div></div>
                    <StatusBadge status="rejected" context="verification" />
                  </button>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div><CardTitle>Decision log</CardTitle><CardDescription className="mt-1">Approvals, rejections and payout decisions</CardDescription></div>
                <Button variant="ghost" size="sm" asChild><Link to="/app/audit">Full audit log</Link></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {decided.entries.length === 0 && <EmptyState title="No decisions yet" className="py-6" />}
                {decided.entries.map((a) => {
                  const negative = /reject|declin/i.test(a.action);
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", negative ? "bg-destructive/10 text-destructive" : "bg-positive-soft text-positive")}>
                        {negative ? <XCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1 text-[13px]">
                        <div><span className="font-medium">{a.action}</span> · {a.target}</div>
                        <div className="text-[11px] text-muted-foreground">{a.actor} · {timeAgo(a.at)}{a.details && ` · ${a.details}`}</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!payout} onOpenChange={(o) => !o && setPayout(null)}
        title={payout?.to === "paid" ? `Approve ${formatCurrency(payout?.txn.amount ?? 0)} payout?` : `Decline ${formatCurrency(payout?.txn.amount ?? 0)} payout?`}
        confirmLabel={payout?.to === "paid" ? "Approve payout" : "Decline request"} variant={payout?.to === "paid" ? "positive" : "destructive"}
        description={payout?.to === "paid"
          ? `This is simulated: the request from ${advocate(payout.txn.advocateId)?.name ?? ""} is marked as paid in the demo ledger. No money moves.`
          : `The request is removed and the amount returns to ${advocate(payout?.txn.advocateId ?? "")?.name ?? "the advocate"}'s available balance. Simulated — no money moves.`}
        onConfirm={async () => {
          if (!payout) return;
          await api.rewards.setPayoutStatus(payout.txn.id, payout.to);
          toast.success(payout.to === "paid" ? "Payout approved (simulated)" : "Payout declined", { description: `${advocate(payout.txn.advocateId)?.name} · ${formatCurrency(payout.txn.amount)}` });
        }}>
        {payout?.to === "paid" && <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-xs"><Wallet className="h-4 w-4 text-positive" />Simulated payout — demo ledger only.</div>}
      </ConfirmDialog>

      <AdvocateDetailSheet type={sheet?.type ?? "shop"} id={sheet?.id ?? null} open={!!sheet} onOpenChange={(o) => !o && setSheet(null)} />
    </div>
  );
}
