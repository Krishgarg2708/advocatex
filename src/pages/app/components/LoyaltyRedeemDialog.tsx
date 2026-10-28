import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Copy, Gift, Loader2, Lock, PackageX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { TierBadge } from "@/components/shared/TierBadge";
import { api } from "@/services/api";
import { copyText } from "@/lib/clipboard";
import { formatNumber } from "@/lib/format";
import { tierRank } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { LoyaltyTier, Redemption, RewardItem } from "@/types";

export function LoyaltyRedeemDialog({ item, onOpenChange, customerId, balance, tier, remaining }: {
  item: RewardItem | null; onOpenChange: (o: boolean) => void; customerId: string; balance: number; tier: LoyaltyTier; remaining: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Redemption | null>(null);
  const [copied, setCopied] = useState(false);
  const inFlight = useRef(false);
  // freeze the balance shown in the success state at the moment of redemption
  const [balanceBefore, setBalanceBefore] = useState(balance);

  useEffect(() => { if (item) { setError(null); setSuccess(null); setCopied(false); setBalanceBefore(balance); } }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const tierLocked = !!item.minTier && tierRank(tier) < tierRank(item.minTier);
  const outOfStock = remaining <= 0;
  const short = Math.max(0, item.points - balance);
  const blocked = tierLocked || outOfStock || short > 0;
  const shownBalance = success ? balanceBefore : balance;
  const after = shownBalance - item.points;

  const redeem = async () => {
    if (inFlight.current || blocked) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const res = await api.loyalty.redeem(customerId, item.id);
      if (res.ok) {
        setSuccess(res.redemption);
        toast.success("Reward redeemed (simulated)", { description: `${item.title} · code ${res.redemption.code}` });
      } else setError(res.error);
    } finally { inFlight.current = false; setBusy(false); }
  };

  const copy = async () => {
    if (!success) return;
    const ok = await copyText(success.code);
    if (ok) { setCopied(true); toast.success("Redemption code copied"); setTimeout(() => setCopied(false), 1800); } else toast.error("Could not access the clipboard");
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        {success ? (
          <>
            <div className="flex flex-col items-center pt-2 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive"><CheckCircle2 className="h-6 w-6" /></span>
              <DialogTitle>Reward redeemed</DialogTitle>
              <DialogDescription className="mt-1">{item.title} — show this code at a participating outlet.</DialogDescription>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-center">
              <div className="text-xs text-muted-foreground">Redemption code</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <code className="font-mono text-xl font-semibold tracking-widest">{success.code}</code>
                <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy redemption code">{copied ? <Check className="text-positive" /> : <Copy />}</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted/60 p-2"><div className="text-xs text-muted-foreground">Points used</div><div className="font-semibold num">{formatNumber(item.points)}</div></div>
              <div className="rounded-lg bg-muted/60 p-2"><div className="text-xs text-muted-foreground">New balance</div><div className="font-semibold num">{formatNumber(after)}</div></div>
            </div>
            <DemoNotice>Simulated demo redemption — the code is not valid at real outlets.</DemoNotice>
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Redeem reward</DialogTitle>
              <DialogDescription>Review the details before confirming. Points are deducted immediately.</DialogDescription>
            </DialogHeader>
            {/* 1. reward details */}
            <div className="flex gap-3 rounded-lg border p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai"><Gift className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{item.title}</span><Badge variant="secondary">{item.category}</Badge>{item.minTier && <TierBadge tier={item.minTier} />}</div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground num">{outOfStock ? "Out of stock" : `${remaining} left in stock`}</p>
              </div>
            </div>
            {/* 2–3. points & balance */}
            <dl className="divide-y rounded-lg border text-sm">
              <div className="flex justify-between px-3 py-2.5"><dt className="text-muted-foreground">Required points</dt><dd className="font-semibold num">{formatNumber(item.points)}</dd></div>
              <div className="flex justify-between px-3 py-2.5"><dt className="text-muted-foreground">Current balance</dt><dd className="font-medium num">{formatNumber(balance)}</dd></div>
              <div className="flex justify-between px-3 py-2.5"><dt className="text-muted-foreground">Balance after redemption</dt><dd className={cn("font-semibold num", after < 0 ? "text-destructive" : "text-positive")}>{after < 0 ? "—" : formatNumber(after)}</dd></div>
            </dl>
            {(blocked || error) && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive" role="alert">
                {outOfStock ? <PackageX className="mt-0.5 h-4 w-4 shrink-0" /> : tierLocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{error ?? (outOfStock ? "This reward is out of stock." : tierLocked ? `This reward requires ${item.minTier} tier or above. You're currently ${tier}.` : `Insufficient points — you need ${formatNumber(short)} more points.`)}</span>
              </div>
            )}
            <DemoNotice>Simulated demo redemption. No real voucher or service is issued.</DemoNotice>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="ai" disabled={busy || blocked} onClick={redeem}>{busy && <Loader2 className="animate-spin" />}Confirm redemption</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
