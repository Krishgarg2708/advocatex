import { Link } from "react-router-dom";
import { CheckCircle2, CircleDot, Clock, ExternalLink, MousePointerClick, ShoppingCart, UserCheck, XCircle } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { useLookups } from "@/hooks/useLookups";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Referral } from "@/types";
import { cn } from "@/lib/utils";

/** Read-only referral detail drawer used by dashboard tables. Actions live on the Referrals page. */
export function ReferralDetailSheet({ referral, onOpenChange }: { referral: Referral | null; onOpenChange: (open: boolean) => void }) {
  const { advocate, campaignById, productById, brandById } = useLookups();
  const r = referral;
  const adv = r ? advocate(r.advocateId) : undefined;
  const camp = r ? campaignById.get(r.campaignId) : undefined;
  const prod = r ? productById.get(r.productId) : undefined;

  const steps = r ? [
    { label: "Referral click", at: r.createdAt, icon: MousePointerClick, done: true },
    { label: "Qualified lead", at: r.leadAt, icon: UserCheck, done: !!r.leadAt },
    { label: "Purchase claimed", at: r.purchaseAt, icon: ShoppingCart, done: !!r.purchaseAt },
    r.status === "rejected"
      ? { label: "Rejected", at: r.rejectedAt, icon: XCircle, done: true, bad: true }
      : { label: r.status === "pending" ? "Awaiting verification" : "Verified conversion", at: r.verifiedAt, icon: r.status === "pending" ? Clock : CheckCircle2, done: !!r.verifiedAt },
  ] : [];

  return (
    <Sheet open={!!r} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        {r && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><SheetTitle className="font-mono">{r.id}</SheetTitle><StatusBadge status={r.status} /></div>
              <SheetDescription>{camp?.name ?? r.campaignId} · {r.channel}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              {adv && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <EntityAvatar name={adv.name} hue={adv.hue} type={adv.type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{adv.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{adv.subtitle} · {adv.city}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{adv.type}</Badge>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Customer</dt><dd className="font-mono text-xs">{r.customerRef}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Referral code</dt><dd className="font-mono text-xs">{r.code}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Product</dt><dd>{prod?.name ?? r.productId}<span className="text-xs text-muted-foreground">{prod ? ` · ${brandById.get(prod.brandId)?.name ?? ""}` : ""}</span></dd></div>
                <div><dt className="text-xs text-muted-foreground">Purchase value</dt><dd className="font-medium num">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Advocate reward</dt><dd className="font-medium num">{r.status === "verified" || r.status === "pending" ? formatCurrency(r.reward) : "—"}</dd></div>
                {r.txnRef && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Invoice reference</dt><dd className="font-mono text-xs">{r.txnRef}</dd></div>}
                {r.rejectReason && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Rejection reason</dt><dd className="text-destructive">{r.rejectReason}</dd></div>}
              </dl>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle</h3>
                <ol className="relative space-y-4 border-l pl-5">
                  {steps.map((s) => (
                    <li key={s.label} className="relative">
                      <span className={cn("absolute -left-[29px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-card",
                        !s.done ? "bg-muted text-muted-foreground" : "bad" in s && s.bad ? "bg-destructive text-white" : "bg-positive text-white")}>
                        {s.done ? <s.icon className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
                      </span>
                      <div className={cn("text-sm font-medium", !s.done && "text-muted-foreground")}>{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.at ? formatDateTime(s.at) : "Not reached"}</div>
                    </li>
                  ))}
                </ol>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button asChild><Link to={`/app/referrals?open=${r.id}`}><ExternalLink />Open in Referrals</Link></Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
