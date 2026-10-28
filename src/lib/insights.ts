/**
 * Deterministic "AI Demo" insight + assistant engine.
 *
 * Nothing here calls an AI model. Every sentence is produced by explicit rules over the
 * role-scoped demo data and the shared formulas in `metrics.ts`, so every number shown can be
 * traced back to the store. A real AI service must be connected through a secure backend —
 * never by exposing API keys in the browser.
 */
import type { Campaign, DateRange, FlagSeverity, FraudFlag, Mechanic, Product, Referral, RewardTxn, Role, Shop } from "@/types";
import {
  DAY_MS, campaignStats, campaignParticipants, delta, funnel, leaderboard, previousRange, rangeBounds, rangeLabel, refsInRange, spendOf, wallet,
  type Funnel,
} from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPercent, formatRatio } from "@/lib/format";

/* ---------------- public types ---------------- */
export type InsightKind = "opportunity" | "risk" | "trend" | "info";
export type Confidence = "high" | "medium" | "low";
export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  metric?: { label: string; value: string };
  confidence: Confidence;
  action?: { label: string; to: string };
}
export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  to: string;
  cta: string;
}
export interface InsightInput {
  campaigns: Campaign[];
  referrals: Referral[];
  rewards: RewardTxn[];
  shops: Shop[];
  mechanics: Mechanic[];
  products: Product[];
  flags: FraudFlag[];
  range: DateRange;
  role: Role;
}
export interface AssistantAnswer { text: string; bullets?: string[]; followUps: string[] }

/* ---------------- thresholds (documented so the UI can explain them) ---------------- */
export const RULES = {
  minCampaignClicks: 20,
  minProductClicks: 15,
  highActivityMultiple: 1.5,
  lowConversionMultiple: 0.6,
  budgetWarnPct: 85,
};

const SEVERITY_RANK: Record<FlagSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export const SEVERITY_LABEL: Record<FlagSeverity, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
export const FLAG_TYPE_LABEL: Record<FraudFlag["type"], string> = {
  duplicate_pattern: "Duplicate referral pattern",
  high_frequency: "Unusually high referral frequency",
  repeated_txn: "Repeated transaction reference",
  conversion_spike: "Suspicious conversion spike",
  reward_abuse: "Potential reward abuse",
};

/* ---------------- helpers ---------------- */
const isNetworkRole = (r: Role) => r === "admin" || r === "brand";
const confidenceFor = (sample: number): Confidence => (sample >= 100 ? "high" : sample >= 30 ? "medium" : "low");
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
/** "in the last 30 days" / "in 3 Oct – 9 Oct" — reads naturally mid-sentence. */
export const periodPhrase = (r: DateRange) => (r.preset === "custom" ? `in ${rangeLabel(r)}` : `in the ${rangeLabel(r).toLowerCase()}`);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

/** Advocates relevant to the current scope: everyone for admin; participants/referrers for a brand. */
function advocatePool(input: InsightInput) {
  if (input.role === "admin") return { shops: input.shops, mechanics: input.mechanics };
  if (input.role === "brand") {
    const ids = new Set(input.campaigns.map((c) => c.id));
    const referrers = new Set(input.referrals.map((r) => r.advocateId));
    const inScope = (x: { id: string; campaignIds: string[] }) => referrers.has(x.id) || x.campaignIds.some((c) => ids.has(c));
    return { shops: input.shops.filter(inScope), mechanics: input.mechanics.filter(inScope) };
  }
  return { shops: [] as Shop[], mechanics: [] as Mechanic[] };
}

/** Flags visible in this scope: all for admin; for a brand only flags touching its referrals. */
export function scopeFlags(flags: FraudFlag[], referrals: Referral[], role: Role) {
  if (role === "admin") return flags;
  if (role !== "brand") return [];
  const ids = new Set(referrals.map((r) => r.id));
  return flags.filter((f) => f.referralIds.some((id) => ids.has(id)));
}

const advocateRoute = (type: "shop" | "mechanic", id: string) => (type === "shop" ? `/app/shops?open=${id}` : `/app/mechanics?open=${id}`);

interface CampaignRow { c: Campaign; f: Funnel; spend: number; budgetUtil: number; roas: number }
function campaignRows(input: InsightInput, r?: DateRange): CampaignRow[] {
  return input.campaigns.map((c) => {
    const s = campaignStats(c, input.referrals, input.rewards, campaignParticipants(c, input.shops, input.mechanics), r);
    return { c, f: s, spend: s.spend, budgetUtil: s.budgetUtil, roas: s.roas };
  });
}
function productRows(input: InsightInput, r?: DateRange) {
  const cohort = refsInRange(input.referrals, r);
  return input.products
    .map((p) => ({ p, f: funnel(cohort.filter((x) => x.productId === p.id)) }))
    .filter((x) => x.f.clicks > 0);
}
function verifiedBetween(refs: Referral[], lo: number, hi: number) {
  let n = 0;
  for (const r of refs) {
    if (r.status !== "verified" || !r.verifiedAt) continue;
    const t = new Date(r.verifiedAt).getTime();
    if (t > lo && t <= hi) n++;
  }
  return n;
}

