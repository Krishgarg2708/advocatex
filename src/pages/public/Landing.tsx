import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BarChart3, Bell, Brain, Check, Coins, Gift, Loader2, Lock, Menu, MousePointerClick, QrCode, Quote, Repeat, ShieldAlert,
  Sparkles, Target, TrendingUp, UserPlus, Users, Wallet, Wrench, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/layout/Logo";
import { api } from "@/services/api";
import { ROLE_HOME, ROLE_LABEL, useAuthStore } from "@/store/auth";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { HeroPreview } from "./components/HeroPreview";
import { ROLE_META, ThemeToggle } from "./components/public-kit";

const NAV = [
  { id: "platform", label: "Platform" },
  { id: "solutions", label: "Solutions" },
  { id: "features", label: "Features" },
  { id: "ai", label: "AI Insights" },
  { id: "plans", label: "Plans" },
] as const;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Restrained scroll reveal. */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}>
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, description, tone = "text-action", center = true }: { eyebrow: string; title: string; description?: string; tone?: string; center?: boolean }) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      <p className={cn("text-[13px] font-semibold uppercase tracking-wider", tone)}>{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {description && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
    </Reveal>
  );
}

/* ----------------------------------------------------------------------------- nav */

function TopNav() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const go = (id: string) => { setOpen(false); window.setTimeout(() => scrollToId(id), open ? 220 : 0); };

  return (
    <header className={cn("sticky top-0 z-40 border-b border-transparent transition-colors", scrolled && "border-border bg-background/80 backdrop-blur-md")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n.id)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <Button size="sm" className="hidden sm:inline-flex" onClick={() => navigate(ROLE_HOME[user.role])}>Open dashboard<ArrowRight /></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Login</Link></Button>
              <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/register">Get Started</Link></Button>
            </>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xs">
              <SheetHeader>
                <SheetTitle><Logo /></SheetTitle>
                <SheetDescription className="sr-only">Site navigation</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
                {NAV.map((n) => (
                  <button key={n.id} type="button" onClick={() => go(n.id)} className="rounded-md px-3 py-2.5 text-left text-[15px] font-medium hover:bg-muted">{n.label}</button>
                ))}
              </nav>
              <div className="mt-auto grid gap-2 border-t p-4">
                {user ? (
                  <Button onClick={() => { setOpen(false); navigate(ROLE_HOME[user.role]); }}>Open dashboard</Button>
                ) : (
                  <>
                    <Button asChild variant="outline"><Link to="/login">Login</Link></Button>
                    <Button asChild><Link to="/register">Get Started</Link></Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------------- hero */

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] opacity-60" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand/20 via-action/10 to-transparent blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}>
          <button type="button" onClick={() => scrollToId("ai")}
            className="group inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:text-foreground">
            <span className="flex items-center gap-1 font-medium text-ai"><Sparkles className="h-3.5 w-3.5" />New</span>
            AI insights for every campaign
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
          <h1 className="mt-5 text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Turn Trusted Recommendations Into{" "}
            <span className="bg-gradient-to-r from-brand via-action to-ai bg-clip-text text-transparent">Measurable Growth.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Empower mechanics, local shops, and trusted advocates to drive referrals, grow sales, and earn meaningful rewards — all from one intelligent platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate("/select-role")}>Launch Demo Dashboard<ArrowRight /></Button>
            <Button size="lg" variant="outline" onClick={() => scrollToId("features")}>Explore Features</Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
            {["No sign-up needed", "5 demo roles", "Runs fully in your browser"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-positive" />{t}</li>
            ))}
          </ul>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}>
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- network */

const NETWORK: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  { icon: Target, title: "Brands", body: "Fund targeted campaigns and pay only for verified, attributed sales.", tone: "bg-action-soft text-action" },
  { icon: Users, title: "Local shops", body: "Turn counter conversations into tracked referrals and commissions.", tone: "bg-positive-soft text-positive" },
  { icon: Wrench, title: "Mechanics", body: "Monetise the trust customers already place in your advice.", tone: "bg-warning-soft text-warning" },
  { icon: Gift, title: "Customers", body: "Get genuine recommendations and earn loyalty points on every purchase.", tone: "bg-ai-soft text-ai" },
];

