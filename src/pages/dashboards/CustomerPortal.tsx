import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Gift, Lock, Mail, MapPin, Package, ReceiptText, Sparkles, Star, Ticket, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { TierBadge } from "@/components/shared/TierBadge";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { ProductImage } from "@/components/shared/ProductImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { REWARD_CATALOG } from "@/data/catalog";
import { LOYALTY_TIERS, customerLoyalty, tierRank } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { LoyaltyTxn, RewardItem } from "@/types";
import { cn } from "@/lib/utils";

const TXN_LABEL: Record<LoyaltyTxn["type"], string> = { earn: "Earned", bonus: "Bonus", redeem: "Redeemed", expire: "Expired" };

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { customer, user } = useCurrentUser();
  const loyalty = useDataStore((s) => s.loyalty);
  const purchases = useDataStore((s) => s.purchases);
  const redemptions = useDataStore((s) => s.redemptions);
  const campaigns = useDataStore((s) => s.campaigns);
  const products = useDataStore((s) => s.products);
  const { productById, advocate, brandById } = useLookups();

  const data = useMemo(() => {
    if (!customer) return null;
    const l = customerLoyalty(loyalty, customer.id);
    const used = (id: string) => redemptions.filter((r) => r.rewardId === id).length;
    const catalog = REWARD_CATALOG.map((item) => {
      const inStock = item.stock - used(item.id) > 0;
      const tierOk = !item.minTier || tierRank(l.tier) >= tierRank(item.minTier);
      return { item, inStock, tierOk, affordable: l.balance >= item.points };
    }).filter((x) => x.inStock && x.tierOk);
    // affordable first (highest value you can get now), then the closest next goals
    const eligible = [
      ...catalog.filter((x) => x.affordable).sort((a, b) => b.item.points - a.item.points),
      ...catalog.filter((x) => !x.affordable).sort((a, b) => a.item.points - b.item.points),
    ].slice(0, 3);

    const active = campaigns.filter((c) => c.status === "active");
    const offerProducts = new Map<string, { bonus: number; campaign: string }>();
    for (const c of active) for (const pid of c.productIds) {
      const cur = offerProducts.get(pid);
      if (!cur || c.customerBonusPoints > cur.bonus) offerProducts.set(pid, { bonus: c.customerBonusPoints, campaign: c.name });
    }
    const participating = products.filter((p) => p.status === "active" && offerProducts.has(p.id))
      .map((p) => ({ p, ...offerProducts.get(p.id)!, total: p.loyaltyPoints + offerProducts.get(p.id)!.bonus }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    const myPurchases = purchases.filter((p) => p.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
    const txns = loyalty.filter((t) => t.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
    const myRedemptions = redemptions.filter((r) => r.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
    return { l, eligible, active, participating, myPurchases, txns, myRedemptions, spent: myPurchases.reduce((s, p) => s + p.amount, 0) };
  }, [customer, loyalty, purchases, redemptions, campaigns, products]);

  if (!customer || !data) return <EmptyState icon={UserRound} title="No customer profile linked" description="Switch to the Customer demo role to see the loyalty portal." />;
  const { l } = data;
  const first = customer.name.split(" ")[0];
  const curTierMin = LOYALTY_TIERS[tierRank(l.tier)]!.min;
  const nextMin = l.nextTier ? LOYALTY_TIERS[tierRank(l.nextTier)]!.min : curTierMin;

  const RewardCard = ({ item, affordable }: { item: RewardItem; affordable: boolean }) => (
    <div className={cn("flex flex-col rounded-xl border p-4 transition-colors", affordable ? "hover:border-ai/40" : "bg-muted/30")}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", affordable ? "bg-ai-soft text-ai" : "bg-muted text-muted-foreground")}><Gift className="h-5 w-5" /></span>
        <Badge variant="muted">{item.category}</Badge>
      </div>
      <div className="mt-3 font-semibold leading-snug">{item.title}</div>
      <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-muted-foreground">{item.description}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold num">{formatNumber(item.points)} pts</span>
        {affordable ? (
          <Button size="sm" variant="ai" onClick={() => navigate(`/app/loyalty?redeem=${item.id}`)}>Redeem</Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{formatNumber(item.points - l.balance)} more</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi ${first}, welcome back`}
        description="Your points, rewards and offers in one place."
        actions={<Button variant="ai" size="lg" asChild><Link to="/app/loyalty"><Gift />Browse rewards</Link></Button>}
      />

      {/* profile + points */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ai/10 via-brand/5 to-transparent" aria-hidden />
          <CardContent className="relative grid gap-6 p-6 sm:grid-cols-[1fr,auto] sm:items-center">
            <div className="flex items-center gap-4">
              <EntityAvatar name={customer.name} hue={customer.hue} size="xl" className="ring-4 ring-card" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">{customer.name}</h2><TierBadge tier={l.tier} className="text-xs" /></div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{customer.city}</span>
                  <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{customer.email}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Member since {formatDate(customer.joinedAt, { month: "short", year: "numeric" })}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-card/90 p-5 text-center shadow-sm sm:min-w-[200px]">
              <div className="text-sm text-muted-foreground">Available points</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight text-ai num">{formatNumber(l.balance)}</div>
              <div className="mt-1 text-xs text-muted-foreground num">{formatNumber(l.lifetime)} earned · {formatNumber(l.redeemed)} redeemed</div>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{l.nextTier ? <>Only <span className="text-ai num">{formatNumber(l.pointsToNext)}</span> points to {l.nextTier}</> : "You've reached our highest tier"}</span>
                {l.nextTier && <TierBadge tier={l.nextTier} />}
              </div>
              <Progress value={l.progress} className="h-3" indicatorClassName="bg-gradient-to-r from-brand to-ai" />
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground num"><span>{l.tier} · {formatNumber(curTierMin)}</span><span>{l.nextTier ? `${l.nextTier} · ${formatNumber(nextMin)}` : `${formatNumber(l.lifetime)} lifetime`}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-ai" />Active offers</CardTitle>
            <CardDescription>Extra points on top of every eligible purchase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.active.length === 0 && <p className="text-sm text-muted-foreground">No offers running right now — check back soon.</p>}
            {data.active.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-ai-soft text-ai"><span className="text-sm font-bold leading-none num">+{c.customerBonusPoints}</span><span className="text-[9px] font-medium">PTS</span></span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{brandById.get(c.brandId)?.name} · until {formatDate(c.endDate, { day: "numeric", month: "short" })}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* eligible rewards */}
      <section aria-labelledby="eligible-h">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 id="eligible-h" className="text-lg font-semibold tracking-tight">Rewards for you</h2><p className="text-sm text-muted-foreground">Picked for your {l.tier} tier and current balance</p></div>
          <Button variant="ghost" size="sm" asChild><Link to="/app/loyalty">Full catalogue<ArrowRight /></Link></Button>
        </div>
        {data.eligible.length === 0 ? <Card><EmptyState icon={Gift} title="No rewards available right now" description="Keep earning points — new rewards are added regularly." /></Card> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.eligible.map(({ item, affordable }) => <RewardCard key={item.id} item={item} affordable={affordable} />)}
          </div>
        )}
        <DemoNotice className="mt-3">Redemptions are simulated demo actions — vouchers and codes are not real.</DemoNotice>
      </section>

      {/* participating products */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle className="text-base">Earn more on these products</CardTitle><CardDescription className="mt-1">Points per purchase, including current offer bonus</CardDescription></div>
          <Button variant="ghost" size="sm" asChild><Link to="/app/products">All products</Link></Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.participating.map(({ p, bonus, total, campaign }) => (
            <Link key={p.id} to={`/app/products?open=${p.id}`} className="group flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-ai/40">
              <ProductImage category={p.category} name={p.name} size="sm" className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-ai">{p.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatCurrency(p.price)} · {brandById.get(p.brandId)?.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-semibold text-ai num">+{total}</div>
                <div className="text-[10px] text-muted-foreground" title={campaign}>{p.loyaltyPoints} + {bonus} bonus</div>
              </div>
            </Link>
          ))}
          {data.participating.length === 0 && <EmptyState icon={Package} title="No participating products right now" className="col-span-full py-6" />}
        </CardContent>
      </Card>

      {/* history */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-muted-foreground" />Purchase history</CardTitle>
            <CardDescription>{data.myPurchases.length} purchases · {formatCurrency(data.spent)} total</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.myPurchases.length === 0 && <EmptyState title="No purchases yet" description="Buy from a participating shop or mechanic to start earning." className="py-6" />}
            {data.myPurchases.slice(0, 6).map((p) => {
              const prod = productById.get(p.productId);
              const adv = p.advocateId ? advocate(p.advocateId) : undefined;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-2.5">
                  {prod ? <ProductImage category={prod.category} name={prod.name} size="sm" className="h-10 w-10 shrink-0 rounded-lg" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{prod?.name ?? p.productId}</div>
                    <div className="truncate text-xs text-muted-foreground">{formatDate(p.date)}{adv ? ` · recommended by ${adv.name}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium num">{formatCurrency(p.amount)}</div>
                    <div className="text-xs font-medium text-positive num">+{p.points} pts</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle className="flex items-center gap-2 text-base"><Star className="h-4 w-4 text-muted-foreground" />Points activity</CardTitle><CardDescription className="mt-1">Your latest points earned and used</CardDescription></div>
            <Button variant="ghost" size="sm" asChild><Link to="/app/loyalty">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.txns.length === 0 && <EmptyState title="No points activity yet" className="py-6" />}
            {data.txns.slice(0, 8).map((t) => {
              const plus = t.points > 0;
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", plus ? "bg-positive-soft text-positive" : "bg-destructive/10 text-destructive")}>
                    {plus ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.description}</div>
                    <div className="text-xs text-muted-foreground">{TXN_LABEL[t.type]} · {formatDate(t.date)}</div>
                  </div>
                  <span className={cn("shrink-0 text-sm font-semibold num", plus ? "text-positive" : "text-destructive")}>{plus ? "+" : "−"}{formatNumber(Math.abs(t.points))}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4 text-muted-foreground" />Your redeemed rewards</CardTitle>
          <CardDescription>Show the code at a participating outlet (demo codes only)</CardDescription>
        </CardHeader>
        <CardContent>
          {data.myRedemptions.length === 0 ? <EmptyState icon={Gift} title="No rewards redeemed yet" description="Pick a reward above to redeem your points." className="py-6" /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.myRedemptions.map((r) => {
                const item = REWARD_CATALOG.find((x) => x.id === r.rewardId);
                return (
                  <div key={r.id} className="rounded-xl border border-dashed p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-sm font-medium">{item?.title ?? r.rewardId}</div>
                      <Badge variant={r.status === "issued" ? "positive" : "muted"}>{r.status === "issued" ? "Ready to use" : "Used"}</Badge>
                    </div>
                    <code className="mt-3 block rounded-md bg-muted/60 px-2.5 py-1.5 text-center font-mono text-sm font-semibold tracking-wider">{r.code}</code>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{formatDate(r.date)}</span><span className="num">{formatNumber(r.points)} pts</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">Signed in as {user?.email}</div>
      </Card>
    </div>
  );
}