/* ---------------- insights ---------------- */
export function buildInsights(input: InsightInput): Insight[] {
  const { range, role } = input;
  const out: Insight[] = [];
  const cohort = refsInRange(input.referrals, range);
  const cur = funnel(cohort);
  const avgConv = cur.conversionRate;
  const scopeWord = role === "shop" || role === "mechanic" ? "your" : "the";
  const per = periodPhrase(range);

  // 1 + 2 · best and weakest converting campaign (vs average)
  const minC = isNetworkRole(role) ? RULES.minCampaignClicks : 8;
  const cRows = campaignRows(input, range).filter((x) => x.f.clicks >= minC);
  if (cRows.length >= 2 && avgConv > 0) {
    const byConv = [...cRows].sort((a, b) => b.f.conversionRate - a.f.conversionRate || b.f.verified - a.f.verified);
    const best = byConv[0]!;
    if (best.f.conversionRate > avgConv) {
      out.push({
        id: `best-campaign:${best.c.id}`, kind: "opportunity",
        title: `${best.c.name} has the strongest conversion rate`,
        detail: `${formatPercent(best.f.conversionRate)} of ${formatNumber(best.f.clicks)} referral clicks became verified purchases ${per}, versus a ${formatPercent(avgConv)} average across ${scopeWord} campaigns (${formatNumber(best.f.verified)} verified, ${formatCurrency(best.f.revenue)} attributed revenue).`,
        metric: { label: "Conversion rate", value: formatPercent(best.f.conversionRate) },
        confidence: confidenceFor(best.f.clicks),
        action: { label: "Open campaign", to: `/app/campaigns/${best.c.id}` },
      });
    }
    const worst = byConv[byConv.length - 1]!;
    if (worst.c.id !== best.c.id && worst.f.conversionRate < avgConv * 0.7) {
      out.push({
        id: `weak-campaign:${worst.c.id}`, kind: "risk",
        title: `${worst.c.name} is converting below average`,
        detail: `Only ${formatPercent(worst.f.conversionRate)} of its ${formatNumber(worst.f.clicks)} clicks were verified ${per} — ${formatPercent((1 - worst.f.conversionRate / avgConv) * 100, 0)} below the ${formatPercent(avgConv)} average. ${worst.f.rejected ? `${plural(worst.f.rejected, "claim")} ${worst.f.rejected === 1 ? "was" : "were"} rejected.` : `${plural(worst.f.leads, "click")} reached the qualified-lead stage.`}`,
        metric: { label: "Conversion rate", value: formatPercent(worst.f.conversionRate) },
        confidence: confidenceFor(worst.f.clicks),
        action: { label: "Review campaign", to: `/app/campaigns/${worst.c.id}` },
      });
    }
  }

  // 3 · high-activity / low-conversion advocates (network roles only)
  const pool = advocatePool(input);
  if (isNetworkRole(role) && avgConv > 0) {
    const board = leaderboard(pool.shops, pool.mechanics, input.referrals, input.rewards, range).filter((x) => x.clicks > 0);
    const med = median(board.map((x) => x.clicks));
    const flagged = board
      .filter((x) => x.clicks >= med * RULES.highActivityMultiple && x.conversionRate < avgConv * RULES.lowConversionMultiple)
      .sort((a, b) => b.clicks - a.clicks);
    if (board.length >= 4 && flagged.length) {
      const top = flagged[0]!;
      out.push({
        id: `low-conv-advocates:${top.id}`, kind: "risk",
        title: `${plural(flagged.length, "high-activity advocate")} ${flagged.length === 1 ? "has" : "have"} below-average conversion`,
        detail: `These advocates drove at least ${formatNumber(Math.ceil(med * RULES.highActivityMultiple))} clicks (1.5× the median of ${formatNumber(med)}) but convert under ${formatPercent(avgConv * RULES.lowConversionMultiple)}. Largest: ${top.name} — ${formatNumber(top.clicks)} clicks, ${formatNumber(top.verified)} verified (${formatPercent(top.conversionRate)}).`,
        metric: { label: "Advocates", value: formatNumber(flagged.length) },
        confidence: confidenceFor(board.reduce((s, x) => s + x.clicks, 0)),
        action: { label: `View ${top.name.split(" ")[0]}`, to: advocateRoute(top.type, top.id) },
      });
    }
  }

  // 4 · mechanic vs shop share of verified conversions (network roles)
  if (isNetworkRole(role) && cur.verified >= 5) {
    const mech = cohort.filter((r) => r.advocateType === "mechanic" && r.status === "verified").length;
    const share = (mech / cur.verified) * 100;
    const prevCohort = refsInRange(input.referrals, previousRange(range));
    const prevVer = prevCohort.filter((r) => r.status === "verified").length;
    const prevShare = prevVer ? (prevCohort.filter((r) => r.advocateType === "mechanic" && r.status === "verified").length / prevVer) * 100 : null;
    const leader = share >= 50 ? "Mechanic" : "Shop";
    const leaderShare = share >= 50 ? share : 100 - share;
    const change = prevShare === null ? "" : ` Mechanic share ${share >= prevShare ? "rose" : "fell"} from ${formatPercent(prevShare)} in the previous period.`;
    out.push({
      id: "advocate-mix", kind: "trend",
      title: `${leader} advocates contribute ${formatPercent(leaderShare, 0)} of verified referrals`,
      detail: `${formatNumber(mech)} of ${formatNumber(cur.verified)} verified conversions ${per} came from mechanics and ${formatNumber(cur.verified - mech)} from shops.${change}`,
      metric: { label: "Mechanic share", value: formatPercent(share) },
      confidence: confidenceFor(cur.verified * 3),
      action: { label: "Compare in analytics", to: "/app/analytics" },
    });
  }

  // 5 · campaigns approaching budget (lifetime spend vs budget)
  if (isNetworkRole(role)) {
    const near = campaignRows(input)
      .filter((x) => x.c.budget > 0 && x.budgetUtil >= RULES.budgetWarnPct && (x.c.status === "active" || x.c.status === "paused" || x.c.status === "scheduled"))
      .sort((a, b) => b.budgetUtil - a.budgetUtil);
    if (near.length) {
      const top = near[0]!;
      const totalSpend = spendOf(input.rewards, (t) => t.campaignId === top.c.id);
      out.push({
        id: `budget:${top.c.id}`, kind: "risk",
        title: near.length === 1 ? `${top.c.name} is approaching its budget` : `${near.length} campaigns are approaching their budget`,
        detail: `${top.c.name} has used ${formatCurrency(totalSpend)} of its ${formatCurrency(top.c.budget)} budget (${formatPercent(top.budgetUtil)}).${near.length > 1 ? ` Also above ${RULES.budgetWarnPct}%: ${near.slice(1).map((x) => `${x.c.name} (${formatPercent(x.budgetUtil, 0)})`).join(", ")}.` : ""} Spend counts accrued advocate rewards, excluding reversals.`,
        metric: { label: "Budget used", value: formatPercent(top.budgetUtil, 0) },
        confidence: "high",
        action: { label: "Adjust campaign", to: `/app/campaigns/${top.c.id}/edit` },
      });
    }
  }

  // 6 · open fraud flags
  if (isNetworkRole(role)) {
    const open = scopeFlags(input.flags, input.referrals, role).filter((f) => f.status === "new" || f.status === "under_review");
    if (open.length) {
      const worst = [...open].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.detectedAt.localeCompare(a.detectedAt))[0]!;
      const name = input.shops.find((s) => s.id === worst.advocateId)?.name ?? input.mechanics.find((m) => m.id === worst.advocateId)?.name ?? worst.advocateId;
      out.push({
        id: `fraud:${worst.id}`, kind: "risk",
        title: `${plural(open.length, "referral alert")} ${open.length === 1 ? "needs" : "need"} review`,
        detail: `Highest severity: ${worst.id} (${SEVERITY_LABEL[worst.severity].toLowerCase()}) for ${name} — ${worst.reason} These are rule-based alerts, not proof of fraud.`,
        metric: { label: "Open alerts", value: formatNumber(open.length) },
        confidence: "high",
        action: { label: "Review alert", to: `/app/fraud?open=${worst.id}` },
      });
    }
  }

  // 7 · best converting product
  const pRows = productRows(input, range).filter((x) => x.f.clicks >= (isNetworkRole(role) ? RULES.minProductClicks : 6));
  if (pRows.length >= 2 && avgConv > 0) {
    const best = [...pRows].sort((a, b) => b.f.conversionRate - a.f.conversionRate || b.f.verified - a.f.verified)[0]!;
    if (best.f.conversionRate > avgConv) {
      out.push({
        id: `best-product:${best.p.id}`, kind: "opportunity",
        title: `${best.p.name} converts best`,
        detail: `${formatPercent(best.f.conversionRate)} conversion from ${formatNumber(best.f.clicks)} referral clicks ${per} (average ${formatPercent(avgConv)}), generating ${formatCurrency(best.f.revenue)} attributed revenue from ${formatNumber(best.f.verified)} verified purchases.`,
        metric: { label: "Conversion rate", value: formatPercent(best.f.conversionRate) },
        confidence: confidenceFor(best.f.clicks),
        action: { label: "View product", to: `/app/products?open=${best.p.id}` },
      });
    }
  }

  // 8 · dormant verified advocates
  if (isNetworkRole(role)) {
    const active = new Set(cohort.map((r) => r.advocateId));
    const verifiedPool = [...pool.shops.filter((s) => s.status === "verified"), ...pool.mechanics.filter((m) => m.status === "verified")];
    const dormant = verifiedPool.filter((a) => !active.has(a.id));
    if (verifiedPool.length && dormant.length) {
      out.push({
        id: "dormant", kind: "opportunity",
        title: `${plural(dormant.length, "verified advocate")} had no referral activity`,
        detail: `${formatNumber(dormant.length)} of ${formatNumber(verifiedPool.length)} verified advocates in scope recorded 0 referral clicks ${per}. Re-engaging them is the fastest way to grow reach.`,
        metric: { label: "Inactive", value: formatPercent((dormant.length / verifiedPool.length) * 100, 0) },
        confidence: "high",
        action: { label: "View network", to: "/app/network" },
      });
    }
  }

  // 9 · week-over-week verified trend
  const end = Math.min(rangeBounds(range).to, Date.now());
  const last7 = verifiedBetween(input.referrals, end - 7 * DAY_MS, end);
  const prior7 = verifiedBetween(input.referrals, end - 14 * DAY_MS, end - 7 * DAY_MS);
  if (last7 + prior7 > 0) {
    const d = delta(last7, prior7);
    const up = last7 >= prior7;
    out.push({
      id: "wow", kind: "trend",
      title: last7 === prior7 ? "Verified conversions held steady week over week" : `Verified conversions ${up ? "rose" : "fell"} ${Math.abs(d).toFixed(0)}% week over week`,
      detail: `${formatNumber(last7)} verified in the last 7 days of the period versus ${formatNumber(prior7)} in the 7 days before.`,
      metric: { label: "Last 7 days", value: formatNumber(last7) },
      confidence: confidenceFor((last7 + prior7) * 4),
      action: { label: "Open referrals", to: "/app/referrals" },
    });
  }

  // 10 · advocate-only: personal conversion trend vs previous period
  if (!isNetworkRole(role)) {
    const prev = funnel(refsInRange(input.referrals, previousRange(range)));
    if (cur.clicks >= 5 && prev.clicks >= 5) {
      const diff = cur.conversionRate - prev.conversionRate;
      out.push({
        id: "my-conversion", kind: diff >= 0 ? "trend" : "risk",
        title: `Your conversion rate ${diff >= 0 ? "improved" : "slipped"} to ${formatPercent(cur.conversionRate)}`,
        detail: `${formatNumber(cur.verified)} verified from ${formatNumber(cur.clicks)} clicks ${per}, compared with ${formatPercent(prev.conversionRate)} (${formatNumber(prev.verified)} of ${formatNumber(prev.clicks)}) in the previous period.`,
        metric: { label: "Change", value: `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pts` },
        confidence: confidenceFor(cur.clicks),
        action: { label: "View referrals", to: "/app/referrals" },
      });
    }
  }

  if (!out.length) {
    out.push({
      id: "no-data", kind: "info",
      title: "Not enough activity for insights yet",
      detail: `There ${cur.clicks === 1 ? "is" : "are"} ${plural(cur.clicks, "referral click")} ${per}. Insights appear once there is enough data to compare — try a longer date range.`,
      confidence: "low",
    });
  }
  return out;
}

