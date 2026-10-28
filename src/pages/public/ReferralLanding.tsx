import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck, CheckCircle2, Gift, Loader2, MapPin, QrCode, ShieldCheck, Sparkles, Store, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ProductImage } from "@/components/shared/ProductImage";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { Logo } from "@/components/layout/Logo";
import { useDataStore } from "@/store/data";
import { BRANDS } from "@/data/catalog";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { ThemeToggle } from "./components/public-kit";

const clickKey = (code: string) => `advx-ref-click:${code}`;

function readStored(code: string): string | null {
  try { return sessionStorage.getItem(clickKey(code)); } catch { return null; }
}

export default function ReferralLanding() {
  const { code = "" } = useParams();
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const campaigns = useDataStore((s) => s.campaigns);
  const products = useDataStore((s) => s.products);

  const advocate = useMemo(() => {
    const shop = shops.find((s) => s.referralCode === code);
    if (shop) return { kind: "shop" as const, id: shop.id, name: shop.owner, place: shop.name, city: shop.city, state: shop.state, verified: shop.status === "verified", campaignIds: shop.campaignIds, hue: shop.hue, detail: shop.category };
    const m = mechanics.find((x) => x.referralCode === code);
    if (m) return { kind: "mechanic" as const, id: m.id, name: m.name, place: m.workshop, city: m.city, state: m.state, verified: m.status === "verified", campaignIds: m.campaignIds, hue: m.hue, detail: `${m.specialization} · ${m.experienceYears} yrs experience` };
    return null;
  }, [shops, mechanics, code]);

  const live = useMemo(() => {
    if (!advocate) return [];
    const productById = new Map(products.map((p) => [p.id, p]));
    return campaigns
      .filter((c) => c.status === "active" && advocate.campaignIds.includes(c.id))
      .map((c) => ({ campaign: c, brand: BRANDS.find((b) => b.id === c.brandId), products: c.productIds.map((id) => productById.get(id)).filter((p): p is NonNullable<typeof p> => !!p && p.status !== "discontinued") }));
  }, [advocate, campaigns, products]);

  // Record exactly one simulated click per code per tab session (StrictMode- and refresh-safe).
  const recorded = useRef<string | null>(null);
  const [refId, setRefId] = useState<string | null>(() => (code ? readStored(code) : null));
  const found = !!advocate;
  useEffect(() => {
    if (!found || !code || recorded.current === code) return;
    recorded.current = code;
    const existing = readStored(code);
    if (existing) { setRefId(existing); return; }
    const id = useDataStore.getState().recordClick(code);
    if (id) {
      try { sessionStorage.setItem(clickKey(code), id); } catch { /* storage unavailable */ }
      setRefId(id);
    }
  }, [found, code]);

  const [interest, setInterest] = useState<"idle" | "sending" | "done">("idle");
  const [interestIn, setInterestIn] = useState<string | null>(null);
  const expressInterest = (productName?: string) => {
    if (interest === "sending") return;
    setInterest("sending");
    setInterestIn(productName ?? null);
    window.setTimeout(() => {
      setInterest("done");
      toast.success("Interest noted", { description: "Simulated — no details were shared with the advocate." });
    }, 650);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {!advocate ? (
          <Card>
            <EmptyState icon={QrCode} title="This referral code isn't valid"
              description={`We couldn't find an advocate for “${code}”. The QR code may be outdated or the link mistyped.`}
              action={<Button asChild><Link to="/">Go to AdvocateX home</Link></Button>} />
          </Card>
        ) : (
          <div className="space-y-6">
            {/* advocate hero */}
            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brand/10 via-action/10 to-positive/10" aria-hidden />
              <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                <EntityAvatar name={advocate.name} hue={advocate.hue} size="xl" type={advocate.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-muted-foreground">Recommended by</p>
                  <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{advocate.name}, {advocate.place}, {advocate.city}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                    {advocate.verified
                      ? <Badge variant="positive"><BadgeCheck />Verified advocate</Badge>
                      : <Badge variant="warning">Verification pending</Badge>}
                    <span className="inline-flex items-center gap-1">{advocate.kind === "shop" ? <Store className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}{advocate.detail}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{advocate.city}, {advocate.state}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {interest === "done" && (
              <Card className="border-positive/30 bg-positive-soft/50" role="status">
                <CardContent className="flex items-start gap-3 p-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
                  <div>
                    <p className="font-medium">Thanks — {advocate.name.split(" ")[0]} will be expecting you{interestIn ? ` about ${interestIn}` : ""}.</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">Visit {advocate.place} and mention code <span className="font-mono font-medium text-foreground">{code}</span> at billing to earn your loyalty bonus. (Simulated lead — nothing was sent.)</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* campaigns */}
            <section aria-labelledby="offers" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="offers" className="text-lg font-semibold tracking-tight">Current recommended offers</h2>
                  <p className="text-[13px] text-muted-foreground">Buy an eligible product through this recommendation and earn bonus loyalty points.</p>
                </div>
                {interest !== "done" && live.length > 0 && (
                  <Button onClick={() => expressInterest()} disabled={interest === "sending"}>
                    {interest === "sending" && !interestIn ? <Loader2 className="animate-spin" /> : <Sparkles />}I'm interested
                  </Button>
                )}
              </div>

              {live.length === 0 ? (
                <Card><EmptyState icon={Gift} title="No live offers right now" description={`${advocate.name.split(" ")[0]} doesn't have an active campaign at the moment. Check back soon.`} /></Card>
              ) : live.map(({ campaign, brand, products: items }) => (
                <Card key={campaign.id}>
                  <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle>{campaign.name}</CardTitle>
                      <CardDescription className="mt-1">{brand?.name ?? "Partner brand"} · valid until {formatDate(campaign.endDate)}</CardDescription>
                    </div>
                    <Badge variant="ai"><Gift />+{formatNumber(campaign.customerBonusPoints)} bonus points</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-[13px] text-muted-foreground">{campaign.description}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {items.map((p) => (
                        <div key={p.id} className="flex gap-3 rounded-lg border p-3">
                          <ProductImage category={p.category} name={p.name} size="sm" className="h-16 w-16 shrink-0 rounded-md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="num text-sm font-semibold">{formatCurrency(p.price)}</span>
                              <span className="num text-xs font-medium text-ai">+{formatNumber(p.loyaltyPoints + campaign.customerBonusPoints)} pts</span>
                            </div>
                          </div>
                          {interest !== "done" && (
                            <Button size="sm" variant="outline" className="self-center" onClick={() => expressInterest(p.name)} disabled={interest === "sending"} aria-label={`I'm interested in ${p.name}`}>
                              {interest === "sending" && interestIn === p.name ? <Loader2 className="animate-spin" /> : "Interested"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-[13px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
              Rewards are only issued after your purchase is verified. Your contact details are never shared without your consent.
            </div>

            <DemoNotice>
              This page is part of the AdvocateX demo; visiting it recorded a simulated referral click{refId ? ` (${refId})` : ""}.
              {" "}Refreshing in this tab won't count again. <Link to="/" className="font-medium text-action hover:underline">Learn about AdvocateX</Link>
            </DemoNotice>
          </div>
        )}
      </main>
    </div>
  );
}
