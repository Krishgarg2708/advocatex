import { Badge, type BadgeProps } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, MousePointerClick, PauseCircle, PlayCircle, ShieldCheck, Sparkles, UserCheck, XCircle } from "lucide-react";

type V = NonNullable<BadgeProps["variant"]>;
const MAP: Record<string, { label: string; variant: V; icon?: React.ComponentType<{ className?: string }> }> = {
  // referral
  clicked: { label: "Clicked", variant: "muted", icon: MousePointerClick },
  lead: { label: "Qualified lead", variant: "action", icon: UserCheck },
  pending: { label: "Pending verification", variant: "warning", icon: Clock },
  verified: { label: "Verified", variant: "positive", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  // campaign
  active: { label: "Active", variant: "positive", icon: PlayCircle },
  draft: { label: "Draft", variant: "muted", icon: CircleDashed },
  scheduled: { label: "Scheduled", variant: "action", icon: Clock },
  paused: { label: "Paused", variant: "warning", icon: PauseCircle },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  // product
  discontinued: { label: "Discontinued", variant: "muted" },
  // reward ledger
  approved: { label: "Available", variant: "positive" },
  requested: { label: "Payout requested", variant: "action" },
  paid: { label: "Paid out", variant: "secondary" },
  reversed: { label: "Reversed", variant: "destructive" },
  // fraud
  new: { label: "New", variant: "destructive", icon: Sparkles },
  under_review: { label: "Under review", variant: "warning" },
  resolved: { label: "Resolved", variant: "positive", icon: ShieldCheck },
  dismissed: { label: "Dismissed", variant: "muted" },
  // severity
  low: { label: "Low", variant: "muted" },
  medium: { label: "Medium", variant: "warning" },
  high: { label: "High", variant: "destructive", icon: AlertTriangle },
  critical: { label: "Critical", variant: "destructive", icon: AlertTriangle },
};

/** Context lets the same key ("pending", "approved", "verified") read correctly in different tables. */
const CONTEXT_OVERRIDES: Record<string, Record<string, { label: string; variant: V }>> = {
  reward: { pending: { label: "Pending approval", variant: "warning" } },
  verification: { verified: { label: "Verified", variant: "positive" }, pending: { label: "Pending approval", variant: "warning" }, rejected: { label: "Rejected", variant: "destructive" } },
  product: { active: { label: "Active", variant: "positive" } },
};

export function StatusBadge({ status, context, className }: { status: string; context?: "referral" | "campaign" | "reward" | "verification" | "flag" | "severity" | "product"; className?: string }) {
  const o = context ? CONTEXT_OVERRIDES[context]?.[status] : undefined;
  const m = MAP[status] ?? { label: status, variant: "muted" as V };
  const Icon = o ? undefined : m.icon;
  return (
    <Badge variant={(o ?? m).variant} className={className}>
      {Icon && <Icon className="h-3 w-3" />}
      {(o ?? m).label}
    </Badge>
  );
}

export const REFERRAL_STATUS_LABEL: Record<string, string> = { clicked: "Clicked", lead: "Qualified lead", pending: "Pending verification", verified: "Verified", rejected: "Rejected" };