/* ---------------- recommendations ---------------- */
export function buildRecommendations(insights: Insight[], role: Role = "admin"): Recommendation[] {
  const find = (prefix: string) => insights.find((i) => i.id === prefix || i.id.startsWith(`${prefix}:`));
  const ref = (i?: Insight) => i?.id.split(":")[1];
  const recs: Recommendation[] = [];

  const fraud = find("fraud");
  if (fraud) recs.push({ id: "rec-fraud", title: "Investigate suspicious referral activity", detail: fraud.title + ". Review the evidence before any reward is approved.", priority: "high", to: "/app/fraud", cta: "Open fraud monitor" });

  const weak = find("weak-campaign");
  const lowAdv = find("low-conv-advocates");
  const adv = role === "shop" || role === "mechanic";
  if (weak) recs.push({ id: "rec-weak", title: "Review underperforming campaigns", detail: weak.title + (adv ? ". Check the campaign's eligible products and claim rules before sharing it again." : ". Check eligibility rules, product mix and rejected claims."), priority: "high", to: `/app/campaigns/${ref(weak)}`, cta: "Review campaign" });
  else if (lowAdv) recs.push({ id: "rec-weak", title: "Review underperforming campaigns", detail: lowAdv.title + ". Coaching these advocates on qualified leads lifts campaign conversion.", priority: "medium", to: "/app/campaigns", cta: "Open campaigns" });

  const budget = find("budget");
  if (budget) recs.push({ id: "rec-budget", title: "Adjust rewards for a campaign", detail: budget.title + ". Raise the budget or lower the reward per conversion before it runs out.", priority: "high", to: `/app/campaigns/${ref(budget)}/edit`, cta: "Edit campaign" });

  const dormant = find("dormant");
  if (dormant && (role === "admin" || role === "brand")) recs.push({ id: "rec-dormant", title: "Invite inactive advocates to a new campaign", detail: dormant.title + ". A fresh, targeted campaign is a low-cost way to reactivate them.", priority: "medium", to: "/app/campaigns/new", cta: "Create campaign" });

  const product = find("best-product");
  if (product) recs.push({ id: "rec-product", title: "Explore products with higher conversion rates", detail: product.title + ` — ${product.metric?.value} conversion. ${adv ? "Recommend it to more of your customers." : "Feature it in upcoming campaigns."}`, priority: "medium", to: `/app/products?open=${ref(product)}`, cta: "View product" });

  const best = find("best-campaign");
  if (best && adv) recs.push({ id: "rec-best", title: "Focus on your best-converting campaign", detail: best.title + ". Share this campaign's link with more customers.", priority: "medium", to: `/app/campaigns/${ref(best)}`, cta: "Open campaign" });

  const wow = find("wow");
  if (wow && wow.title.includes("fell")) recs.push({ id: "rec-wow", title: "Follow up on pending purchase claims", detail: wow.title + ". Verifying pending claims promptly keeps momentum.", priority: "low", to: "/app/referrals", cta: "Open referrals" });

  return recs;
}

