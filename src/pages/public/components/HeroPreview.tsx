import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, BadgeCheck, Gift, MousePointerClick, QrCode, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { C, ChartTooltip } from "@/components/shared/charts";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Illustrative, static numbers for the marketing preview only (not store data). */
const TREND = [
  { w: "W1", referrals: 182, verified: 41 }, { w: "W2", referrals: 214, verified: 52 }, { w: "W3", referrals: 236, verified: 61 },
  { w: "W4", referrals: 228, verified: 63 }, { w: "W5", referrals: 271, verified: 74 }, { w: "W6", referrals: 302, verified: 86 },
  { w: "W7", referrals: 318, verified: 95 }, { w: "W8", referrals: 356, verified: 108 },
];

const KPIS = [
  { label: "Referral clicks", value: formatNumber(2107), delta: "+18.4%", icon: MousePointerClick, tone: "text-action bg-action-soft" },
  { label: "Verified sales", value: formatNumber(580), delta: "+22.1%", icon: BadgeCheck, tone: "text-positive bg-positive-soft" },
  { label: "Attributed revenue", value: formatCurrency(1840000, { compact: true }), delta: "+15.7%", icon: TrendingUp, tone: "text-brand bg-brand-soft" },
];

const CAMPAIGNS = [
  { name: "Monsoon Oil Change Drive", brand: "Veltrix", progress: 72, conv: "27.5%" },
  { name: "Safe Grip Tyre Week", brand: "TorqueGrip", progress: 48, conv: "21.2%" },
  { name: "Winter Start Assurance", brand: "VoltEdge", progress: 31, conv: "18.9%" },
];

export function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-label="Illustrative product preview">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand/15 via-action/10 to-ai/15 blur-2xl" aria-hidden />
      <div className="grid gap-3 rounded-2xl border bg-card/80 p-3 shadow-lift backdrop-blur sm:p-4">
        {/* header strip */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Brand overview</p>
            <p className="text-sm font-semibold">Last 8 weeks</p>
          </div>
          <Badge variant="muted">Illustrative</Badge>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-2">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border bg-card p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", k.tone)}><k.icon className="h-3.5 w-3.5" /></span>
                <span className="truncate text-[11px] text-muted-foreground">{k.label}</span>
              </div>
              <p className="num mt-2 text-base font-semibold tracking-tight sm:text-lg">{k.value}</p>
              <p className="num text-[11px] font-medium text-positive">{k.delta}</p>
            </div>
          ))}
        </div>

        {/* chart + side */}
        <div className="grid gap-2 md:grid-cols-5">
          <div className="rounded-xl border bg-card p-3 md:col-span-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium">Referrals vs verified sales</p>
              <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.c2 }} />Referrals</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: C.c3 }} />Verified</span>
              </div>
            </div>
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TREND} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hp-ref" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c2} stopOpacity={0.28} /><stop offset="100%" stopColor={C.c2} stopOpacity={0} /></linearGradient>
                    <linearGradient id="hp-ver" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.c3} stopOpacity={0.3} /><stop offset="100%" stopColor={C.c3} stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="w" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => formatNumber(v, { compact: true })} />
                  <Tooltip content={<ChartTooltip format={(v) => formatNumber(v)} />} />
                  <Area type="monotone" dataKey="referrals" name="Referrals" stroke={C.c2} strokeWidth={2} fill="url(#hp-ref)" />
                  <Area type="monotone" dataKey="verified" name="Verified sales" stroke={C.c3} strokeWidth={2} fill="url(#hp-ver)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-sm font-semibold text-warning">AM</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">Arjun Mehta</p>
                  <p className="truncate text-[11px] text-muted-foreground">Mehta Auto Works · Pune</p>
                </div>
                <Badge variant="positive"><BadgeCheck />Verified</Badge>
              </div>
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground"><QrCode className="h-3.5 w-3.5" />REF-2318 · QR scan</span>
                <span className="font-medium text-positive">Converted</span>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Commission wallet</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="num mt-1 text-lg font-semibold">{formatCurrency(12450)}</p>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-ai-soft px-2 py-0.5 text-[11px] font-medium text-ai">
                <Gift className="h-3 w-3" />+150 loyalty pts to customer
              </div>
            </div>
          </div>
        </div>

        {/* campaigns + AI */}
        <div className="grid gap-2 md:grid-cols-5">
          <div className="rounded-xl border bg-card p-3 md:col-span-3">
            <p className="mb-2 text-[13px] font-medium">Active campaigns</p>
            <ul className="space-y-2.5">
              {CAMPAIGNS.map((c) => (
                <li key={c.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="truncate text-xs"><span className="font-medium">{c.name}</span><span className="text-muted-foreground"> · {c.brand}</span></span>
                  <span className="num text-[11px] text-muted-foreground">{c.conv} conv.</span>
                  <Progress value={c.progress} className="col-span-2 h-1.5" aria-label={`${c.name} budget used`} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-ai/25 bg-ai-soft/60 p-3 md:col-span-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ai"><Sparkles className="h-3.5 w-3.5" />AI insight</p>
            <p className="mt-1.5 text-xs leading-relaxed">Mechanics in Pune convert <span className="font-semibold">1.4x</span> better on engine oil. Consider a regional bonus for the next 14 days.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
