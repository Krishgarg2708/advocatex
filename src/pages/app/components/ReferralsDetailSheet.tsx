import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeCheck, CheckCircle2, CircleDashed, Clock, FileText, Loader2, MousePointerClick, Package, Megaphone, Radio, ShieldCheck, UserCheck, XCircle,
} from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { useDataStore } from "@/store/data";
import { useLookups } from "@/hooks/useLookups";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/services/api";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Referral } from "@/types";

interface TimelineItem { key: string; title: string; description: string; at?: string; icon: React.ComponentType<{ className?: string }>; tone: "muted" | "action" | "warning" | "positive" | "destructive"; future?: boolean }
const TONE: Record<TimelineItem["tone"], string> = {
  muted: "bg-muted text-muted-foreground",
  action: "bg-action-soft text-action",
  warning: "bg-warning-soft text-warning",
  positive: "bg-positive-soft text-positive",
  destructive: "bg-destructive/10 text-destructive",
};

function buildTimeline(r: Referral, rewardIfVerified: number): TimelineItem[] {
  const items: TimelineItem[] = [
    { key: "click", title: "Referral link opened", description: `Visitor ${r.customerRef} opened the advocate's ${r.channel === "QR" ? "QR code" : r.channel === "In-store" ? "in-store referral" : `${r.channel} link`}. A click is not a sale.`, at: r.createdAt, icon: MousePointerClick, tone: "muted" },
  ];
  if (r.leadAt) items.push({ key: "lead", title: "Qualified lead", description: "Customer shared contact details or visited the outlet.", at: r.leadAt, icon: UserCheck, tone: "action" });
  if (r.purchaseAt) items.push({ key: "purchase", title: "Purchase claimed", description: `Invoice ${r.txnRef ?? "—"} for ${formatCurrency(r.purchaseValue)} submitted for verification.`, at: r.purchaseAt, icon: FileText, tone: "warning" });
  if (r.verifiedAt) items.push({ key: "verified", title: "Purchase verified", description: `Invoice matched. ${formatCurrency(r.reward)} advocate reward queued for approval.`, at: r.verifiedAt, icon: CheckCircle2, tone: "positive" });
  if (r.rejectedAt) items.push({ key: "rejected", title: "Claim rejected", description: r.rejectReason ? `Reason: ${r.rejectReason}` : "The purchase claim could not be verified.", at: r.rejectedAt, icon: XCircle, tone: "destructive" });
  // upcoming steps so the funnel position is obvious
  if (r.status === "clicked") items.push({ key: "next", title: "Awaiting qualified lead", description: "No customer details or visit recorded yet.", icon: CircleDashed, tone: "muted", future: true });
  if (r.status === "lead") items.push({ key: "next", title: "Awaiting purchase", description: "The customer has not claimed a purchase yet.", icon: CircleDashed, tone: "muted", future: true });
  if (r.status === "pending") items.push({ key: "next", title: "Awaiting verification", description: `On verification the advocate earns ${formatCurrency(rewardIfVerified)} (pending approval).`, icon: Clock, tone: "warning", future: true });
  return items;
}

