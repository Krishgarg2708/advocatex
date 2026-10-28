import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/services/api";
import { DAY_MS } from "@/lib/metrics";
import type { Campaign, CampaignStatus } from "@/types";

export const budgetTone = (util: number) => (util > 85 ? "bg-warning" : "bg-positive");

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Ends in 12 days" / "Starts in 3 days" / "Ended 4 Oct" style label. */
export function campaignTiming(c: Campaign): { label: string; urgent: boolean } {
  const now = Date.now();
  const start = new Date(`${c.startDate}T00:00:00`).getTime();
  const end = new Date(`${c.endDate}T23:59:59`).getTime();
  if (c.status === "completed" || end < now) return { label: "Ended", urgent: false };
  if (start > now) { const d = Math.ceil((start - now) / DAY_MS); return { label: `Starts in ${d} day${d === 1 ? "" : "s"}`, urgent: false }; }
  const d = Math.ceil((end - now) / DAY_MS);
  return { label: d <= 1 ? "Ends today" : `Ends in ${d} days`, urgent: d <= 7 };
}

export type StatusAction = { to: CampaignStatus; label: string; title: string; description: string; variant: "default" | "destructive" | "positive" | "outline" };

/** Allowed status transitions offered to admin/brand users. */
export function statusActions(c: Campaign): StatusAction[] {
  const startsLater = c.startDate > isoToday();
  const launch: StatusAction = startsLater
    ? { to: "scheduled", label: "Schedule", title: `Schedule "${c.name}"?`, description: `It will go live automatically on ${new Date(c.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} and become visible to eligible advocates.`, variant: "positive" }
    : { to: "active", label: c.status === "paused" ? "Resume" : "Activate", title: `Activate "${c.name}"?`, description: "Eligible advocates can share it immediately and verified conversions will start accruing rewards against the budget.", variant: "positive" };
  const pause: StatusAction = { to: "paused", label: "Pause", title: `Pause "${c.name}"?`, description: "Referral links stop accruing new rewards until you resume. Existing pending verifications are unaffected.", variant: "destructive" };
  const complete: StatusAction = { to: "completed", label: "Mark completed", title: `Complete "${c.name}"?`, description: "The campaign ends for all advocates. This can't be resumed from the demo UI, but historic results remain.", variant: "destructive" };
  switch (c.status) {
    case "active": return [pause, complete];
    case "paused": return [launch, complete];
    case "draft": return [launch];
    case "scheduled": return [{ ...launch, to: "active", label: "Activate now", title: `Activate "${c.name}" now?`, description: "Starts the campaign immediately, ahead of its scheduled date." }, { to: "draft", label: "Move to draft", title: `Move "${c.name}" back to draft?`, description: "It will no longer go live automatically.", variant: "outline" }];
    default: return [];
  }
}

const DONE: Record<CampaignStatus, string> = { active: "Campaign activated", paused: "Campaign paused", completed: "Campaign completed", scheduled: "Campaign scheduled", draft: "Moved to draft" };

/** Controlled confirm dialog for a pending status action. */
export function CampaignStatusConfirm({ campaign, action, onClose }: { campaign: Campaign | null; action: StatusAction | null; onClose: () => void }) {
  return (
    <ConfirmDialog open={!!campaign && !!action} onOpenChange={(o) => !o && onClose()}
      title={action?.title ?? ""} description={action?.description} confirmLabel={action?.label ?? "Confirm"}
      variant={action?.variant === "outline" ? "default" : action?.variant}
      onConfirm={async () => {
        if (!campaign || !action) return;
        await api.campaigns.setStatus(campaign.id, action.to);
        toast.success(DONE[action.to], { description: campaign.name });
      }} />
  );
}

export function useStatusAction() {
  const [state, setState] = useState<{ campaign: Campaign; action: StatusAction } | null>(null);
  return {
    request: (campaign: Campaign, action: StatusAction) => setState({ campaign, action }),
    dialog: <CampaignStatusConfirm campaign={state?.campaign ?? null} action={state?.action ?? null} onClose={() => setState(null)} />,
  };
}