/* ---------------- assistant ---------------- */
type Intent = "inactive" | "decline" | "rewards" | "improve" | "fraud" | "advocates" | "campaign" | "revenue" | "products" | "help";
const INTENTS: { intent: Intent; re: RegExp }[] = [
  { intent: "decline", re: /(declin|drop|fall|falling|down|worse|lower|why).*(conver|sale)|(conver|sale).*(declin|drop|fall|down|worse)/i },
  { intent: "rewards", re: /reward|budget|spend|cost|commission|payout|expens/i },
  { intent: "improve", re: /improve|next|recommend|should i|should we|suggest|focus|priorit/i },
  { intent: "fraud", re: /fraud|suspicious|flag|abuse|risk|alert|duplicate/i },
  { intent: "inactive", re: /inactive|dormant|idle|not active|no activity/i },
  { intent: "products", re: /product|sku|item|oil|tyre|battery|brake/i },
  { intent: "advocates", re: /advocate|mechanic|shop|leader|top (performer|seller)|who/i },
  { intent: "campaign", re: /campaign|best|perform/i },
  { intent: "revenue", re: /revenue|sales|income|roas|earn|money|turnover/i },
  { intent: "help", re: /help|what can|how do|capab|hello|hi\b|hey/i },
];

export const SUGGESTED_QUESTIONS = [
  "Which campaign performs best?",
  "Who are my top advocates?",
  "Why is conversion declining?",
  "Which rewards consume the most budget?",
  "What should I improve next?",
];