function NetworkOverview() {
  return (
    <section id="platform" className="scroll-mt-20 border-y bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHead center={false} eyebrow="Trusted advocacy network" title="One network connecting the people customers already trust"
            description="AdvocateX links brands with verified shops and mechanics. Every recommendation is tracked from QR scan to verified purchase, so rewards are fair and growth is measurable." />
          <div className="grid gap-3 sm:grid-cols-2">
            {NETWORK.map((n, i) => (
              <Reveal key={n.title} delay={i * 0.05}>
                <Card className="h-full p-5">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", n.tone)}><n.icon className="h-[18px] w-[18px]" /></span>
                  <p className="mt-4 font-semibold">{n.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- how it works */

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: UserPlus, title: "Join", body: "Shops and mechanics register, get verified and are enrolled in brand campaigns." },
  { icon: QrCode, title: "Refer", body: "Advocates share a personal QR code or link with customers in-store or on WhatsApp." },
  { icon: BadgeCheck, title: "Convert", body: "Purchases are claimed and verified against invoices before any reward is released." },
  { icon: Coins, title: "Earn", body: "Advocates earn commissions and bonuses; customers collect loyalty points." },
];

function HowItWorks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="How it works" title="Join → Refer → Convert → Earn" description="A simple loop that rewards genuine recommendations, not clicks." />
        <ol className="relative grid gap-4 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" aria-hidden />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.07}>
              <li className="relative flex flex-col items-center text-center">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border bg-card text-brand shadow-card">
                  <s.icon className="h-5 w-5" />
                  <span className="num absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">{i + 1}</span>
                </span>
                <p className="mt-4 font-semibold">{s.title}</p>
                <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- solutions */

const SOLUTIONS: { role: Role; tab: string; headline: string; body: string; bullets: string[] }[] = [
  { role: "brand", tab: "Brands", headline: "Grow sales through advocates you can measure", body: "Design campaigns by product, region and advocate type, then see exactly which recommendations turned into revenue.",
    bullets: ["Campaign builder with budgets and reward caps", "Attributed revenue and ROAS per campaign", "Regional and advocate leaderboards", "Fraud signals before rewards are paid"] },
  { role: "shop", tab: "Shops", headline: "Make every counter conversation count", body: "Give walk-in customers a reason to come back and earn commission on the brands you already stock.",
    bullets: ["Shop QR code and shareable referral link", "Commission wallet with payout requests", "Campaigns relevant to your category", "Customer loyalty bonuses that drive repeat visits"] },
  { role: "mechanic", tab: "Mechanics", headline: "Get rewarded for the advice you already give", body: "Recommend trusted parts and fluids, track every referral and climb tiers as your verified sales grow.",
    bullets: ["Personal referral toolkit with WhatsApp sharing", "Earnings, tier progress and achievements", "Leaderboard rank among peers", "Transparent verification status per referral"] },
  { role: "customer", tab: "Customers", headline: "Recommendations you can trust, rewards you can use", body: "Buy what your mechanic recommends and earn loyalty points you can redeem for services and vouchers.",
    bullets: ["Loyalty points on referred purchases", "Silver, Gold and Platinum tiers", "Rewards catalogue with instant redemption", "Clear history of points earned and used"] },
];

function Solutions() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<Role | null>(null);
  const tryAs = async (role: Role) => {
    setPending(role);
    try {
      const u = await api.auth.loginAs(role);
      toast.success(`Signed in as ${u.name}`, { description: `${ROLE_LABEL[role]} demo workspace` });
      navigate(ROLE_HOME[role]);
    } catch {
      toast.error("Couldn't start the demo session. Please try again.");
      setPending(null);
    }
  };
  return (
    <section id="solutions" className="scroll-mt-20 border-y bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Solutions" title="Built for every side of the recommendation" description="Each participant gets a workspace designed around what they need to do next." />
        <Reveal>
          <Tabs defaultValue="brand" className="flex flex-col items-center">
            <TabsList className="h-10">
              {SOLUTIONS.map((s) => {
                const Icon = ROLE_META[s.role].icon;
                return <TabsTrigger key={s.role} value={s.role} className="px-3 py-1.5 sm:px-4"><Icon className="h-4 w-4" />{s.tab}</TabsTrigger>;
              })}
            </TabsList>
            {SOLUTIONS.map((s) => {
              const meta = ROLE_META[s.role];
              return (
                <TabsContent key={s.role} value={s.role} className="mt-8 w-full">
                  <Card className="grid gap-8 overflow-hidden p-6 sm:p-8 md:grid-cols-2">
                    <div>
                      <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", meta.tone)}><meta.icon className="h-5 w-5" /></span>
                      <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.headline}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                      <Button className="mt-6" onClick={() => tryAs(s.role)} disabled={pending !== null}>
                        {pending === s.role ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        Try as {ROLE_LABEL[s.role]}
                      </Button>
                    </div>
                    <ul className="grid content-center gap-3">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 rounded-lg border bg-background/60 px-4 py-3 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />{b}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- AI */

const INSIGHTS: { icon: LucideIcon; tag: string; title: string; body: string }[] = [
  { icon: TrendingUp, tag: "Opportunity", title: "Engine oil demand rising in Pune", body: "Verified oil-change referrals up 31% in four weeks. A 14-day regional bonus could lift conversions further." },
  { icon: Users, tag: "Advocate", title: "3 mechanics close to Gold tier", body: "Each needs fewer than 5 verified sales. A nudge notification typically re-activates dormant advocates." },
  { icon: ShieldAlert, tag: "Risk", title: "Unusual click burst detected", body: "One advocate generated 40 clicks in 10 minutes with no leads. Flagged for review before rewards are released." },
];

function AISection() {
  return (
    <section id="ai" className="relative scroll-mt-20 overflow-hidden py-20">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-ai/15 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHead center={false} tone="text-ai" eyebrow="AI insights" title="Know what to do next, not just what happened"
            description="AdvocateX analyses referral funnels, advocate activity and campaign spend to surface opportunities, risks and recommended actions in plain language." />
          <Reveal>
            <ul className="space-y-3 text-sm">
              {[
                { icon: Brain, t: "Explainable recommendations with the data behind them" },
                { icon: BarChart3, t: "Funnel drop-off and conversion anomaly detection" },
                { icon: ShieldAlert, t: "Fraud pattern signals for duplicate and burst activity" },
              ].map((x) => (
                <li key={x.t} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai-soft text-ai"><x.icon className="h-4 w-4" /></span>{x.t}</li>
              ))}
            </ul>
          </Reveal>
        </div>
        <div className="grid gap-3">
          {INSIGHTS.map((ins, i) => (
            <Reveal key={ins.title} delay={i * 0.08}>
              <Card className="flex gap-4 border-ai/20 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai"><ins.icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{ins.title}</p>
                    <Badge variant="ai">{ins.tag}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{ins.body}</p>
                </div>
              </Card>
            </Reveal>
          ))}
          <p className="px-1 text-xs text-muted-foreground">Sample insights. In the demo, insights are generated by rules over the mock data — no external AI service is called.</p>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- features */

const FEATURES: { icon: LucideIcon; title: string; body: string; tone: string }[] = [
  { icon: QrCode, title: "QR & link referrals", body: "Every advocate gets a unique code, printable QR and WhatsApp-ready share links.", tone: "bg-action-soft text-action" },
  { icon: MousePointerClick, title: "Full-funnel tracking", body: "Clicks, qualified leads, claimed purchases and verified sales tracked separately.", tone: "bg-brand-soft text-brand" },
  { icon: Wallet, title: "Commission wallet", body: "Pending, approved and paid rewards with payout requests and a full ledger.", tone: "bg-positive-soft text-positive" },
  { icon: Gift, title: "Customer loyalty", body: "Points on referred purchases, tiers and a rewards catalogue customers love.", tone: "bg-ai-soft text-ai" },
  { icon: Repeat, title: "Campaign automation", body: "Schedule campaigns by region, product and advocate type with budget caps.", tone: "bg-warning-soft text-warning" },
  { icon: Lock, title: "Verification & audit", body: "Approval queues, fraud flags and an audit log for every sensitive action.", tone: "bg-muted text-foreground" },
  { icon: Bell, title: "Smart notifications", body: "Real-time updates on conversions, rewards and approvals for every role.", tone: "bg-action-soft text-action" },
  { icon: BarChart3, title: "Analytics & exports", body: "Trend, cohort and regional reports with one-click CSV export.", tone: "bg-brand-soft text-brand" },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-y bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Referral & loyalty features" title="Everything a referral programme needs, in one place" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.05}>
              <Card className="group h-full p-5 transition-shadow hover:shadow-lift">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", f.tone)}><f.icon className="h-[18px] w-[18px]" /></span>
                <p className="mt-4 font-semibold">{f.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- metrics */

const METRICS = [
  { value: "2,400+", label: "Verified advocates" },
  { value: "₹3.2 Cr", label: "Attributed revenue" },
  { value: "27%", label: "Click-to-sale conversion" },
  { value: "4.6x", label: "Average campaign ROAS" },
];

function MetricsBand() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-brand px-6 py-10 text-brand-foreground sm:px-10">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-ai/20" aria-hidden />
            <div className="relative">
              <Badge className="border-white/20 bg-white/10 text-current">Illustrative demo data</Badge>
              <dl className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
                {METRICS.map((m) => (
                  <div key={m.label}>
                    <dd className="num text-3xl font-semibold tracking-tight sm:text-4xl">{m.value}</dd>
                    <dt className="mt-1 text-sm opacity-80">{m.label}</dt>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-xs opacity-70">Figures are fictional and shown for demonstration only. They do not represent real customers or results.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- testimonials */

const TESTIMONIALS = [
  { quote: "We finally know which garages actually move our oil. Campaign spend now follows verified sales, not guesswork.", name: "Meera Iyer", role: "Regional Marketing Lead, sample lubricants brand", hue: 243 },
  { quote: "My customers trust my advice. Now I get rewarded for it, and I can see every referral's status on my phone.", name: "Kunal Shinde", role: "Owner, sample two-wheeler workshop", hue: 28 },
  { quote: "The QR standee at our counter pays for itself. Repeat customers come back for their loyalty points.", name: "Farah Ansari", role: "Manager, sample spare-parts shop", hue: 173 },
];

function Testimonials() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="What advocates say" title="Designed with the people who recommend" />
        <div className="-mt-6 mb-8 flex justify-center"><Badge variant="muted">Sample content · fictional names</Badge></div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <Card className="flex h-full flex-col p-6">
                <Quote className="h-5 w-5 text-action" />
                <p className="mt-3 flex-1 text-[15px] leading-relaxed">{t.quote}</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: `hsl(${t.hue} 55% 48%)` }}>
                    {t.name.split(" ").map((p) => p[0]).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- plans */

const PLANS = [
  { name: "Starter", price: "₹4,999", period: "/month", body: "For a single brand piloting advocacy in one region.", features: ["Up to 100 advocates", "3 active campaigns", "QR & link referrals", "Basic analytics"], cta: "Start with Starter" },
  { name: "Growth", price: "₹14,999", period: "/month", body: "For brands scaling referrals across multiple states.", features: ["Up to 1,000 advocates", "Unlimited campaigns", "Customer loyalty programme", "AI insights & fraud signals", "CSV exports"], cta: "Choose Growth", featured: true },
  { name: "Enterprise", price: "Custom", period: "", body: "For multi-brand groups with advanced compliance needs.", features: ["Unlimited advocates", "SSO & role-based access", "Custom payout integrations", "Dedicated success manager"], cta: "Talk to us" },
];

function Plans() {
  const navigate = useNavigate();
  return (
    <section id="plans" className="scroll-mt-20 border-y bg-card/50 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Plans" title="Simple plans that grow with your network" description="Indicative pricing for this demo. Excludes GST." />
        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.06}>
              <Card className={cn("relative flex h-full flex-col p-6", p.featured && "border-action shadow-lift ring-1 ring-action/30")}>
                {p.featured && <Badge variant="action" className="absolute right-5 top-5">Most popular</Badge>}
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{p.body}</p>
                <p className="mt-5"><span className="num text-3xl font-semibold tracking-tight">{p.price}</span><span className="text-sm text-muted-foreground">{p.period}</span></p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />{f}</li>)}
                </ul>
                <Button className="mt-6" variant={p.featured ? "default" : "outline"}
                  onClick={() => (p.name === "Enterprise" ? navigate("/legal/contact") : navigate("/register"))}>{p.cta}</Button>
              </Card>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Indicative prices for demonstration only. No payment is collected in this demo.</p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- FAQ */

const FAQ = [
  { q: "How is a referral different from a sale?", a: "A referral starts as a click or QR scan. It becomes a qualified lead, then a claimed purchase, and only counts as a sale once the purchase is verified. Conversion rate is verified sales divided by clicks." },
  { q: "How are advocates rewarded?", a: "Each campaign defines a reward per verified conversion and an optional customer bonus. Commissions move from pending to approved after verification, and advocates can request payouts from their wallet." },
  { q: "How do you prevent fraudulent referrals?", a: "AdvocateX flags patterns such as click bursts, duplicate invoice references and repeated customers. Flagged referrals are reviewed before any reward is released." },
  { q: "Do customers need to download an app?", a: "No. Customers scan a QR code or open a link, see the advocate's recommendation and eligible products, and earn loyalty points on their purchase." },
  { q: "Is this demo connected to real data?", a: "No. Everything runs in your browser with fictional, deterministic sample data. Actions like payouts or messages are simulated and clearly labelled." },
];

function FAQSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead eyebrow="FAQ" title="Frequently asked questions" />
        <Reveal>
          <Accordion type="single" collapsible className="rounded-xl border bg-card px-5">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`f${i}`} className={cn(i === FAQ.length - 1 && "border-b-0")}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- CTA + footer */

function CTA() {
  const navigate = useNavigate();
  return (
    <section className="px-4 pb-20 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-12 text-center shadow-card sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-action/10" aria-hidden />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See AdvocateX from every side</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground">Pick a role and explore a fully working demo workspace — campaigns, referrals, rewards and AI insights.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/select-role")}>Launch Demo Dashboard<ArrowRight /></Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/register")}>Create a demo account</Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">Turn trusted recommendations into measurable growth. A frontend-only product demo.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
            {NAV.map((n) => <li key={n.id}><button type="button" onClick={() => scrollToId(n.id)} className="hover:text-foreground">{n.label}</button></li>)}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Demo</p>
          <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
            <li><Link to="/select-role" className="hover:text-foreground">Choose a role</Link></li>
            <li><Link to="/login" className="hover:text-foreground">Login</Link></li>
            <li><Link to="/register" className="hover:text-foreground">Get started</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
            <li><Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/legal/terms" className="hover:text-foreground">Terms</Link></li>
            <li><Link to="/legal/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} AdvocateX. Demo product — all names and data are fictional.</p>
          <p>Made in India · Prices in INR</p>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <Hero />
        <NetworkOverview />
        <HowItWorks />
        <Solutions />
        <AISection />
        <Features />
        <MetricsBand />
        <Testimonials />
        <Plans />
        <FAQSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
