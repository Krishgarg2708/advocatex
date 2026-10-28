/**
 * Pure metric calculations shared by every dashboard, chart, export and the AI demo engine.
 * Keeping formulas in one place is what keeps numbers consistent across screens.
 *
 *   Conversion Rate        = Verified Conversions / Eligible Referral Visits (clicks) × 100
 *   Reward Redemption Rate = Paid-out rewards / Approved (redeemable) rewards × 100
 *   Campaign ROAS          = Attributed Revenue / Campaign Spend (advocate rewards)
 */
import type {
  AdvocateTier, AdvocateType, Campaign, DateRange, LoyaltyTier, LoyaltyTxn, Mechanic, Referral, RewardTxn, Shop,
} from "@/types";

/* ---------------- dates ---------------- */
export const DAY_MS = 86_400_000;
export function rangeBounds(r: DateRange) {
  const from = new Date(`${r.from}T00:00:00`).getTime();
  const to = new Date(`${r.to}T23:59:59.999`).getTime();
  return { from, to };
}
export function inRange(iso: string | undefined, r: DateRange) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const { from, to } = rangeBounds(r);
  return t >= from && t <= to;
}
/** Range of identical length immediately before `r` — used for trend deltas. */
export function previousRange(r: DateRange): DateRange {
  const { from, to } = rangeBounds(r);
  const len = Math.round((to - from) / DAY_MS);
  const pTo = new Date(from - DAY_MS); const pFrom = new Date(from - len * DAY_MS);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { preset: "custom", from: f(pFrom), to: f(pTo) };
}
export const rangeDays = (r: DateRange) => Math.max(1, Math.round((rangeBounds(r).to - rangeBounds(r).from) / DAY_MS));
export const rangeLabel = (r: DateRange) =>
  r.preset === "7d" ? "Last 7 days" : r.preset === "30d" ? "Last 30 days" : r.preset === "90d" ? "Last 90 days" :
  `${new Date(r.from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(r.to).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

/* ---------------- funnel ---------------- */
export interface Funnel {
  clicks: number; leads: number; purchases: number; pending: number; verified: number; rejected: number;
  revenue: number; pendingReward: number; conversionRate: number; avgOrderValue: number;
}
/** Funnel for referrals whose click happened in range (cohort view). */
export function funnel(refs: Referral[]): Funnel {
  let leads = 0, purchases = 0, pending = 0, verified = 0, rejected = 0, revenue = 0, pendingReward = 0;
  for (const r of refs) {
    if (r.leadAt) leads++;
    if (r.purchaseAt) purchases++;
    if (r.status === "pending") { pending++; pendingReward += r.reward; }
    if (r.status === "verified") { verified++; revenue += r.purchaseValue; }
    if (r.status === "rejected") rejected++;
  }
  const clicks = refs.length;
  return { clicks, leads, purchases, pending, verified, rejected, revenue, pendingReward, conversionRate: clicks ? (verified / clicks) * 100 : 0, avgOrderValue: verified ? revenue / verified : 0 };
}
export const refsInRange = (refs: Referral[], r?: DateRange) => (r ? refs.filter((x) => inRange(x.createdAt, r)) : refs);

/* ---------------- rewards / wallet ---------------- */
export interface Wallet { totalEarned: number; pending: number; available: number; inProcess: number; paidOut: number; reversed: number; approved: number; redemptionRate: number }
export function wallet(txns: RewardTxn[], advocateId?: string): Wallet {
  const t = advocateId ? txns.filter((x) => x.advocateId === advocateId) : txns;
  let pending = 0, approved = 0, reversed = 0, inProcess = 0, paidOut = 0;
  for (const x of t) {
    if (x.type === "commission" || x.type === "bonus") {
      if (x.status === "pending") pending += x.amount;
      else if (x.status === "approved") approved += x.amount;
      else if (x.status === "reversed") reversed += x.amount;
    } else if (x.type === "payout") {
      if (x.status === "requested") inProcess += x.amount;
      if (x.status === "paid") paidOut += x.amount;
    }
  }
  return { totalEarned: pending + approved, pending, approved, reversed, inProcess, paidOut, available: Math.max(0, approved - inProcess - paidOut), redemptionRate: approved ? (paidOut / approved) * 100 : 0 };
}
/** Advocate rewards accrued (pending + approved commissions/bonuses) — i.e. campaign spend. */
export function spendOf(txns: RewardTxn[], filter: (t: RewardTxn) => boolean = () => true, r?: DateRange) {
  return txns.filter((t) => (t.type === "commission" || t.type === "bonus") && t.status !== "reversed" && filter(t) && (!r || inRange(t.date, r))).reduce((s, t) => s + t.amount, 0);
}

/* ---------------- campaigns ---------------- */
export interface CampaignStats extends Funnel { spend: number; budgetUtil: number; roas: number; advocates: number; activeAdvocates: number }
export function campaignStats(c: Campaign, refs: Referral[], txns: RewardTxn[], participants: number, r?: DateRange): CampaignStats {
  const cr = refsInRange(refs.filter((x) => x.campaignId === c.id), r);
  const f = funnel(cr);
  const spend = spendOf(txns, (t) => t.campaignId === c.id, r);
  const totalSpend = spendOf(txns, (t) => t.campaignId === c.id);
  return { ...f, spend, budgetUtil: c.budget ? (totalSpend / c.budget) * 100 : 0, roas: spend ? f.revenue / spend : 0, advocates: participants, activeAdvocates: new Set(cr.map((x) => x.advocateId)).size };
}
export const campaignParticipants = (c: Campaign, shops: Shop[], mechanics: Mechanic[]) =>
  shops.filter((s) => s.campaignIds.includes(c.id)).length + mechanics.filter((m) => m.campaignIds.includes(c.id)).length;

/* ---------------- advocates ---------------- */
export interface AdvocateRow {
  id: string; type: AdvocateType; name: string; subtitle: string; city: string; hue: number;
  clicks: number; leads: number; verified: number; conversionRate: number; revenue: number; rewards: number; rank: number;
}
export function advocateTier(lifetimeVerified: number): AdvocateTier {
  if (lifetimeVerified >= 40) return "Platinum";
  if (lifetimeVerified >= 25) return "Gold";
  if (lifetimeVerified >= 10) return "Silver";
  return "Bronze";
}
export const ADVOCATE_TIER_STEPS: { tier: AdvocateTier; min: number }[] = [
  { tier: "Bronze", min: 0 }, { tier: "Silver", min: 10 }, { tier: "Gold", min: 25 }, { tier: "Platinum", min: 40 },
];
export function leaderboard(shops: Shop[], mechanics: Mechanic[], refs: Referral[], txns: RewardTxn[], r?: DateRange, type?: AdvocateType): AdvocateRow[] {
  const rr = refsInRange(refs, r);
  const by = new Map<string, Referral[]>();
  for (const x of rr) by.set(x.advocateId, [...(by.get(x.advocateId) ?? []), x]);
  const rows: AdvocateRow[] = [];
  const add = (id: string, t: AdvocateType, name: string, subtitle: string, city: string, hue: number) => {
    const f = funnel(by.get(id) ?? []);
    rows.push({ id, type: t, name, subtitle, city, hue, clicks: f.clicks, leads: f.leads, verified: f.verified, conversionRate: f.conversionRate, revenue: f.revenue, rewards: spendOf(txns, (x) => x.advocateId === id, r), rank: 0 });
  };
  if (type !== "mechanic") shops.filter((s) => s.status === "verified").forEach((s) => add(s.id, "shop", s.name, s.owner, s.city, s.hue));
  if (type !== "shop") mechanics.filter((m) => m.status === "verified").forEach((m) => add(m.id, "mechanic", m.name, m.workshop, m.city, m.hue));
  rows.sort((a, b) => b.verified - a.verified || b.revenue - a.revenue || b.clicks - a.clicks);
  rows.forEach((x, i) => (x.rank = i + 1));
  return rows;
}

/* ---------------- time series ---------------- */
export interface SeriesPoint { key: string; label: string; clicks: number; leads: number; verified: number; revenue: number; rewards: number; shopVerified: number; mechanicVerified: number }
export function timeSeries(refs: Referral[], txns: RewardTxn[], r: DateRange): SeriesPoint[] {
  const { from, to } = rangeBounds(r);
  const days = Math.round((to - from) / DAY_MS);
  const weekly = days > 45;
  const bucketMs = weekly ? 7 * DAY_MS : DAY_MS;
  const buckets: SeriesPoint[] = [];
  for (let t = from; t <= to; t += bucketMs) {
    const d = new Date(t);
    buckets.push({ key: String(t), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), clicks: 0, leads: 0, verified: 0, revenue: 0, rewards: 0, shopVerified: 0, mechanicVerified: 0 });
  }
  const idx = (iso: string) => Math.floor((new Date(iso).getTime() - from) / bucketMs);
  for (const x of refs) {
    const ct = new Date(x.createdAt).getTime();
    if (ct >= from && ct <= to) { const b = buckets[idx(x.createdAt)]; if (b) { b.clicks++; if (x.leadAt) b.leads++; } }
    if (x.status === "verified" && x.verifiedAt) {
      const vt = new Date(x.verifiedAt).getTime();
      if (vt >= from && vt <= to) { const b = buckets[idx(x.verifiedAt)]; if (b) { b.verified++; b.revenue += x.purchaseValue; if (x.advocateType === "shop") b.shopVerified++; else b.mechanicVerified++; } }
    }
  }
  for (const t of txns) {
    if ((t.type === "commission" || t.type === "bonus") && t.status !== "reversed") {
      const tt = new Date(t.date).getTime();
      if (tt >= from && tt <= to) { const b = buckets[idx(t.date)]; if (b) b.rewards += t.amount; }
    }
  }
  return buckets;
}

/* ---------------- loyalty ---------------- */
export const LOYALTY_TIERS: { tier: LoyaltyTier; min: number }[] = [
  { tier: "Member", min: 0 }, { tier: "Silver", min: 1000 }, { tier: "Gold", min: 3000 }, { tier: "Platinum", min: 7500 },
];
export const tierRank = (t: LoyaltyTier) => LOYALTY_TIERS.findIndex((x) => x.tier === t);
export function loyaltyTierFor(lifetime: number): LoyaltyTier {
  let t: LoyaltyTier = "Member";
  for (const s of LOYALTY_TIERS) if (lifetime >= s.min) t = s.tier;
  return t;
}
export function customerLoyalty(txns: LoyaltyTxn[], customerId: string) {
  let balance = 0, lifetime = 0, redeemed = 0;
  for (const t of txns) {
    if (t.customerId !== customerId) continue;
    balance += t.points;
    if (t.points > 0) lifetime += t.points; else redeemed += -t.points;
  }
  const tier = loyaltyTierFor(lifetime);
  const i = tierRank(tier);
  const next = LOYALTY_TIERS[i + 1];
  const cur = LOYALTY_TIERS[i]!;
  const progress = next ? ((lifetime - cur.min) / (next.min - cur.min)) * 100 : 100;
  return { balance, lifetime, redeemed, tier, nextTier: next?.tier, pointsToNext: next ? next.min - lifetime : 0, progress };
}

/* ---------------- achievements (derived, never random) ---------------- */
export interface Achievement { id: string; title: string; description: string; earned: boolean; progress: number; target: number; }
export function achievements(advocateId: string, refs: Referral[], board: AdvocateRow[]): Achievement[] {
  const mine = refs.filter((r) => r.advocateId === advocateId);
  const verified = mine.filter((r) => r.status === "verified");
  const lifetimeRank = board.find((x) => x.id === advocateId)?.rank ?? 999;
  const perCampaign = new Map<string, number>();
  for (const r of verified) perCampaign.set(r.campaignId, (perCampaign.get(r.campaignId) ?? 0) + 1);
  const bestCampaign = Math.max(0, ...perCampaign.values());
  // consistent performer: verified conversions in each of the last 8 weeks
  const now = Date.now();
  let weeksActive = 0;
  for (let w = 0; w < 8; w++) {
    const hi = now - w * 7 * DAY_MS, lo = hi - 7 * DAY_MS;
    if (verified.some((r) => { const t = new Date(r.verifiedAt!).getTime(); return t > lo && t <= hi; })) weeksActive++;
  }
  return [
    { id: "first", title: "First Conversion", description: "Earn your first verified conversion.", earned: verified.length >= 1, progress: Math.min(1, verified.length), target: 1 },
    { id: "ten", title: "10 Successful Referrals", description: "Reach 10 verified conversions.", earned: verified.length >= 10, progress: Math.min(10, verified.length), target: 10 },
    { id: "champion", title: "Campaign Champion", description: "15 verified conversions in a single campaign.", earned: bestCampaign >= 15, progress: Math.min(15, bestCampaign), target: 15 },
    { id: "consistent", title: "Consistent Performer", description: "A verified conversion in each of the last 8 weeks.", earned: weeksActive >= 8, progress: weeksActive, target: 8 },
    { id: "top", title: "Top Advocate", description: "Rank #1 on the all-time network leaderboard.", earned: lifetimeRank === 1, progress: lifetimeRank === 1 ? 1 : 0, target: 1 },
  ];
}

/* ---------------- delta helper ---------------- */
export const delta = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0);
