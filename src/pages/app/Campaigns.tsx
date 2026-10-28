import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Coins, Loader2, Megaphone, MoreHorizontal, MousePointerClick, Pencil, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { SearchInput } from "@/components/shared/table-kit";
import { SortControl } from "@/pages/app/components/DirectoryKit";
import { budgetTone, campaignTiming, statusActions, useStatusAction } from "@/pages/app/components/CampaignKit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { campaignParticipants, campaignStats, type CampaignStats } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, CampaignStatus } from "@/types";

type Tab = "all" | CampaignStatus;
const TABS: { v: Tab; label: string }[] = [
  { v: "all", label: "All" }, { v: "active", label: "Active" }, { v: "draft", label: "Draft" }, { v: "scheduled", label: "Scheduled" }, { v: "paused", label: "Paused" }, { v: "completed", label: "Completed" },
];
const STATUS_ORDER: Record<CampaignStatus, number> = { active: 0, scheduled: 1, paused: 2, draft: 3, completed: 4 };

interface Row { c: Campaign; s: CampaignStats; enrolled: boolean; mine?: { verified: number; earned: number } }

export default function Campaigns() {
  const { role, can, shop, mechanic } = useCurrentUser();
  const scope = useScope();
  const allReferrals = useDataStore((s) => s.referrals);
  const allRewards = useDataStore((s) => s.rewards);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const { brandById } = useLookups();
  const navigate = useNavigate();
  const canManage = can("manageCampaigns");
  const advocate = shop ?? mechanic;
  const isAdvocate = !!advocate;
  const status = useStatusAction();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "status", dir: "asc" });
  const [joining, setJoining] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => scope.campaigns.map((c) => {
    const s = campaignStats(c, allReferrals, allRewards, campaignParticipants(c, shops, mechanics));
    const enrolled = !!advocate && advocate.campaignIds.includes(c.id);
    let mine: Row["mine"];
    if (advocate) {
      const mr = allReferrals.filter((r) => r.advocateId === advocate.id && r.campaignId === c.id && r.status === "verified");
      mine = { verified: mr.length, earned: mr.reduce((sum, r) => sum + r.reward, 0) };
    }
    return { c, s, enrolled, mine };
  }), [scope.campaigns, allReferrals, allRewards, shops, mechanics, advocate]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const r of rows) m[r.c.status] = (m[r.c.status] ?? 0) + 1;
    return m;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => (tab === "all" || r.c.status === tab) && (!q || [r.c.name, r.c.description, brandById.get(r.c.brandId)?.name ?? ""].some((x) => x.toLowerCase().includes(q))));
    const get: Record<string, (r: Row) => number | string> = {
      status: (r) => STATUS_ORDER[r.c.status] * 1e10 - new Date(r.c.endDate).getTime() / 1000,
      verified: (r) => r.s.verified, clicks: (r) => r.s.clicks, budget: (r) => r.s.budgetUtil, reward: (r) => r.c.rewardPerConversion,
      start: (r) => r.c.startDate, end: (r) => r.c.endDate, name: (r) => r.c.name,
    };
    const g = get[sort.key] ?? get.status!;
    return [...list].sort((a, b) => {
      const av = g(a), bv = g(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, tab, query, sort, brandById]);

  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "status" ? "asc" : "desc" }));

  const simulateJoin = async (c: Campaign) => {
    setJoining(c.id);
    await new Promise((r) => setTimeout(r, 600));
    setJoining(null);
    toast.success("Enrolment request sent (simulated)", { description: `${brandById.get(c.brandId)?.name} approves enrolment for "${c.name}". In this demo, enrolment isn't changed.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description={isAdvocate ? "Campaigns you're enrolled in plus live and upcoming campaigns open to you. Rewards accrue only on verified purchases."
          : role === "brand" ? "Your brand's referral campaigns — performance, budget and status." : "All referral campaigns across brands."}
        actions={canManage ? <Button asChild><Link to="/app/campaigns/new"><Plus />New campaign</Link></Button> : undefined}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-w-0">
          <TabsList className="h-auto max-w-full flex-wrap justify-start">
            {TABS.filter((x) => x.v === "all" || canManage || counts[x.v]).map((x) => (
              <TabsTrigger key={x.v} value={x.v} className="gap-1.5">
                {x.label}<span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground num">{counts[x.v] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search campaigns…" />
          <SortControl sort={sort} onSort={onSort} options={[
            { key: "status", label: "Status" }, { key: "end", label: "End date" }, { key: "start", label: "Start date" }, { key: "verified", label: "Verified" },
            { key: "clicks", label: "Referrals" }, { key: "budget", label: "Budget used" }, { key: "reward", label: "Reward" }, { key: "name", label: "Name" },
          ]} />
        </div>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title={query || tab !== "all" ? "No campaigns match" : "No campaigns yet"}
            description={query || tab !== "all" ? "Try another status or search term." : canManage ? "Create your first campaign to start rewarding advocates." : "New campaigns open to you will appear here."}
            action={query || tab !== "all" ? <Button variant="outline" size="sm" onClick={() => { setQuery(""); setTab("all"); }}>Clear filters</Button>
              : canManage ? <Button size="sm" asChild><Link to="/app/campaigns/new"><Plus />New campaign</Link></Button> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ c, s, enrolled, mine }) => {
            const timing = campaignTiming(c);
            const editable = canManage; // brand scope already limits campaigns to the brand's own
            const actions = editable ? statusActions(c) : [];
            const open = () => navigate(`/app/campaigns/${c.id}`);
            return (
              <Card key={c.id} role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(); }}
                className="group flex cursor-pointer flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-action/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{brandById.get(c.brandId)?.name}</div>
                    <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight group-hover:text-action">{c.name}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <StatusBadge status={c.status} />
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => navigate(`/app/campaigns/${c.id}/edit`)}><Pencil />Edit campaign</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/app/campaigns/${c.id}`)}><Megaphone />View details</DropdownMenuItem>
                          {actions.length > 0 && <DropdownMenuSeparator />}
                          {actions.map((a) => (
                            <DropdownMenuItem key={a.to} onSelect={() => status.request(c, a)} className={cn(a.variant === "destructive" && "text-destructive focus:text-destructive")}>{a.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(c.startDate, { day: "numeric", month: "short" })} – {formatDate(c.endDate, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className={cn("font-medium", timing.urgent ? "text-warning" : "text-foreground/80")}>{timing.label}</span>
                </div>

                {isAdvocate && (
                  <div className="mt-3">
                    {enrolled ? <Badge variant="positive"><CheckCircle2 />Enrolled</Badge> : <Badge variant="action"><UserPlus />Open to join</Badge>}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" />Advocates</div>
                    <div className="text-sm font-semibold num">{formatNumber(s.advocates)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><MousePointerClick className="h-3 w-3" />Referrals</div>
                    <div className="text-sm font-semibold num">{formatNumber(s.clicks, { compact: s.clicks >= 10000 })}</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Verified</div>
                    <div className="text-sm font-semibold num">{formatNumber(s.verified)}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Budget used</span>
                    <span className={cn("font-medium num", s.budgetUtil > 85 && "text-warning")}>{formatPercent(s.budgetUtil, 0)} <span className="font-normal text-muted-foreground">of {formatCurrency(c.budget, { compact: true })}</span></span>
                  </div>
                  <Progress value={s.budgetUtil} indicatorClassName={budgetTone(s.budgetUtil)} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-positive" /><span className="font-semibold num">{formatCurrency(c.rewardPerConversion)}</span><span className="text-muted-foreground">per verified sale</span></span>
                  {mine && enrolled ? (
                    <span className="text-muted-foreground"><span className="font-semibold text-foreground num">{mine.verified}</span> yours · <span className="font-semibold text-foreground num">{formatCurrency(mine.earned)}</span></span>
                  ) : isAdvocate && !enrolled ? (
                    <Button size="sm" variant="outline" disabled={joining === c.id} onClick={(e) => { e.stopPropagation(); simulateJoin(c); }}>
                      {joining === c.id ? <Loader2 className="animate-spin" /> : <UserPlus />}Join campaign
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">+{c.customerBonusPoints} customer pts</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isAdvocate && <DemoNotice>Joining a campaign is simulated — in production the brand approves enrolment. Your enrolment isn't changed in this demo.</DemoNotice>}
      {status.dialog}
    </div>
  );
}
