/**
 * Deterministic demo-data generator.
 *
 * Everything (campaign spend, budgets, wallet balances, loyalty points, fraud evidence)
 * is derived from one simulated stream of referral events, so every screen agrees.
 * Dates are relative to "now" so date filters (7/30/90 days) always show data.
 */
import type {
  AdvocateType, AppNotification, AuditEntry, Campaign, Customer, FraudFlag, LoyaltyTxn, Mechanic,
  Product, Purchase, Redemption, Referral, RewardTxn, Shop,
} from "@/types";
import { BRANDS, CITIES, CUSTOMER_NAMES, PRODUCTS_SEED, RAW_MECHANICS, RAW_SHOPS, STATES } from "./catalog";

export interface DemoData {
  shops: Shop[];
  mechanics: Mechanic[];
  products: Product[];
  campaigns: Campaign[];
  referrals: Referral[];
  rewards: RewardTxn[];
  customers: Customer[];
  purchases: Purchase[];
  loyalty: LoyaltyTxn[];
  redemptions: Redemption[];
  flags: FraudFlag[];
  notifications: AppNotification[];
  audit: AuditEntry[];
  generatedAt: string;
}

/* ---------- deterministic helpers ---------- */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoData(now = new Date()): DemoData {
  const rand = mulberry32(20261028);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const between = (a: number, b: number) => a + rand() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const poisson = (lambda: number) => {
    const L = Math.exp(-lambda); let k = 0; let p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  };

  const DAY = 86_400_000;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const at = (dayOffset: number, hour = 12, minute = 0) => {
    const d = new Date(startOfToday.getTime() + dayOffset * DAY);
    d.setHours(hour, minute, int(0, 59), 0);
    return d;
  };
  const iso = (d: Date) => d.toISOString();
  const dateOnly = (offset: number) => {
    const d = new Date(startOfToday.getTime() + offset * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const stateOf = (city: string) => CITIES.find((c) => c.city === city)!.state;
  const phone = () => `+91 9${int(100000000, 999999999)}`;

  /* ---------- advocates ---------- */
  const advMeta = new Map<string, { activity: number; quality: number }>();
  const shops: Shop[] = RAW_SHOPS.map(([name, owner, city, category, status, activity, quality], i) => {
    const id = `s${i + 1}`;
    advMeta.set(id, { activity, quality });
    const code = `SHP-${name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}${String(101 + i)}`;
    return {
      id, name, owner, city, state: stateOf(city), category, status,
      joinedAt: iso(at(status === "verified" ? -int(140, 420) : -int(1, 9), int(9, 18))),
      referralCode: code, campaignIds: [], phone: phone(),
      gstin: `27${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(66 + ((i * 3) % 24))}PK${int(1000, 9999)}${String.fromCharCode(70 + (i % 10))}1Z${i % 9}`,
      hue: Math.floor((i * 47) % 360),
    };
  });
  const mechanics: Mechanic[] = RAW_MECHANICS.map(([name, workshop, specialization, exp, city, status, activity, quality], i) => {
    const id = `m${i + 1}`;
    advMeta.set(id, { activity, quality });
    const code = `MEC-${name.split(" ")[0]!.toUpperCase().slice(0, 5)}${String(201 + i)}`;
    return {
      id, name, workshop, specialization, experienceYears: exp, city, state: stateOf(city), status,
      joinedAt: iso(at(status === "verified" ? -int(130, 400) : -int(1, 8), int(9, 18))),
      referralCode: code, campaignIds: [], phone: phone(), hue: Math.floor((i * 61 + 20) % 360),
    };
  });
  const advocates: { id: string; type: AdvocateType; state: string; code: string; verified: boolean }[] = [
    ...shops.map((s) => ({ id: s.id, type: "shop" as const, state: s.state, code: s.referralCode, verified: s.status === "verified" })),
    ...mechanics.map((m) => ({ id: m.id, type: "mechanic" as const, state: m.state, code: m.referralCode, verified: m.status === "verified" })),
  ];

  /* ---------- products ---------- */
  const products: Product[] = PRODUCTS_SEED.map((p, i) => ({ ...p, createdAt: iso(at(-int(150, 300) + i, 11)) }));
  const productById = new Map(products.map((p) => [p.id, p]));

  /* ---------- campaigns (budgets set after simulation) ---------- */
  type CampaignDef = Omit<Campaign, "budget" | "maxRewardPerAdvocate" | "createdAt" | "updatedAt" | "startDate" | "endDate"> & {
    start: number; end: number; activeUntil: number; targetUtil: number; fixedBudget?: number;
  };
  const defs: CampaignDef[] = [
    { id: "c1", name: "Monsoon Engine Care", brandId: "b1", description: "Encourage pre-monsoon oil changes with Veltrix synthetic and diesel oils. Advocates earn on every verified oil purchase; customers get bonus loyalty points.", productIds: ["p1", "p2", "p4", "p19"], start: -110, end: 20, activeUntil: 0, locations: ["Maharashtra", "Karnataka", "Gujarat", "Tamil Nadu"], advocateTypes: ["shop", "mechanic"], rewardPerConversion: 250, customerBonusPoints: 100, eligibility: "Verified advocates in target states. Purchase invoice must be uploaded within 7 days.", status: "active", targetUtil: 0.71 },
    { id: "c2", name: "Grip & Go Tyre Fest", brandId: "b2", description: "Nationwide tyre replacement drive. Mechanics and tyre shops recommend TorqueGrip for safer monsoon and highway driving.", productIds: ["p6", "p7", "p8", "p9"], start: -75, end: 45, activeUntil: 0, locations: STATES, advocateTypes: ["shop", "mechanic"], rewardPerConversion: 400, customerBonusPoints: 150, eligibility: "All verified advocates. Minimum purchase of 2 tyres for car referrals.", status: "active", targetUtil: 0.58 },
    { id: "c3", name: "Battery Health Check", brandId: "b3", description: "Free battery health checks at workshops that convert into VoltEdge battery and LED upgrades.", productIds: ["p10", "p11", "p12"], start: -60, end: 30, activeUntil: 0, locations: ["Maharashtra", "Telangana", "Karnataka", "Delhi", "Uttar Pradesh", "Rajasthan"], advocateTypes: ["mechanic", "shop"], rewardPerConversion: 300, customerBonusPoints: 120, eligibility: "Verified mechanics and electrical shops. Old battery must be exchanged.", status: "active", targetUtil: 0.64 },
    { id: "c4", name: "Brake Safety Month", brandId: "b4", description: "Mechanic-led brake inspection programme promoting StopRight pads, rotors and filters.", productIds: ["p14", "p15", "p16", "p17", "p18"], start: -120, end: -40, activeUntil: -40, locations: STATES, advocateTypes: ["mechanic"], rewardPerConversion: 200, customerBonusPoints: 80, eligibility: "Verified mechanics only. Inspection checklist required.", status: "completed", targetUtil: 0.96 },
    { id: "c5", name: "Festive Service Bonanza", brandId: "b1", description: "Festive-season servicing push with extra customer points on Veltrix oils and coolants.", productIds: ["p1", "p3", "p5", "p19"], start: -35, end: 10, activeUntil: 0, locations: ["Maharashtra", "Gujarat", "Madhya Pradesh", "Rajasthan", "Delhi"], advocateTypes: ["shop", "mechanic"], rewardPerConversion: 350, customerBonusPoints: 200, eligibility: "Verified advocates. One reward per customer per product per month.", status: "active", targetUtil: 0.91 },
    { id: "c6", name: "Winter Start Assurance", brandId: "b3", description: "Cold-start readiness campaign for northern cities, focused on car and bike batteries.", productIds: ["p10", "p11"], start: 12, end: 100, activeUntil: -999, locations: ["Delhi", "Uttar Pradesh", "Rajasthan", "Madhya Pradesh"], advocateTypes: ["shop", "mechanic"], rewardPerConversion: 320, customerBonusPoints: 150, eligibility: "Verified advocates in northern states.", status: "scheduled", targetUtil: 0, fixedBudget: 60000 },
    { id: "c7", name: "Coolant Switch Drive", brandId: "b1", description: "Encourage customers to switch from water to long-life coolant during servicing.", productIds: ["p3", "p4"], start: -90, end: 30, activeUntil: -20, locations: ["Tamil Nadu", "Karnataka", "Telangana"], advocateTypes: ["mechanic"], rewardPerConversion: 150, customerBonusPoints: 60, eligibility: "Verified mechanics. Paused for budget review.", status: "paused", targetUtil: 0.47 },
    { id: "c8", name: "Synthetic Upgrade Program", brandId: "b1", description: "Upgrade customers from mineral to full-synthetic oil with a premium advocate reward.", productIds: ["p1", "p19"], start: 30, end: 120, activeUntil: -999, locations: ["Maharashtra", "Karnataka"], advocateTypes: ["shop", "mechanic"], rewardPerConversion: 300, customerBonusPoints: 150, eligibility: "Draft — eligibility under review.", status: "draft", targetUtil: 0, fixedBudget: 75000 },
  ];

  // participation
  const participation = new Map<string, string[]>(); // campaign -> advocate ids
  for (const c of defs) {
    const list: string[] = [];
    if (c.status === "draft") { participation.set(c.id, list); continue; }
    for (const a of advocates) {
      if (!a.verified || !c.advocateTypes.includes(a.type) || !c.locations.includes(a.state)) continue;
      const forced = (a.id === "m1" || a.id === "s1" || a.id === "m5" || a.id === "m13" || a.id === "s11");
      if (forced || rand() < 0.72) list.push(a.id);
    }
    participation.set(c.id, list);
  }
  for (const [cid, ids] of participation) for (const id of ids) {
    const s = shops.find((x) => x.id === id); if (s) s.campaignIds.push(cid);
    const m = mechanics.find((x) => x.id === id); if (m) m.campaignIds.push(cid);
  }

  /* ---------- referral simulation ---------- */
  const referrals: Referral[] = [];
  const nowMs = now.getTime();
  const curHour = now.getHours();
  const channels: Referral["channel"][] = ["QR", "QR", "Link", "WhatsApp", "WhatsApp", "In-store"];
  const customerIds = CUSTOMER_NAMES.map((_, i) => `cu${i + 1}`);
  const usedInvoices = new Set<string>();
  const invoice = () => { let v: string; do { v = `INV-${int(100000, 999999)}`; } while (usedInvoices.has(v)); usedInvoices.add(v); return v; };
  const visitor = () => `VIS-••${int(1000, 9999)}`;
  const custRef = (cid: string) => `CUS-••${String(4000 + Number(cid.slice(2)) * 37).slice(-4)}`;

  for (const c of defs) {
    if (c.status === "draft" || c.status === "scheduled") continue;
    const from = Math.max(c.start, -120);
    const to = Math.min(c.end, c.activeUntil, 0);
    for (const advId of participation.get(c.id)!) {
      const meta = advMeta.get(advId)!;
      const adv = advocates.find((a) => a.id === advId)!;
      for (let d = from; d <= to; d++) {
        const progress = (d + 120) / 120; // growth trend
        const dow = at(d).getDay();
        const weekend = dow === 0 || dow === 6 ? 1.25 : 1;
        const launchBoost = d - c.start < 7 ? 1.35 : 1;
        const lambda = meta.activity * 0.36 * (0.72 + 0.45 * progress) * weekend * launchBoost;
        const n = poisson(lambda);
        for (let k = 0; k < n; k++) {
          const maxHour = d === 0 ? Math.min(21, curHour) : 21;
          if (maxHour < 8) continue;
          const clickAt = at(d, int(8, maxHour), int(0, 59));
          if (clickAt.getTime() > nowMs) continue;
          const product = productById.get(pick(c.productIds))!;
          const r: Referral = {
            id: "", advocateId: advId, advocateType: adv.type, code: adv.code, campaignId: c.id, productId: product.id,
            customerRef: visitor(), createdAt: iso(clickAt), status: "clicked", purchaseValue: 0, reward: 0, channel: pick(channels),
          };
          const q = meta.quality;
          if (rand() < Math.min(0.9, 0.42 * q)) {
            const leadAt = new Date(clickAt.getTime() + int(10, 600) * 60_000);
            if (leadAt.getTime() <= nowMs) {
              r.status = "lead"; r.leadAt = iso(leadAt);
              if (rand() < Math.min(0.9, 0.52 * q)) {
                const purchaseAt = new Date(leadAt.getTime() + int(1, 72) * 3_600_000);
                if (purchaseAt.getTime() <= nowMs) {
                  const qty = product.category === "Tyres" && product.id !== "p8" ? pick([2, 2, 4, 4, 1]) : 1;
                  const cid = pick(customerIds.slice(1)); // cu1 assigned explicitly below
                  r.customerId = cid; r.customerRef = custRef(cid);
                  r.purchaseAt = iso(purchaseAt); r.purchaseValue = product.price * qty; r.txnRef = invoice();
                  const ageDays = (nowMs - purchaseAt.getTime()) / DAY;
                  if (ageDays < 6 && rand() < 0.75) { r.status = "pending"; r.reward = c.rewardPerConversion; }
                  else if (rand() < (q < 0.7 ? 0.2 : 0.07)) {
                    r.status = "rejected"; r.rejectedAt = iso(new Date(Math.min(nowMs, purchaseAt.getTime() + int(1, 3) * DAY)));
                    r.rejectReason = pick(["Invoice could not be matched to the participating shop", "Product not eligible for this campaign", "Duplicate claim for the same customer and product"]);
                  } else {
                    r.status = "verified"; r.reward = c.rewardPerConversion;
                    r.verifiedAt = iso(new Date(Math.min(nowMs, purchaseAt.getTime() + int(4, 60) * 3_600_000)));
                  }
                }
              }
            }
          }
          referrals.push(r);
        }
      }
    }
  }

  /* ---------- injected anomalies (fuel the fraud monitor) ---------- */
  const rakesh = advocates.find((a) => a.id === "m5")!;
  const burstIds: string[] = [];
  const burstVisitors = [visitor(), visitor()];
  for (let i = 0; i < 16; i++) {
    const t = at(-3, 14, 0); t.setMinutes(5 + Math.floor(i * 5.5));
    referrals.push({ id: "", advocateId: rakesh.id, advocateType: "mechanic", code: rakesh.code, campaignId: "c2", productId: pick(["p7", "p9"]), customerRef: burstVisitors[i % 2]!, createdAt: iso(t), status: "clicked", purchaseValue: 0, reward: 0, channel: "Link" });
    burstIds.push(`__burst${i}`);
  }
  const dupTxn = "TXN-554120";
  const dupMarkers: string[] = [];
  for (let i = 0; i < 3; i++) {
    const click = at(-2, 10 + i, 12);
    const cid = customerIds[20 + i]!;
    referrals.push({ id: "", advocateId: rakesh.id, advocateType: "mechanic", code: rakesh.code, campaignId: "c3", productId: "p10", customerRef: custRef(cid), customerId: cid, createdAt: iso(click), leadAt: iso(new Date(click.getTime() + 20 * 60_000)), purchaseAt: iso(new Date(click.getTime() + 2 * 3_600_000)), status: "pending", purchaseValue: 6900, reward: 300, txnRef: dupTxn, channel: "WhatsApp" });
    dupMarkers.push(`__dup${i}`);
  }
  const diamond = advocates.find((a) => a.id === "s11")!;
  for (let i = 0; i < 9; i++) {
    const click = at(-1, 9 + i, 5 * i);
    const cid = customerIds[30 + i]!;
    const p = productById.get(pick(["p1", "p5", "p3"]))!;
    referrals.push({ id: "", advocateId: diamond.id, advocateType: "shop", code: diamond.code, campaignId: "c5", productId: p.id, customerRef: custRef(cid), customerId: cid, createdAt: iso(click), leadAt: iso(new Date(click.getTime() + 5 * 60_000)), purchaseAt: iso(new Date(click.getTime() + 25 * 60_000)), status: "pending", purchaseValue: p.price, reward: 350, txnRef: invoice(), channel: "In-store" });
  }
  const sachin = advocates.find((a) => a.id === "m13")!;
  const repeatCust = customerIds[44]!;
  for (let i = 0; i < 4; i++) {
    const click = at(-9 + i * 2, 11 + i, 30);
    const p = productById.get(pick(["p7", "p9"]))!;
    referrals.push({ id: "", advocateId: sachin.id, advocateType: "mechanic", code: sachin.code, campaignId: "c2", productId: p.id, customerRef: custRef(repeatCust), customerId: repeatCust, createdAt: iso(click), leadAt: iso(new Date(click.getTime() + 15 * 60_000)), purchaseAt: iso(new Date(click.getTime() + 3 * 3_600_000)), status: i < 2 ? "verified" : "pending", verifiedAt: i < 2 ? iso(new Date(click.getTime() + 30 * 3_600_000)) : undefined, purchaseValue: p.price * 2, reward: 400, txnRef: invoice(), channel: "WhatsApp" });
  }

  // sort chronologically and assign stable ids
  referrals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  referrals.forEach((r, i) => { r.id = `REF-${String(10001 + i)}`; });

  const byAdv = (id: string) => referrals.filter((r) => r.advocateId === id);
  const rakeshBurst = byAdv("m5").filter((r) => r.customerRef === burstVisitors[0] || r.customerRef === burstVisitors[1]);
  const rakeshDup = referrals.filter((r) => r.txnRef === dupTxn);
  const diamondSpike = byAdv("s11").filter((r) => r.status === "pending" && r.channel === "In-store" && new Date(r.createdAt).getTime() >= at(-1, 0).getTime());
  const sachinRepeat = referrals.filter((r) => r.advocateId === "m13" && r.customerId === repeatCust);

  // Rakesh: three earlier verified referrals reversed after audit
  const rakeshReversed = byAdv("m5").filter((r) => r.status === "verified" && new Date(r.createdAt).getTime() < at(-25).getTime()).slice(-3);
  for (const r of rakeshReversed) {
    r.status = "rejected"; r.rejectReason = "Reward reversed after audit: invoice could not be matched";
    r.rejectedAt = iso(new Date(new Date(r.verifiedAt!).getTime() + 8 * DAY));
  }

  // Demo customer (cu1) gets a purchase history from Maharashtra advocates.
  const maharashtraIds = new Set(advocates.filter((a) => a.state === "Maharashtra").map((a) => a.id));
  const priyaCandidates = referrals.filter((r) => r.status === "verified" && maharashtraIds.has(r.advocateId) && r.advocateId !== "m13");
  const step = Math.max(1, Math.floor(priyaCandidates.length / 9));
  for (let i = 0; i < 9 && i * step < priyaCandidates.length; i++) {
    const r = priyaCandidates[i * step + (i % 2)] ?? priyaCandidates[i * step]!;
    r.customerId = "cu1"; r.customerRef = custRef("cu1");
  }

  /* ---------- reward ledger ---------- */
  const rewards: RewardTxn[] = [];
  let rwSeq = 50001;
  const rwId = () => `RW-${rwSeq++}`;
  for (const r of referrals) {
    if (r.status === "verified") {
      const age = (nowMs - new Date(r.verifiedAt!).getTime()) / DAY;
      rewards.push({ id: "", advocateId: r.advocateId, advocateType: r.advocateType, type: "commission", status: age > 5 ? "approved" : "pending", amount: r.reward, referralId: r.id, campaignId: r.campaignId, date: r.verifiedAt!, note: "Verified conversion reward" });
    }
  }
  for (const r of rakeshReversed) {
    const campaign = defs.find((d) => d.id === r.campaignId)!;
    rewards.push({ id: "", advocateId: r.advocateId, advocateType: r.advocateType, type: "commission", status: "reversed", amount: campaign.rewardPerConversion, referralId: r.id, campaignId: r.campaignId, date: r.verifiedAt!, note: "Reversed after invoice audit" });
    r.reward = 0;
  }
  // milestone bonuses at the 25th verified conversion
  for (const a of advocates) {
    const conv = referrals.filter((r) => r.advocateId === a.id && r.status === "verified");
    if (conv.length >= 25) {
      rewards.push({ id: "", advocateId: a.id, advocateType: a.type, type: "bonus", status: "approved", amount: 1000, date: conv[24]!.verifiedAt!, note: "Milestone bonus: 25 verified conversions" });
    }
  }
  rewards.sort((a, b) => a.date.localeCompare(b.date));
  // monthly simulated payouts
  for (const payoutDay of [-90, -60, -30]) {
    const cut = at(payoutDay, 18).getTime();
    for (const a of advocates) {
      const earned = rewards.filter((t) => t.advocateId === a.id && (t.type === "commission" || t.type === "bonus") && t.status === "approved" && new Date(t.date).getTime() < cut - 5 * DAY).reduce((s, t) => s + t.amount, 0);
      const paid = rewards.filter((t) => t.advocateId === a.id && t.type === "payout").reduce((s, t) => s + t.amount, 0);
      const avail = Math.floor((earned - paid) / 100) * 100;
      if (avail >= 500) rewards.push({ id: "", advocateId: a.id, advocateType: a.type, type: "payout", status: "paid", amount: avail, date: iso(at(payoutDay, 18)), note: "Monthly payout (simulated)" });
    }
  }
  // two open payout requests for the admin approval queue
  for (const advId of ["m2", "s3"]) {
    const a = advocates.find((x) => x.id === advId)!;
    const earned = rewards.filter((t) => t.advocateId === advId && (t.type === "commission" || t.type === "bonus") && t.status === "approved").reduce((s, t) => s + t.amount, 0);
    const paid = rewards.filter((t) => t.advocateId === advId && t.type === "payout").reduce((s, t) => s + t.amount, 0);
    const amt = Math.floor((earned - paid) / 100) * 100;
    if (amt >= 500) rewards.push({ id: "", advocateId: advId, advocateType: a.type, type: "payout", status: "requested", amount: amt, date: iso(at(-1, 16)), note: "Payout request (simulated)" });
  }
  rewards.sort((a, b) => a.date.localeCompare(b.date));
  rewards.forEach((t) => { t.id = rwId(); });

  /* ---------- finalise campaigns: budgets derived from actual spend ---------- */
  const campaigns: Campaign[] = defs.map((d) => {
    const spend = rewards.filter((t) => t.campaignId === d.id && t.type === "commission" && t.status !== "reversed").reduce((s, t) => s + t.amount, 0);
    const budget = d.fixedBudget ?? Math.max(10000, Math.ceil(spend / d.targetUtil / 2500) * 2500);
    const perAdv = new Map<string, number>();
    for (const t of rewards) if (t.campaignId === d.id && t.type === "commission" && t.status !== "reversed") perAdv.set(t.advocateId, (perAdv.get(t.advocateId) ?? 0) + t.amount);
    const maxAdv = Math.max(0, ...perAdv.values());
    const maxRewardPerAdvocate = Math.max(2500, Math.ceil((maxAdv * 1.5) / 500) * 500);
    const { start, end, activeUntil, targetUtil, fixedBudget, ...rest } = d;
    return { ...rest, startDate: dateOnly(start), endDate: dateOnly(end), budget, maxRewardPerAdvocate, createdAt: iso(at(Math.min(start, 0) - 10, 11)), updatedAt: iso(at(d.status === "paused" ? -20 : Math.min(start, 0) - 2, 15)) };
  });

  /* ---------- customers, purchases, loyalty ---------- */
  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => {
    const city = i === 0 ? "Pune" : pick(CITIES).city;
    return { id: `cu${i + 1}`, name, city, joinedAt: iso(at(-int(150, 500), 12)), email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, hue: (i * 53) % 360 };
  });
  customers[0]!.joinedAt = iso(at(-210, 12));
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const purchases: Purchase[] = referrals
    .filter((r) => r.status === "verified" && r.customerId)
    .map((r, i) => {
      const p = productById.get(r.productId)!;
      const qty = Math.max(1, Math.round(r.purchaseValue / p.price));
      return { id: `PUR-${70001 + i}`, customerId: r.customerId!, productId: r.productId, advocateId: r.advocateId, date: r.purchaseAt!, amount: r.purchaseValue, points: p.loyaltyPoints * qty + campaignById.get(r.campaignId)!.customerBonusPoints, referralId: r.id };
    });

  const loyalty: LoyaltyTxn[] = [];
  let ltSeq = 1;
  const lt = (t: Omit<LoyaltyTxn, "id">) => loyalty.push({ id: `LT-${String(ltSeq++).padStart(5, "0")}`, ...t });
  for (const c of customers) {
    lt({ customerId: c.id, date: c.joinedAt, points: 200, type: "bonus", description: "Welcome bonus" });
  }
  for (const p of purchases) {
    const prod = productById.get(p.productId)!;
    lt({ customerId: p.customerId, date: p.date, points: p.points, type: "earn", description: `Purchase: ${prod.name}` });
  }
  lt({ customerId: "cu1", date: iso(at(-48, 10)), points: 150, type: "bonus", description: "Birthday bonus" });
  lt({ customerId: "cu1", date: iso(at(-14, 10)), points: 250, type: "bonus", description: "Tier upgrade bonus: Gold" });
  const redemptions: Redemption[] = [
    { id: "RDM-3001", customerId: "cu1", rewardId: "rw1", date: iso(at(-70, 17)), points: 300, code: "AX-WASH-7Q2K", status: "used" },
    { id: "RDM-3002", customerId: "cu1", rewardId: "rw3", date: iso(at(-22, 12)), points: 900, code: "AX-ALGN-4M8P", status: "issued" },
  ];
  lt({ customerId: "cu1", date: redemptions[0]!.date, points: -300, type: "redeem", description: "Redeemed: Free Car Wash & Vacuum" });
  lt({ customerId: "cu1", date: redemptions[1]!.date, points: -900, type: "redeem", description: "Redeemed: Wheel Alignment & Balancing" });
  loyalty.sort((a, b) => a.date.localeCompare(b.date));

  /* ---------- fraud flags (evidence computed from the data above) ---------- */
  const advName = (id: string) => shops.find((s) => s.id === id)?.name ?? mechanics.find((m) => m.id === id)?.name ?? id;
  const ravi = byAdv("m2");
  const raviByDay = new Map<string, Referral[]>();
  for (const r of ravi) { const k = r.createdAt.slice(0, 10); raviByDay.set(k, [...(raviByDay.get(k) ?? []), r]); }
  const raviPeak = [...raviByDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const raviAvg = ravi.length / Math.max(1, raviByDay.size);
  const patel = byAdv("s5");
  let patelPair: Referral[] = [];
  for (let i = 1; i < patel.length; i++) {
    if (new Date(patel[i]!.createdAt).getTime() - new Date(patel[i - 1]!.createdAt).getTime() < 40 * 60_000) { patelPair = [patel[i - 1]!, patel[i]!]; break; }
  }
  const flags: FraudFlag[] = [
    { id: "FL-1001", type: "high_frequency", severity: "high", advocateId: "m5", advocateType: "mechanic", status: "new",
      reason: `${rakeshBurst.length} referral clicks within 90 minutes from only 2 visitor identifiers.`,
      detectedAt: iso(new Date(new Date(rakeshBurst.at(-1)!.createdAt).getTime() + 12 * 60_000)),
      evidence: [`Click window: ${new Date(rakeshBurst[0]!.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} – ${new Date(rakeshBurst.at(-1)!.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`, `Visitor identifiers: ${burstVisitors.join(", ")}`, "No clicks progressed to a qualified lead", `Rule: more than 10 clicks per hour from fewer than 3 visitors`],
      referralIds: rakeshBurst.map((r) => r.id) },
    { id: "FL-1002", type: "repeated_txn", severity: "critical", advocateId: "m5", advocateType: "mechanic", status: "under_review",
      reason: `Invoice reference ${dupTxn} was submitted on ${rakeshDup.length} separate purchase claims.`,
      detectedAt: iso(new Date(new Date(rakeshDup.at(-1)!.purchaseAt!).getTime() + 30 * 60_000)),
      evidence: [...rakeshDup.map((r) => `${r.id} · ${r.customerRef} · ₹${r.purchaseValue.toLocaleString("en-IN")}`), "Rule: transaction reference must be unique per claim"],
      referralIds: rakeshDup.map((r) => r.id) },
    { id: "FL-1003", type: "conversion_spike", severity: "medium", advocateId: "s11", advocateType: "shop", status: "new",
      reason: `${diamondSpike.length} purchase claims in a single day — well above this shop's usual daily volume.`,
      detectedAt: iso(new Date(new Date(diamondSpike.at(-1)!.purchaseAt!).getTime() + 40 * 60_000)),
      evidence: [`${diamondSpike.length} claims between ${new Date(diamondSpike[0]!.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} and ${new Date(diamondSpike.at(-1)!.purchaseAt!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`, "All claims recorded as In-store channel", `Average click-to-purchase time: 25 minutes`, "Rule: daily claims exceed 5x the 30-day average"],
      referralIds: diamondSpike.map((r) => r.id) },
    { id: "FL-1004", type: "duplicate_pattern", severity: "medium", advocateId: "m13", advocateType: "mechanic", status: "new",
      reason: `The same customer (${custRef(repeatCust)}) is linked to ${sachinRepeat.length} referrals within 7 days.`,
      detectedAt: iso(new Date(new Date(sachinRepeat.at(-1)!.purchaseAt!).getTime() + 3 * 3_600_000)),
      evidence: [...sachinRepeat.map((r) => `${r.id} · ${productById.get(r.productId)!.name.split(" ").slice(0, 3).join(" ")} · ${r.status}`), "Rule: one reward per customer per product category per 30 days"],
      referralIds: sachinRepeat.map((r) => r.id) },
    { id: "FL-1005", type: "reward_abuse", severity: "high", advocateId: "m5", advocateType: "mechanic", status: "resolved",
      reason: `${rakeshReversed.length} rewards reversed after invoice audit failed to match the participating workshop.`,
      detectedAt: rakeshReversed[0]?.rejectedAt ?? iso(at(-30)),
      evidence: rakeshReversed.map((r) => `${r.id} · reward reversed · ${r.txnRef}`),
      referralIds: rakeshReversed.map((r) => r.id), reviewNote: "Rewards reversed. Advocate warned and placed on enhanced verification." },
    ...(raviPeak ? [{ id: "FL-1006", type: "high_frequency" as const, severity: "low" as const, advocateId: "m2", advocateType: "mechanic" as const, status: "dismissed" as const,
      reason: `Click volume on ${new Date(raviPeak[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} was ${(raviPeak[1].length / raviAvg).toFixed(1)}x this advocate's daily average.`,
      detectedAt: iso(new Date(new Date(raviPeak[1].at(-1)!.createdAt).getTime() + 60 * 60_000)),
      evidence: [`${raviPeak[1].length} clicks vs average ${raviAvg.toFixed(1)} per active day`, `${raviPeak[1].filter((r) => r.status !== "clicked").length} of these progressed beyond a click`],
      referralIds: raviPeak[1].map((r) => r.id), reviewNote: "Dismissed — explained by an in-store promotion day at the workshop." }] : []),
    ...(patelPair.length ? [{ id: "FL-1007", type: "duplicate_pattern" as const, severity: "low" as const, advocateId: "s5", advocateType: "shop" as const, status: "dismissed" as const,
      reason: "Two referral clicks within 40 minutes on the same campaign link.",
      detectedAt: iso(new Date(new Date(patelPair[1]!.createdAt).getTime() + 30 * 60_000)),
      evidence: patelPair.map((r) => `${r.id} · ${r.customerRef} · ${r.channel}`),
      referralIds: patelPair.map((r) => r.id), reviewNote: "Dismissed — different visitors, normal counter traffic." }] : []),
  ];

  /* ---------- notifications ---------- */
  const firstVerifiedM1 = referrals.filter((r) => r.advocateId === "m1" && r.status === "verified").at(-1);
  const firstVerifiedS1 = referrals.filter((r) => r.advocateId === "s1" && r.status === "verified").at(-1);
  const notifications: AppNotification[] = [
    { id: "N-1", type: "fraud", title: "Suspicious activity flagged", body: `${advName("m5")}: ${flags[0]!.reason}`, at: flags[0]!.detectedAt, read: false, roles: ["admin"], link: "/app/fraud" },
    { id: "N-2", type: "fraud", title: "Conversion spike detected", body: `${advName("s11")}: ${flags[2]!.reason}`, at: flags[2]!.detectedAt, read: false, roles: ["admin", "brand"], link: "/app/fraud" },
    { id: "N-3", type: "approval", title: "New shop awaiting approval", body: `${shops[14]!.name} (${shops[14]!.city}) submitted verification documents.`, at: shops[14]!.joinedAt, read: false, roles: ["admin"], link: "/app/approvals" },
    { id: "N-4", type: "approval", title: "New mechanic awaiting approval", body: `${mechanics[19]!.name}, ${mechanics[19]!.workshop} requested to join as an advocate.`, at: mechanics[19]!.joinedAt, read: true, roles: ["admin"], link: "/app/approvals" },
    { id: "N-5", type: "campaign", title: "Campaign launched", body: "Festive Service Bonanza is live across 5 states.", at: iso(at(-35, 9)), read: true, roles: ["admin", "brand", "shop", "mechanic"], link: "/app/campaigns/c5" },
    { id: "N-6", type: "campaign", title: "Budget alert", body: "Festive Service Bonanza has used over 90% of its budget.", at: iso(at(-1, 19)), read: false, roles: ["admin", "brand"], link: "/app/campaigns/c5" },
    { id: "N-7", type: "campaign", title: "Campaign scheduled", body: "Winter Start Assurance will launch in 12 days.", at: iso(at(-4, 11)), read: true, roles: ["admin", "shop", "mechanic"], link: "/app/campaigns/c6" },
    ...(firstVerifiedM1 ? [{ id: "N-8", type: "conversion" as const, title: "Referral converted", body: `${firstVerifiedM1.id} was verified — ₹${firstVerifiedM1.reward} reward added to your wallet.`, at: firstVerifiedM1.verifiedAt!, read: false, roles: ["mechanic" as const], link: "/app/referrals" }] : []),
    ...(firstVerifiedS1 ? [{ id: "N-9", type: "conversion" as const, title: "Referral converted", body: `${firstVerifiedS1.id} was verified — ₹${firstVerifiedS1.reward} reward added to your wallet.`, at: firstVerifiedS1.verifiedAt!, read: false, roles: ["shop" as const], link: "/app/referrals" }] : []),
    { id: "N-10", type: "reward", title: "Monthly payout processed", body: "Your simulated payout for last month has been marked as paid.", at: iso(at(-30, 18)), read: true, roles: ["shop", "mechanic"], link: "/app/rewards" },
    { id: "N-11", type: "reward", title: "Payout requests pending", body: "2 advocate payout requests are waiting for approval.", at: iso(at(-1, 16)), read: false, roles: ["admin"], link: "/app/approvals" },
    { id: "N-12", type: "loyalty", title: "You reached Gold tier", body: "Congratulations! Gold unlocks AC service and service-credit rewards.", at: iso(at(-14, 10)), read: false, roles: ["customer"], link: "/app/loyalty" },
    { id: "N-13", type: "loyalty", title: "New reward available", body: "₹1,000 Service Credit is now available for Gold members.", at: iso(at(-6, 12)), read: false, roles: ["customer"], link: "/app/loyalty" },
    { id: "N-14", type: "campaign", title: "Offer for you", body: "Earn 200 bonus points on Veltrix oils during Festive Service Bonanza.", at: iso(at(-30, 9)), read: true, roles: ["customer"], link: "/app/loyalty" },
    { id: "N-15", type: "approval", title: "Shop approved", body: "Narmada Tyres & Wheels is now a verified advocate.", at: iso(at(-12, 15)), read: true, roles: ["admin", "brand"], link: "/app/shops" },
    { id: "N-16", type: "campaign", title: "New campaign available", body: "You are eligible for Battery Health Check. Share your code to start earning.", at: iso(at(-60, 9)), read: true, roles: ["shop", "mechanic"], link: "/app/campaigns/c3" },
    { id: "N-17", type: "system", title: "Weekly performance digest", body: "Your weekly referral summary is ready in Analytics.", at: iso(at(-2, 8)), read: true, roles: ["admin", "brand", "shop", "mechanic"], link: "/app/analytics" },
  ];

  /* ---------- audit log ---------- */
  let auSeq = 9001;
  const audit: AuditEntry[] = [];
  const au = (e: Omit<AuditEntry, "id">) => audit.push({ id: `AU-${auSeq++}`, ...e });
  au({ at: iso(at(-120, 10)), actor: "Neha Verma", role: "admin", action: "Activated campaign", category: "campaign", target: "Brake Safety Month (c4)" });
  au({ at: iso(at(-110, 10)), actor: "Rohit Kapoor", role: "brand", action: "Activated campaign", category: "campaign", target: "Monsoon Engine Care (c1)" });
  au({ at: iso(at(-90, 18)), actor: "System", role: "system", action: "Processed monthly payouts", category: "reward", target: "Advocate wallets" });
  au({ at: iso(at(-75, 9)), actor: "Neha Verma", role: "admin", action: "Activated campaign", category: "campaign", target: "Grip & Go Tyre Fest (c2)" });
  au({ at: iso(at(-60, 9)), actor: "Neha Verma", role: "admin", action: "Activated campaign", category: "campaign", target: "Battery Health Check (c3)" });
  au({ at: iso(at(-60, 18)), actor: "System", role: "system", action: "Processed monthly payouts", category: "reward", target: "Advocate wallets" });
  au({ at: iso(at(-40, 23, 59)), actor: "System", role: "system", action: "Completed campaign", category: "campaign", target: "Brake Safety Month (c4)" });
  au({ at: iso(at(-35, 9)), actor: "Rohit Kapoor", role: "brand", action: "Activated campaign", category: "campaign", target: "Festive Service Bonanza (c5)" });
  au({ at: iso(at(-30, 18)), actor: "System", role: "system", action: "Processed monthly payouts", category: "reward", target: "Advocate wallets" });
  if (flags[4]) au({ at: flags[4].detectedAt, actor: "Neha Verma", role: "admin", action: "Reversed rewards", category: "reward", target: `${advName("m5")} (${rakeshReversed.length} referrals)`, details: "Invoice audit failed" });
  au({ at: iso(at(-20, 15)), actor: "Rohit Kapoor", role: "brand", action: "Paused campaign", category: "campaign", target: "Coolant Switch Drive (c7)", details: "Budget review" });
  au({ at: iso(at(-12, 15)), actor: "Neha Verma", role: "admin", action: "Approved shop", category: "approval", target: "Narmada Tyres & Wheels (s10)" });
  au({ at: iso(at(-6, 11)), actor: "Rohit Kapoor", role: "brand", action: "Created draft campaign", category: "campaign", target: "Synthetic Upgrade Program (c8)" });
  au({ at: iso(at(-5, 9)), actor: "Neha Verma", role: "admin", action: "Rejected mechanic application", category: "approval", target: "Rajeev Saxena (m24)", details: "Incomplete workshop documents" });
  au({ at: iso(at(-4, 11)), actor: "Neha Verma", role: "admin", action: "Scheduled campaign", category: "campaign", target: "Winter Start Assurance (c6)" });
  au({ at: flags[1]!.detectedAt, actor: "System", role: "system", action: "Raised fraud flag", category: "fraud", target: `FL-1002 · ${advName("m5")}` });
  au({ at: iso(new Date(new Date(flags[1]!.detectedAt).getTime() + 3_600_000)), actor: "Neha Verma", role: "admin", action: "Marked flag under review", category: "fraud", target: "FL-1002" });
  au({ at: flags[0]!.detectedAt, actor: "System", role: "system", action: "Raised fraud flag", category: "fraud", target: `FL-1001 · ${advName("m5")}` });
  au({ at: flags[2]!.detectedAt, actor: "System", role: "system", action: "Raised fraud flag", category: "fraud", target: `FL-1003 · ${advName("s11")}` });
  au({ at: iso(at(-1, 16)), actor: "System", role: "system", action: "Received payout requests", category: "reward", target: "2 advocates" });
  audit.sort((a, b) => b.at.localeCompare(a.at));

  return { shops, mechanics, products, campaigns, referrals, rewards, customers, purchases, loyalty, redemptions, flags, notifications, audit, generatedAt: iso(now) };
}

// quick reference for brand lookups used across the app
export const brandName = (id: string) => BRANDS.find((b) => b.id === id)?.name ?? "Unknown brand";
