import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BadgeCheck, Building2, CalendarDays, Check, CheckCircle2, Copy, FileText, Gift, Loader2, MapPin, Megaphone, MousePointerClick, Percent,
  Phone, Store, UserCheck, Wallet, Wrench, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { TierBadge } from "@/components/shared/TierBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { C, ChartTooltip } from "@/components/shared/charts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { api } from "@/services/api";
import { advocateTier, funnel, timeSeries, wallet } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import type { AdvocateType, DateRange } from "@/types";

const REJECT_REASONS = ["Documents incomplete", "GSTIN could not be verified", "Duplicate registration", "Outside programme locations"];
const DEFAULT_REASON = "Application did not meet verification requirements";

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function last90Range(): DateRange {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 89);
  return { preset: "custom", from: isoDay(from), to: isoDay(to) };
}

/** Approve an advocate application with a loading state + toast. Admin only. */
export function ApproveAdvocateButton({ type, id, name, size = "sm", className, label = "Approve", onDone }: {
  type: AdvocateType; id: string; name: string; size?: "sm" | "default"; className?: string; label?: string; onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size={size} variant="positive" className={className} disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          await api.advocates.setStatus(type, id, "verified");
          toast.success(`${name} approved`, { description: `Now a verified ${type === "shop" ? "shop" : "mechanic"} advocate.` });
          onDone?.();
        } finally { setBusy(false); }
      }}>
      {busy ? <Loader2 className="animate-spin" /> : <Check />}{label}
    </Button>
  );
}

