import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Eye, FileSearch, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { useLookups } from "@/hooks/useLookups";
import { useScope } from "@/hooks/useScope";
import { api } from "@/services/api";
import { FLAG_TYPE_LABEL } from "@/lib/insights";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import type { FlagStatus, FraudFlag } from "@/types";

type ActionKey = "under_review" | "resolved" | "dismissed" | "new";
const ACTIONS: Record<ActionKey, { label: string; title: string; description: string; confirm: string; variant: ButtonProps["variant"]; toast: string; icon: React.ComponentType<{ className?: string }> }> = {
  under_review: { label: "Mark under review", title: "Mark this alert under review?", description: "The alert stays open and is assigned to the review queue.", confirm: "Mark under review", variant: "default", toast: "Alert marked under review", icon: Eye },
  resolved: { label: "Resolve", title: "Resolve this alert?", description: "Use this when the review confirmed an issue and corrective action was taken (for example, rewards reversed).", confirm: "Resolve alert", variant: "positive", toast: "Alert resolved", icon: CircleCheck },
  dismissed: { label: "Dismiss", title: "Dismiss this alert?", description: "Use this when the activity was legitimate. The advocate is not affected.", confirm: "Dismiss alert", variant: "outline", toast: "Alert dismissed", icon: XCircle },
  new: { label: "Reopen", title: "Reopen this alert?", description: "The alert returns to the New queue for another review.", confirm: "Reopen alert", variant: "default", toast: "Alert reopened", icon: RotateCcw },
};

export function FraudFlagSheet({ flag, open, onOpenChange, canReview }: { flag?: FraudFlag; open: boolean; onOpenChange: (o: boolean) => void; canReview: boolean }) {
  const { advocate, campaignById, productById } = useLookups();
  const { referrals } = useScope(); // brand users only see referral records from their own campaigns
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [note, setNote] = useState("");

  const adv = flag ? advocate(flag.advocateId) : undefined;
  const linked = flag ? flag.referralIds.map((id) => referrals.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r) : [];
  const available: ActionKey[] = !flag ? [] : flag.status === "new" ? ["under_review", "resolved", "dismissed"] : flag.status === "under_review" ? ["resolved", "dismissed"] : ["new"];

  const run = async () => {
    if (!flag || !pending) return;
    await api.fraud.setStatus(flag.id, pending as FlagStatus, note.trim() || undefined);
    toast.success(ACTIONS[pending].toast, { description: `${flag.id} · simulated review action recorded in the audit log` });
    setNote("");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-xl">
          {flag && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{flag.id}</span>
                  <StatusBadge status={flag.severity} context="severity" />
                  <StatusBadge status={flag.status} context="flag" />
                </div>
                <SheetTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />{FLAG_TYPE_LABEL[flag.type]}</SheetTitle>
                <SheetDescription>Detected {formatDateTime(flag.detectedAt)} · {timeAgo(flag.detectedAt)}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5">
                <DemoNotice>Simulated rule-based alert. It highlights a pattern worth checking and is not proof of fraud.</DemoNotice>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</h3>
                  <p className="mt-1.5 text-sm">{flag.reason}</p>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related advocate</h3>
                  {adv ? (
                    <Link to={adv.type === "shop" ? `/app/shops?open=${adv.id}` : `/app/mechanics?open=${adv.id}`} className="mt-2 flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-action/40 hover:bg-muted/30">
                      <EntityAvatar name={adv.name} hue={adv.hue} type={adv.type} />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{adv.name}</div><div className="truncate text-xs text-muted-foreground">{adv.type === "shop" ? "Shop" : "Mechanic"} · {adv.subtitle} · {adv.city}</div></div>
                      <span className="font-mono text-[11px] text-muted-foreground">{adv.code}</span>
                    </Link>
                  ) : <p className="mt-1.5 text-sm text-muted-foreground">{flag.advocateId}</p>}
                </section>

                <section>
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FileSearch className="h-3.5 w-3.5" />Evidence</h3>
                  <ul className="mt-2 space-y-1.5">
                    {flag.evidence.map((e, i) => (
                      <li key={i} className={`rounded-md border px-3 py-2 text-[13px] ${e.startsWith("Rule:") ? "border-dashed bg-muted/40 text-muted-foreground" : "font-mono text-xs"}`}>{e}</li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked referral records ({linked.length})</h3>
                  {linked.length ? (
                    <div className="mt-2 overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Referral</TableHead><TableHead className="hidden sm:table-cell">Campaign / product</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {linked.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell><Link to={`/app/referrals?open=${r.id}`} className="font-mono text-xs font-medium text-action hover:underline">{r.id}</Link><div className="text-[11px] text-muted-foreground">{formatDateTime(r.createdAt)}</div></TableCell>
                              <TableCell className="hidden max-w-[180px] sm:table-cell"><div className="truncate text-xs">{campaignById.get(r.campaignId)?.name}</div><div className="truncate text-[11px] text-muted-foreground">{productById.get(r.productId)?.name}</div></TableCell>
                              <TableCell><StatusBadge status={r.status} /></TableCell>
                              <TableCell className="text-right text-xs num">{r.purchaseValue ? formatCurrency(r.purchaseValue) : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : <p className="mt-1.5 text-sm text-muted-foreground">No linked records in your scope.</p>}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review note</h3>
                  <p className="mt-1.5 text-sm">{flag.reviewNote ?? <span className="text-muted-foreground">No review note yet.</span>}</p>
                </section>

                {!canReview && <DemoNotice>Read-only view. Alerts are reviewed by the AdvocateX admin team.</DemoNotice>}
              </SheetBody>
              {canReview && (
                <SheetFooter>
                  {available.map((k) => {
                    const a = ACTIONS[k];
                    const Icon = a.icon;
                    return <Button key={k} variant={k === "dismissed" ? "outline" : k === "resolved" ? "positive" : "default"} onClick={() => { setNote(""); setPending(k); }}><Icon />{a.label}</Button>;
                  })}
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {pending && flag && (
        <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={ACTIONS[pending].title}
          description={<>{ACTIONS[pending].description} <span className="font-mono">{flag.id}</span> · {adv?.name}. This is a simulated review action.</>}
          confirmLabel={ACTIONS[pending].confirm} variant={ACTIONS[pending].variant} onConfirm={run}>
          <div className="grid gap-1.5">
            <Label htmlFor="flag-note">Review note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="flag-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={400} placeholder="What did you check, and what was decided?" />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