export function detectIntent(q: string): Intent | null {
  return INTENTS.find((x) => x.re.test(q))?.intent ?? null;
}

export function answerQuestion(question: string, input: InsightInput): AssistantAnswer {
  const intent = detectIntent(question.trim());
  const { range, role } = input;
  const label = rangeLabel(range);
  const per = periodPhrase(range);
  const isAdv = role === "shop" || role === "mechanic";
  const cohort = refsInRange(input.referrals, range);
  const cur = funnel(cohort);
  const noData: AssistantAnswer = { text: `There is no referral activity ${per} for your scope, so I can't calculate this yet. Try a longer date range.`, followUps: ["What can you answer?"] };

  switch (intent) {
    case "campaign": {
      if (!cur.clicks) return noData;
      const rows = campaignRows(input, range).filter((x) => x.f.clicks > 0);
      const eligible = rows.filter((x) => x.f.clicks >= (isAdv ? 8 : RULES.minCampaignClicks));
      const ranked = [...(eligible.length ? eligible : rows)].sort((a, b) => b.f.conversionRate - a.f.conversionRate || b.f.verified - a.f.verified);
      const best = ranked[0]!;
      const byVol = [...rows].sort((a, b) => b.f.verified - a.f.verified)[0]!;
      return {
        text: `${cap(per)}, **${best.c.name}** has the best conversion rate at ${formatPercent(best.f.conversionRate)} (${formatNumber(best.f.verified)} verified from ${formatNumber(best.f.clicks)} clicks), against an average of ${formatPercent(cur.conversionRate)}.${byVol.c.id !== best.c.id ? ` By volume, ${byVol.c.name} leads with ${formatNumber(byVol.f.verified)} verified conversions.` : ""}`,
        bullets: ranked.slice(0, 4).map((x, i) => `${i + 1}. ${x.c.name} — ${formatPercent(x.f.conversionRate)} conversion · ${formatNumber(x.f.verified)} verified · ${formatCurrency(x.f.revenue)} revenue${!isAdv ? ` · ROAS ${formatRatio(x.roas)}` : ""}`),
        followUps: ["Why is conversion declining?", "Which rewards consume the most budget?", "Which products convert best?"],
      };
    }
    case "advocates": {
      if (isAdv) {
        const prev = funnel(refsInRange(input.referrals, previousRange(range)));
        return {
          text: `You only see your own referral data, so I can't rank other advocates here — your leaderboard position is on your dashboard. ${cap(per)} you recorded ${formatNumber(cur.verified)} verified conversions from ${formatNumber(cur.clicks)} clicks (${formatPercent(cur.conversionRate)}), versus ${formatNumber(prev.verified)} in the previous period.`,
          bullets: [`Qualified leads: ${formatNumber(cur.leads)}`, `Pending verification: ${formatNumber(cur.pending)}`, `Attributed revenue: ${formatCurrency(cur.revenue)}`],
          followUps: ["Which campaign performs best?", "What should I improve next?"],
        };
      }
      const pool = advocatePool(input);
      const board = leaderboard(pool.shops, pool.mechanics, input.referrals, input.rewards, range).filter((x) => x.clicks > 0);
      if (!board.length) return noData;
      const top = board.slice(0, 5);
      const topShare = cur.verified ? (top.reduce((s, x) => s + x.verified, 0) / cur.verified) * 100 : 0;
      return {
        text: `Your top advocates ${per}, ranked by verified conversions. Together the top ${top.length} account for ${formatPercent(topShare, 0)} of ${formatNumber(cur.verified)} verified conversions.`,
        bullets: top.map((x) => `#${x.rank} ${x.name} (${x.type}) — ${formatNumber(x.verified)} verified · ${formatPercent(x.conversionRate)} conversion · ${formatCurrency(x.revenue)} revenue`),
        followUps: ["Which advocates are inactive?", "Why is conversion declining?", "What should I improve next?"],
      };
    }
    case "inactive": {
      if (isAdv) return { text: `This question applies to network managers. ${cap(per)} you were ${cur.clicks ? `active with ${plural(cur.clicks, "referral click")}` : "not active — share your referral link to get started"}.`, followUps: ["What should I improve next?"] };
      const pool = advocatePool(input);
      const active = new Set(cohort.map((r) => r.advocateId));
      const verifiedPool = [...pool.shops.filter((s) => s.status === "verified").map((s) => ({ id: s.id, name: s.name, type: "shop" })), ...pool.mechanics.filter((m) => m.status === "verified").map((m) => ({ id: m.id, name: m.name, type: "mechanic" }))];
      const dormant = verifiedPool.filter((a) => !active.has(a.id));
      if (!dormant.length) return { text: `Every one of the ${formatNumber(verifiedPool.length)} verified advocates in scope recorded at least one referral click ${per}.`, followUps: ["Who are my top advocates?"] };
      return {
        text: `${formatNumber(dormant.length)} of ${formatNumber(verifiedPool.length)} verified advocates recorded 0 referral clicks ${per}. Inviting them to a new campaign is a low-cost way to re-engage them.`,
        bullets: dormant.slice(0, 6).map((a) => `${a.name} (${a.type})`),
        followUps: ["Who are my top advocates?", "What should I improve next?"],
      };
    }
    case "decline": {
      const prevRange = previousRange(range);
      const prev = funnel(refsInRange(input.referrals, prevRange));
      if (!cur.clicks || !prev.clicks) return { text: `I need activity both ${per} and in the previous period of the same length to compare conversion. ${!cur.clicks ? "The current period" : "The previous period"} has no referral clicks.`, followUps: ["Which campaign performs best?"] };
      const rate = (a: number, b: number) => (b ? (a / b) * 100 : 0);
      const steps = [
        { name: "Click → qualified lead", cur: rate(cur.leads, cur.clicks), prev: rate(prev.leads, prev.clicks) },
        { name: "Lead → purchase claim", cur: rate(cur.purchases, cur.leads), prev: rate(prev.purchases, prev.leads) },
        { name: "Claim → verified", cur: rate(cur.verified, cur.purchases), prev: rate(prev.verified, prev.purchases) },
      ];
      const rejCur = rate(cur.rejected, cur.purchases), rejPrev = rate(prev.rejected, prev.purchases);
      const weakest = [...steps].sort((a, b) => (a.cur - a.prev) - (b.cur - b.prev))[0]!;
      const diff = cur.conversionRate - prev.conversionRate;
      const prevByC = new Map(campaignRows(input, prevRange).map((x) => [x.c.id, x.f]));
      const drops = campaignRows(input, range)
        .filter((x) => x.f.clicks >= 10 && (prevByC.get(x.c.id)?.clicks ?? 0) >= 10)
        .map((x) => ({ name: x.c.name, cur: x.f.conversionRate, prev: prevByC.get(x.c.id)!.conversionRate }))
        .sort((a, b) => (a.cur - a.prev) - (b.cur - b.prev));
      const worstC = drops[0];
      const bullets = [
        ...steps.map((s) => `${s.name}: ${formatPercent(s.cur)} now vs ${formatPercent(s.prev)} before (${s.cur - s.prev >= 0 ? "+" : "−"}${Math.abs(s.cur - s.prev).toFixed(1)} pts)`),
        `Rejection rate of claims: ${formatPercent(rejCur)} vs ${formatPercent(rejPrev)}`,
      ];
      if (worstC && worstC.cur < worstC.prev) bullets.push(`Largest campaign drop: ${worstC.name} — ${formatPercent(worstC.cur)} vs ${formatPercent(worstC.prev)}`);
      const head = diff < -0.05
        ? `Conversion fell from ${formatPercent(prev.conversionRate)} to ${formatPercent(cur.conversionRate)} (${signed(delta(cur.conversionRate, prev.conversionRate))}) ${per} compared with the previous period. The weakest funnel step is **${weakest.name}**, which moved from ${formatPercent(weakest.prev)} to ${formatPercent(weakest.cur)}.`
        : `Conversion isn't declining ${per}: it is ${formatPercent(cur.conversionRate)} versus ${formatPercent(prev.conversionRate)} in the previous period. The step that changed least favourably is ${weakest.name} (${formatPercent(weakest.prev)} → ${formatPercent(weakest.cur)}).`;
      return {
        text: `${head} Note: recent clicks may still be awaiting purchase or verification, which naturally lowers the latest period's rate.`,
        bullets,
        followUps: ["Which campaign performs best?", "What should I improve next?", "Are there suspicious referrals?"],
      };
    }
    case "rewards": {
      const spendTotal = spendOf(input.rewards, () => true, range);
      if (!spendTotal) return { text: `No advocate rewards were accrued ${per} for your scope.`, followUps: ["Which campaign performs best?"] };
      const rows = input.campaigns
        .map((c) => ({ c, spend: spendOf(input.rewards, (t) => t.campaignId === c.id, range), util: c.budget ? (spendOf(input.rewards, (t) => t.campaignId === c.id) / c.budget) * 100 : 0 }))
        .filter((x) => x.spend > 0)
        .sort((a, b) => b.spend - a.spend);
      const commission = spendOf(input.rewards, (t) => t.type === "commission", range);
      const bonus = spendOf(input.rewards, (t) => t.type === "bonus", range);
      const top = rows[0];
      const w = wallet(input.rewards);
      return {
        text: `${isAdv ? "You earned" : "Advocate rewards totalled"} ${formatCurrency(spendTotal)} ${per} (${formatCurrency(commission)} commission, ${formatCurrency(bonus)} bonuses; reversals excluded).${top ? ` ${top.c.name} ${isAdv ? "paid you the most" : "consumes the most"} at ${formatCurrency(top.spend)} — ${formatPercent((top.spend / spendTotal) * 100, 0)} of the total.` : ""}`,
        bullets: [
          ...rows.slice(0, 4).map((x) => `${x.c.name}: ${formatCurrency(x.spend)}${!isAdv ? ` · ${formatPercent(x.util, 0)} of lifetime budget used` : ""}`),
          ...(role !== "brand" ? [`Reward redemption rate (lifetime): ${formatPercent(w.redemptionRate)} — ${formatCurrency(w.paidOut)} paid out of ${formatCurrency(w.approved)} approved`] : []),
        ],
        followUps: ["Which campaign performs best?", "What should I improve next?", "What is our attributed revenue?"],
      };
    }
    case "improve": {
      const recs = buildRecommendations(buildInsights(input), role);
      if (!recs.length) return { text: `Nothing stands out as needing attention ${per} — key metrics are within normal ranges. Keep monitoring conversion and budget use.`, followUps: ["Which campaign performs best?", "Who are my top advocates?"] };
      return {
        text: `Based on activity ${per}, here ${recs.length === 1 ? "is the action" : `are the ${Math.min(3, recs.length)} actions`} I'd prioritise:`,
        bullets: recs.slice(0, 3).map((r) => `${r.title} — ${r.detail}`),
        followUps: ["Why is conversion declining?", "Which rewards consume the most budget?", "Which products convert best?"],
      };
    }
    case "fraud": {
      if (isAdv) return { text: "Fraud monitoring is reviewed by the AdvocateX admin team. Your referral statuses and any rejection reasons are visible on the Referrals page.", followUps: ["What should I improve next?"] };
      const flags = scopeFlags(input.flags, input.referrals, role);
      const open = flags.filter((f) => f.status === "new" || f.status === "under_review");
      if (!flags.length) return { text: "There are no rule-based alerts linked to your scope.", followUps: ["Which campaign performs best?"] };
      return {
        text: `${plural(open.length, "alert")} ${open.length === 1 ? "is" : "are"} open (${flags.length} total). These are simulated rule-based alerts, not proof of fraud — each lists the rule that fired.`,
        bullets: [...open].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, 4).map((f) => `${f.id} · ${SEVERITY_LABEL[f.severity]} · ${FLAG_TYPE_LABEL[f.type]} — ${f.reason}`),
        followUps: ["What should I improve next?", "Who are my top advocates?"],
      };
    }
    case "revenue": {
      if (!cur.clicks) return noData;
      const prev = funnel(refsInRange(input.referrals, previousRange(range)));
      const spend = spendOf(input.rewards, () => true, range);
      const byC = campaignRows(input, range).filter((x) => x.f.revenue > 0).sort((a, b) => b.f.revenue - a.f.revenue);
      const byP = productRows(input, range).filter((x) => x.f.revenue > 0).sort((a, b) => b.f.revenue - a.f.revenue);
      return {
        text: `Attributed revenue ${per} is ${formatCurrency(cur.revenue)} from ${formatNumber(cur.verified)} verified purchases (${signed(delta(cur.revenue, prev.revenue))} vs previous period). Average order value is ${formatCurrency(cur.avgOrderValue)}.${!isAdv && spend ? ` With ${formatCurrency(spend)} in advocate rewards, ROAS is ${formatRatio(cur.revenue / spend)}.` : ""} Attributed revenue is the value of verified purchases — it is not profit.`,
        bullets: [
          ...(byC[0] ? [`Top campaign: ${byC[0].c.name} — ${formatCurrency(byC[0].f.revenue)}`] : []),
          ...(byP[0] ? [`Top product: ${byP[0].p.name} — ${formatCurrency(byP[0].f.revenue)}`] : []),
        ],
        followUps: ["Which rewards consume the most budget?", "Which products convert best?"],
      };
    }
    case "products": {
      const rows = productRows(input, range);
      if (!rows.length) return noData;
      const eligible = rows.filter((x) => x.f.clicks >= (isAdv ? 6 : RULES.minProductClicks));
      const ranked = [...(eligible.length ? eligible : rows)].sort((a, b) => b.f.conversionRate - a.f.conversionRate || b.f.verified - a.f.verified);
      const byRev = [...rows].sort((a, b) => b.f.revenue - a.f.revenue)[0]!;
      return {
        text: `**${ranked[0]!.p.name}** converts best ${per} at ${formatPercent(ranked[0]!.f.conversionRate)} (average ${formatPercent(cur.conversionRate)}). ${byRev.p.name} brings the most attributed revenue: ${formatCurrency(byRev.f.revenue)}.`,
        bullets: ranked.slice(0, 4).map((x) => `${x.p.name} — ${formatPercent(x.f.conversionRate)} · ${formatNumber(x.f.verified)} verified of ${formatNumber(x.f.clicks)} clicks`),
        followUps: ["Which campaign performs best?", "What should I improve next?"],
      };
    }
    case "help":
    default: {
      const intro = intent === "help" ? "I can answer questions about your demo data" : "I couldn't match that question to the data I can analyse. I can answer questions";
      return {
        text: `${intro} ${per}. Try asking about:`,
        bullets: [
          "Best-performing campaigns and products",
          isAdv ? "Your own referral performance" : "Top advocates and inactive advocates",
          "Why conversion is changing (funnel step comparison)",
          "Reward spend and budget use",
          "Attributed revenue and ROAS",
          ...(isAdv ? [] : ["Open fraud alerts"]),
          "What to improve next",
        ],
        followUps: SUGGESTED_QUESTIONS.slice(0, 3),
      };
    }
  }
}
