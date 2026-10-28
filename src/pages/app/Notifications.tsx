import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Bell, BellOff, CheckCheck, CheckCircle2, Circle, ClipboardCheck, Gift, Info, Megaphone, ShieldAlert, Wallet, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDataStore } from "@/store/data";
import { DAY_MS } from "@/lib/metrics";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";

const TYPE_META: Record<NotificationType, { label: string; icon: LucideIcon; tone: string }> = {
  campaign: { label: "Campaigns", icon: Megaphone, tone: "bg-brand-soft text-brand" },
  conversion: { label: "Conversions", icon: CheckCircle2, tone: "bg-positive-soft text-positive" },
  reward: { label: "Rewards", icon: Wallet, tone: "bg-warning-soft text-warning" },
  loyalty: { label: "Loyalty", icon: Gift, tone: "bg-ai-soft text-ai" },
  approval: { label: "Approvals", icon: ClipboardCheck, tone: "bg-action-soft text-action" },
  fraud: { label: "Fraud", icon: ShieldAlert, tone: "bg-destructive/10 text-destructive" },
  system: { label: "System", icon: Info, tone: "bg-muted text-muted-foreground" },
};
const TYPES = Object.keys(TYPE_META) as NotificationType[];

function groupOf(iso: string): "Today" | "This week" | "Earlier" {
  const d = new Date(iso);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (d.getTime() >= start.getTime()) return "Today";
  if (d.getTime() >= start.getTime() - 6 * DAY_MS) return "This week";
  return "Earlier";
}

export default function Notifications() {
  const { role } = useCurrentUser();
  const all = useDataStore((s) => s.notifications);
  const markRead = useDataStore((s) => s.markNotificationRead);
  const markAll = useDataStore((s) => s.markAllNotificationsRead);
  const navigate = useNavigate();
  const [view, setView] = useState<"all" | "unread">("all");
  const [type, setType] = useState<NotificationType | "all">("all");

  const mine = useMemo(() => all.filter((n) => n.roles.includes(role)).sort((a, b) => b.at.localeCompare(a.at)), [all, role]);
  const unread = mine.filter((n) => !n.read).length;
  const base = useMemo(() => (view === "unread" ? mine.filter((n) => !n.read) : mine), [mine, view]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of base) m.set(n.type, (m.get(n.type) ?? 0) + 1);
    return m;
  }, [base]);
  const shown = useMemo(() => (type === "all" ? base : base.filter((n) => n.type === type)), [base, type]);
  const groups = useMemo(() => {
    const g: Record<string, AppNotification[]> = { Today: [], "This week": [], Earlier: [] };
    for (const n of shown) g[groupOf(n.at)]!.push(n);
    return (["Today", "This week", "Earlier"] as const).map((k) => ({ label: k, items: g[k]! })).filter((x) => x.items.length);
  }, [shown]);

  const open = (n: AppNotification) => {
    if (!n.read) markRead(n.id, true);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Campaign launches, conversions, reward updates and alerts relevant to your role."
        actions={<Button variant="outline" disabled={!unread} onClick={() => { markAll(role); toast.success("All notifications marked as read"); }}><CheckCheck />Mark all as read</Button>} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={view} onValueChange={(v) => setView(v as "all" | "unread")}>
            <TabsList>
              <TabsTrigger value="all">All <span className="ml-1 text-xs text-muted-foreground num">{mine.length}</span></TabsTrigger>
              <TabsTrigger value="unread">Unread {unread > 0 && <Badge variant="destructive" className="ml-1 num">{unread}</Badge>}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
            <TypeChip active={type === "all"} onClick={() => setType("all")} label="All types" count={base.length} />
            {TYPES.filter((t) => counts.get(t) || type === t).map((t) => {
              const Icon = TYPE_META[t].icon;
              return <TypeChip key={t} active={type === t} onClick={() => setType(t)} label={TYPE_META[t].label} count={counts.get(t) ?? 0} icon={<Icon className="h-3.5 w-3.5" />} />;
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={view === "unread" ? CheckCheck : BellOff} title={view === "unread" ? "You're all caught up" : "No notifications"}
            description={view === "unread" ? "No unread notifications. New activity will appear here." : type !== "all" ? "Nothing of this type yet." : "Activity relevant to your role will appear here."}
            action={(type !== "all" || view !== "all") ? <Button variant="outline" size="sm" onClick={() => { setType("all"); setView("all"); }}>Show all notifications</Button> : undefined} />
        ) : (
          <div>
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">{g.label}</h2>
                <ul className="divide-y">
                  {g.items.map((n) => {
                    const meta = TYPE_META[n.type];
                    const Icon = meta.icon;
                    return (
                      <li key={n.id} className={cn("group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40", !n.read && "bg-action-soft/20")}>
                        <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none" aria-label={`${n.title}${n.read ? "" : " (unread)"}`}>
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tone)}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2">
                              <span className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                              <span className="text-xs text-muted-foreground" title={formatDateTime(n.at)}>{timeAgo(n.at)}</span>
                            </span>
                            <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.body}</span>
                            <span className="mt-1 inline-block text-[11px] text-muted-foreground">{meta.label.replace(/s$/, "")}{n.link ? " · Click to open" : ""}</span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          {!n.read && <span className="h-2 w-2 rounded-full bg-action" aria-hidden />}
                          <Hint content={n.read ? "Mark as unread" : "Mark as read"}>
                            <Button variant="ghost" size="icon-sm" aria-label={n.read ? "Mark as unread" : "Mark as read"} onClick={() => markRead(n.id, !n.read)}>
                              {n.read ? <Circle /> : <CheckCheck />}
                            </Button>
                          </Hint>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="h-3.5 w-3.5" />Notifications are generated by demo activity in this browser. Email and push delivery preferences live in Settings — nothing is actually sent.</p>
    </div>
  );
}

function TypeChip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors", active ? "border-action bg-action-soft text-action" : "bg-card text-muted-foreground hover:text-foreground")}>
      {icon}{label}<span className="num opacity-70">{count}</span>
    </button>
  );
}