/** Reject dialog with a reason — used by the drawer, directories and the approval queue. */
export function RejectAdvocateDialog({ type, id, name, open, onOpenChange, onDone }: {
  type: AdvocateType; id: string; name: string; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}
      title={`Reject ${name}?`} confirmLabel="Reject application" variant="destructive"
      description={`The ${type === "shop" ? "shop" : "mechanic"} will not be able to share referral links. The reason is recorded in the audit log.`}
      onConfirm={async () => {
        const r = reason.trim() || DEFAULT_REASON;
        await api.advocates.setStatus(type, id, "rejected", r);
        toast.success(`${name} rejected`, { description: r });
        setReason("");
        onDone?.();
      }}>
      <div className="space-y-2">
        <Label htmlFor={`reject-${id}`}>Reason</Label>
        <div className="flex flex-wrap gap-1.5">
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted", reason === r && "border-destructive/40 bg-destructive/10 text-destructive")}>{r}</button>
          ))}
        </div>
        <Textarea id={`reject-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`e.g. ${DEFAULT_REASON}`} rows={3} />
        <p className="text-[11px] text-muted-foreground">Leave blank to use the standard reason.</p>
      </div>
    </ConfirmDialog>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-[13px] font-medium">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className={cn("h-3.5 w-3.5", tone)} />{label}</div>
      <div className="mt-1 text-base font-semibold num">{value}</div>
    </div>
  );
}

/** Profile drawer for a shop or mechanic advocate, adapted per role. */
export function AdvocateDetailSheet({ type, id, open, onOpenChange }: { type: AdvocateType; id: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { role, can } = useCurrentUser();
  const scope = useScope();
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const allReferrals = useDataStore((s) => s.referrals);
  const allRewards = useDataStore((s) => s.rewards);
  const campaigns = useDataStore((s) => s.campaigns);
  const { productById, brandById } = useLookups();
  const [rejectOpen, setRejectOpen] = useState(false);

  const shop = type === "shop" && id ? shops.find((s) => s.id === id) : undefined;
  const mech = type === "mechanic" && id ? mechanics.find((m) => m.id === id) : undefined;
  const entity = shop ?? mech;
  const isCustomer = role === "customer";
  const brandScoped = role === "brand";
  const canApprove = can("approveAdvocates");
  const canSeeCampaigns = role !== "customer";

  const data = useMemo(() => {
    if (!entity) return null;
    const refSource = brandScoped ? scope.referrals : allReferrals;
    const txnSource = brandScoped ? scope.rewards : allRewards;
    const mine = refSource.filter((r) => r.advocateId === entity.id);
    const f = funnel(mine);
    const lifetimeVerified = allReferrals.filter((r) => r.advocateId === entity.id && r.status === "verified").length;
    const w = wallet(txnSource, entity.id);
    const series = timeSeries(mine, [], last90Range()).map((p) => ({ label: p.label, verified: p.verified }));
    const recent = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const visible = brandScoped ? new Set(scope.campaigns.map((c) => c.id)) : null;
    const joined = campaigns.filter((c) => entity.campaignIds.includes(c.id) && (!visible || visible.has(c.id)) && (!isCustomer || c.status === "active"));
    return { f, w, series, recent, joined, tier: advocateTier(lifetimeVerified), lifetimeVerified };
  }, [entity, brandScoped, scope, allReferrals, allRewards, campaigns, isCustomer]);

  const copyCode = async () => {
    if (!entity) return;
    const ok = await copyText(entity.referralCode);
    if (ok) toast.success("Referral code copied"); else toast.error("Could not access the clipboard");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        {!entity || !data ? (
          <>
            <SheetHeader><SheetTitle>Profile not found</SheetTitle><SheetDescription>This advocate may have been removed from the demo data.</SheetDescription></SheetHeader>
            <SheetBody><EmptyState title="Nothing to show" description="Close this panel and pick another profile." /></SheetBody>
          </>
        ) : (
          <>
            <SheetHeader className="gap-3">
              <div className="flex items-start gap-4">
                <EntityAvatar name={entity.name} hue={entity.hue} size="xl" type={type} />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg leading-tight">{entity.name}</SheetTitle>
                  <SheetDescription className="mt-0.5">{shop ? `Owned by ${shop.owner}` : mech ? mech.workshop : ""}</SheetDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {isCustomer ? <Badge variant="positive"><BadgeCheck />Verified partner</Badge> : <StatusBadge status={entity.status} context="verification" />}
                    {!isCustomer && entity.status === "verified" && <TierBadge tier={data.tier} />}
                    <Badge variant="outline">{type === "shop" ? <Store /> : <Wrench />}{shop ? shop.category : mech?.specialization}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <SheetBody className="space-y-6">
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoRow icon={MapPin} label="Location">{entity.city}, {entity.state}</InfoRow>
                <InfoRow icon={Phone} label="Contact">{entity.phone}</InfoRow>
                {shop && !isCustomer && <InfoRow icon={Building2} label="Owner">{shop.owner}</InfoRow>}
                {mech && <InfoRow icon={Wrench} label="Experience">{mech.experienceYears} years · {mech.specialization}</InfoRow>}
                {!isCustomer && <InfoRow icon={CalendarDays} label="Joined">{formatDate(entity.joinedAt)}</InfoRow>}
                {shop && !isCustomer && <InfoRow icon={FileText} label="GSTIN">{shop.gstin}</InfoRow>}
                <div className="flex items-start gap-2.5 sm:col-span-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand"><Gift className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Referral code</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{entity.referralCode}</span>
                      <Button variant="ghost" size="icon-sm" onClick={copyCode} aria-label="Copy referral code"><Copy /></Button>
                    </div>
                    {isCustomer && <p className="text-[11px] text-muted-foreground">Mention this code at checkout to earn loyalty points on eligible products.</p>}
                  </div>
                </div>
              </section>

              {!isCustomer && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Lifetime performance</h3>
                    <span className="text-[11px] text-muted-foreground">{brandScoped ? "Your brand's campaigns" : "All campaigns"}</span>
                  </div>
                  {entity.status !== "verified" && data.f.clicks === 0 ? (
                    <DemoNotice>No referral activity yet — referral links unlock once the application is approved.</DemoNotice>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Stat label="Clicks" value={formatNumber(data.f.clicks)} icon={MousePointerClick} tone="text-action" />
                      <Stat label="Qualified leads" value={formatNumber(data.f.leads)} icon={UserCheck} tone="text-brand" />
                      <Stat label="Verified" value={formatNumber(data.f.verified)} icon={CheckCircle2} tone="text-positive" />
                      <Stat label="Conversion rate" value={formatPercent(data.f.conversionRate)} icon={Percent} tone="text-positive" />
                      <Stat label="Attributed revenue" value={formatCurrency(data.f.revenue, { compact: true })} icon={Store} tone="text-brand" />
                      <Stat label="Rewards earned" value={formatCurrency(data.w.totalEarned, { compact: true })} icon={Wallet} tone="text-positive" />
                    </div>
                  )}
                </section>
              )}

              {!isCustomer && entity.status === "verified" && (
                <section>
                  <div className="mb-1 flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Verified conversions</h3>
                    <span className="text-[11px] text-muted-foreground">Weekly · last 90 days</span>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">Purchases confirmed against an invoice, grouped by week of verification.</p>
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.series} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} minTickGap={16} />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                        <Bar dataKey="verified" name="Verified" fill={C.c3} radius={[3, 3, 0, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold">{isCustomer ? "Current offers here" : "Participating campaigns"}</h3>
                {data.joined.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">{isCustomer ? "No live offers right now — check back soon." : "Not enrolled in any campaigns yet."}</p>
                ) : (
                  <div className="space-y-2">
                    {data.joined.map((c) => {
                      const inner = (
                        <>
                          <Megaphone className="h-4 w-4 shrink-0 text-action" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {brandById.get(c.brandId)?.name} · {isCustomer ? `+${c.customerBonusPoints} bonus loyalty points` : `${formatCurrency(c.rewardPerConversion)} per verified sale`}
                            </div>
                          </div>
                          {!isCustomer && <StatusBadge status={c.status} />}
                        </>
                      );
                      return canSeeCampaigns ? (
                        <Link key={c.id} to={`/app/campaigns/${c.id}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:border-action/40 hover:bg-muted/30">{inner}</Link>
                      ) : (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2.5">{inner}</div>
                      );
                    })}
                  </div>
                )}
              </section>

              {!isCustomer && data.recent.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Recent referrals</h3>
                  <div className="divide-y rounded-lg border">
                    {data.recent.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{productById.get(r.productId)?.name ?? r.productId}</div>
                          <div className="text-[11px] text-muted-foreground"><span className="font-mono">{r.id}</span> · {r.channel} · {timeAgo(r.createdAt)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <StatusBadge status={r.status} />
                          {r.purchaseValue > 0 && <span className="text-[11px] text-muted-foreground num">{formatCurrency(r.purchaseValue)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {canApprove && entity.status !== "verified" && (
                <>
                  <Separator />
                  <DemoNotice>Approval is simulated — it updates the demo data, the audit log and notifications. No real verification takes place.</DemoNotice>
                </>
              )}
            </SheetBody>

            {canApprove && entity.status !== "verified" && (
              <SheetFooter>
                {entity.status === "pending" && (
                  <Button variant="outline" onClick={() => setRejectOpen(true)}><XCircle />Reject</Button>
                )}
                <ApproveAdvocateButton type={type} id={entity.id} name={entity.name} size="default" label={entity.status === "rejected" ? "Reconsider & approve" : "Approve"} />
              </SheetFooter>
            )}
            <RejectAdvocateDialog type={type} id={entity.id} name={entity.name} open={rejectOpen} onOpenChange={setRejectOpen} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default AdvocateDetailSheet;