export function ReferralsDetailSheet({ id, onClose, inScope }: { id: string | null; onClose: () => void; inScope?: (r: Referral) => boolean }) {
  const found = useDataStore((s) => (id ? s.referrals.find((r) => r.id === id) : undefined));
  const referral = found && (!inScope || inScope(found)) ? found : undefined;
  const { advocate, campaignById, productById, brandById } = useLookups();
  const { can, role } = useCurrentUser();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { setReason(""); setReasonError(null); }, [id]);

  const camp = referral ? campaignById.get(referral.campaignId) : undefined;
  const product = referral ? productById.get(referral.productId) : undefined;
  const adv = referral ? advocate(referral.advocateId) : undefined;
  const rewardIfVerified = referral ? referral.reward || camp?.rewardPerConversion || 0 : 0;
  const timeline = useMemo(() => (referral ? buildTimeline(referral, rewardIfVerified) : []), [referral, rewardIfVerified]);
  const canAct = !!referral && referral.status === "pending" && can("verifyReferrals");

  const doReject = async () => {
    const r = reason.trim();
    if (r.length < 5) { setReasonError("Please give a reason of at least 5 characters."); return; }
    if (!referral || rejecting) return;
    setRejecting(true);
    try {
      await api.referrals.reject(referral.id, r);
      toast.success("Purchase claim rejected", { description: `${referral.id} will not earn a reward.` });
      setRejectOpen(false); setReason("");
    } finally { setRejecting(false); }
  };

  return (
    <>
      <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-lg">
          {!referral ? (
            <SheetHeader><SheetTitle>Referral not found</SheetTitle><SheetDescription>This record may have been removed by a demo data reset.</SheetDescription></SheetHeader>
          ) : (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="font-mono">{referral.id}</SheetTitle>
                  <StatusBadge status={referral.status} />
                </div>
                <SheetDescription>Clicked {formatDateTime(referral.createdAt)} · {timeAgo(referral.createdAt)}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Purchase value</div><div className="mt-0.5 text-lg font-semibold num">{referral.purchaseValue ? formatCurrency(referral.purchaseValue) : "—"}</div></div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Advocate reward</div>
                    <div className={cn("mt-0.5 text-lg font-semibold num", referral.status === "verified" && "text-positive")}>{referral.status === "verified" || referral.status === "pending" ? formatCurrency(referral.status === "pending" ? rewardIfVerified : referral.reward) : "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{referral.status === "verified" ? "Earned · verified" : referral.status === "pending" ? "If verified" : "Only verified sales earn"}</div>
                  </div>
                </div>

                {adv && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advocate</h3>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <EntityAvatar name={adv.name} hue={adv.hue} type={adv.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium">{adv.name}{adv.status === "verified" && <BadgeCheck className="h-3.5 w-3.5 text-positive" aria-label="Verified advocate" />}</div>
                        <div className="truncate text-xs text-muted-foreground">{adv.subtitle} · {adv.city}</div>
                      </div>
                      <Badge variant="outline" className="capitalize">{adv.type}</Badge>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record</h3>
                  <dl className="divide-y rounded-lg border text-sm">
                    {[
                      ["Referral code", <code key="c" className="font-mono text-xs">{referral.code}</code>],
                      ["Customer identifier", <span key="cu" className="font-mono text-xs">{referral.customerRef}</span>],
                      ["Channel", <span key="ch" className="inline-flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-muted-foreground" />{referral.channel}</span>],
                      ["Invoice / txn ref", <span key="t" className="font-mono text-xs">{referral.txnRef ?? "—"}</span>],
                      ["Product", <span key="p" className="inline-flex items-center gap-1.5 text-right"><Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{product?.name ?? referral.productId}</span>],
                      ["Campaign", camp ? <Link key="cm" to={`/app/campaigns/${camp.id}`} className="inline-flex items-center gap-1.5 text-right text-action hover:underline"><Megaphone className="h-3.5 w-3.5 shrink-0" />{camp.name}</Link> : referral.campaignId],
                      ["Brand", camp ? brandById.get(camp.brandId)?.name ?? "—" : "—"],
                      ["Reward rule", camp ? `${formatCurrency(camp.rewardPerConversion)} per verified sale` : "—"],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex items-start justify-between gap-4 px-3 py-2.5">
                        <dt className="shrink-0 text-muted-foreground">{k}</dt>
                        <dd className="min-w-0 text-right font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event timeline</h3>
                  <ol className="relative space-y-4">
                    {timeline.map((e, i) => {
                      const Icon = e.icon;
                      return (
                        <li key={e.key} className="relative flex gap-3">
                          {i < timeline.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-border" aria-hidden />}
                          <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE[e.tone], e.future && "border border-dashed bg-card")}><Icon className="h-4 w-4" /></span>
                          <div className={cn("min-w-0 pt-0.5", e.future && "opacity-70")}>
                            <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">{e.title}{e.at && <span className="text-xs font-normal text-muted-foreground">{formatDateTime(e.at)}</span>}</div>
                            <p className="text-[13px] text-muted-foreground">{e.description}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                {referral.status === "pending" && !can("verifyReferrals") && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 text-[13px]">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{role === "shop" || role === "mechanic" ? "The brand is checking this invoice. Your reward is added once the purchase is verified." : "Only admins and brand managers can verify purchases."}</span>
                  </div>
                )}
                {canAct && <DemoNotice>Verification is simulated: it updates referral status, the advocate's wallet and dashboards in this browser only.</DemoNotice>}
              </SheetBody>
              {canAct && (
                <SheetFooter>
                  <Button variant="outline" onClick={() => setRejectOpen(true)}><XCircle />Reject claim</Button>
                  <Button variant="positive" onClick={() => setVerifyOpen(true)}><ShieldCheck />Mark purchase as verified</Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {referral && (
        <ConfirmDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          title="Verify this purchase?"
          confirmLabel="Verify purchase"
          variant="positive"
          description={<>
            <p>Invoice <span className="font-mono">{referral.txnRef ?? "—"}</span> for {formatCurrency(referral.purchaseValue)} will be marked as a verified conversion.</p>
            <p className="mt-2">{adv?.name ?? "The advocate"} earns <span className="font-semibold text-foreground">{formatCurrency(rewardIfVerified)}</span>, queued for reward approval. This is a simulated action.</p>
          </>}
          onConfirm={async () => {
            await api.referrals.verify(referral.id);
            toast.success("Purchase verified", { description: `${formatCurrency(rewardIfVerified)} reward queued for approval.` });
          }}
        />
      )}

      <Dialog open={rejectOpen} onOpenChange={(o) => !rejecting && setRejectOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject purchase claim</DialogTitle>
            <DialogDescription>The referral will be marked as rejected and will not earn a reward. The advocate can see the reason.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">Reason (required)</Label>
            <Textarea id="reject-reason" rows={3} value={reason} aria-invalid={!!reasonError} placeholder="e.g. Invoice number does not match the outlet's sales register"
              onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(null); }} />
            {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={rejecting} onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={rejecting} onClick={doReject}>{rejecting && <Loader2 className="animate-spin" />}Reject claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
