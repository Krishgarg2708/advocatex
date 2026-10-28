/**
 * Client-side "database" for the demo.
 *
 * Every mutation the UI performs lives here as an action. When a backend arrives,
 * replace each action body with an API call (see src/services/api.ts) and keep the
 * same signature — pages do not need to change.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AdvocateType, AppNotification, AuditEntry, Campaign, CampaignStatus, FlagStatus, Mechanic, Product, Redemption,
  RewardTxn, Role, Shop,
} from "@/types";
import { generateDemoData, type DemoData } from "@/data/generate";
import { REWARD_CATALOG } from "@/data/catalog";
import { useAuthStore } from "./auth";
import { customerLoyalty, tierRank } from "@/lib/metrics";

export type CampaignInput = Omit<Campaign, "id" | "createdAt" | "updatedAt" | "status"> & { status?: CampaignStatus };
export type ProductInput = Omit<Product, "id" | "createdAt">;

interface DataActions {
  // advocates
  setAdvocateStatus: (type: AdvocateType, id: string, status: "verified" | "rejected", reason?: string) => void;
  updateShop: (id: string, patch: Partial<Shop>) => void;
  updateMechanic: (id: string, patch: Partial<Mechanic>) => void;
  // campaigns
  createCampaign: (input: CampaignInput) => string;
  updateCampaign: (id: string, patch: Partial<CampaignInput>) => void;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  // products
  createProduct: (input: ProductInput) => string;
  updateProduct: (id: string, patch: Partial<ProductInput>) => void;
  // referrals
  recordClick: (code: string, campaignId?: string) => string | null;
  verifyReferral: (id: string) => void;
  rejectReferral: (id: string, reason: string) => void;
  // rewards
  approveReward: (txnId: string) => void;
  requestPayout: (advocateId: string, amount: number) => string;
  setPayoutStatus: (txnId: string, status: "paid" | "rejected") => void;
  // loyalty
  redeemReward: (customerId: string, rewardId: string) => { ok: true; redemption: Redemption } | { ok: false; error: string };
  // fraud
  setFlagStatus: (id: string, status: FlagStatus, note?: string) => void;
  // notifications
  markNotificationRead: (id: string, read?: boolean) => void;
  markAllNotificationsRead: (role: Role) => void;
  // misc
  resetDemo: () => void;
}

export type DataState = DemoData & DataActions;

const nowIso = () => new Date().toISOString();
let seq = Date.now() % 100000;
const uid = (prefix: string) => `${prefix}-${(++seq).toString(36).toUpperCase()}`;

function actor(): { actor: string; role: Role | "system" } {
  const u = useAuthStore.getState().user;
  return u ? { actor: u.name, role: u.role } : { actor: "System", role: "system" };
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => {
      const audit = (e: Omit<AuditEntry, "id" | "at" | "actor" | "role">) => {
        const entry: AuditEntry = { id: uid("AU"), at: nowIso(), ...actor(), ...e };
        set((s) => ({ audit: [entry, ...s.audit] }));
      };
      const notify = (n: Omit<AppNotification, "id" | "at" | "read">) => {
        const entry: AppNotification = { id: uid("N"), at: nowIso(), read: false, ...n };
        set((s) => ({ notifications: [entry, ...s.notifications] }));
      };
      const advName = (id: string) => get().shops.find((s) => s.id === id)?.name ?? get().mechanics.find((m) => m.id === id)?.name ?? id;

      return {
        ...generateDemoData(),

        setAdvocateStatus: (type, id, status, reason) => {
          if (type === "shop") set((s) => ({ shops: s.shops.map((x) => (x.id === id ? { ...x, status } : x)) }));
          else set((s) => ({ mechanics: s.mechanics.map((x) => (x.id === id ? { ...x, status } : x)) }));
          const name = advName(id);
          audit({ action: `${status === "verified" ? "Approved" : "Rejected"} ${type}`, category: "approval", target: `${name} (${id})`, details: reason });
          if (status === "verified") notify({ type: "approval", title: `${type === "shop" ? "Shop" : "Mechanic"} approved`, body: `${name} is now a verified advocate.`, roles: ["admin", "brand"], link: type === "shop" ? "/app/shops" : "/app/mechanics" });
        },
        updateShop: (id, patch) => { set((s) => ({ shops: s.shops.map((x) => (x.id === id ? { ...x, ...patch } : x)) })); audit({ action: "Updated business profile", category: "settings", target: advName(id) }); },
        updateMechanic: (id, patch) => { set((s) => ({ mechanics: s.mechanics.map((x) => (x.id === id ? { ...x, ...patch } : x)) })); audit({ action: "Updated business profile", category: "settings", target: advName(id) }); },

        createCampaign: (input) => {
          const id = `c${get().campaigns.length + 1}-${(++seq).toString(36)}`;
          const today = new Date().toISOString().slice(0, 10);
          const status: CampaignStatus = input.status ?? (input.startDate > today ? "scheduled" : "active");
          const c: Campaign = { ...input, id, status, createdAt: nowIso(), updatedAt: nowIso() };
          set((s) => ({ campaigns: [c, ...s.campaigns] }));
          audit({ action: status === "draft" ? "Created draft campaign" : "Created campaign", category: "campaign", target: `${c.name} (${id})` });
          if (status === "active") notify({ type: "campaign", title: "Campaign launched", body: `${c.name} is now live.`, roles: ["admin", "brand", "shop", "mechanic"], link: `/app/campaigns/${id}` });
          return id;
        },
        updateCampaign: (id, patch) => {
          const before = get().campaigns.find((c) => c.id === id);
          const { status, ...rest } = patch;
          set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...rest, updatedAt: nowIso() } : c)) }));
          audit({ action: "Edited campaign", category: "campaign", target: `${get().campaigns.find((c) => c.id === id)?.name} (${id})` });
          if (status && before && status !== before.status) get().setCampaignStatus(id, status);
        },
        setCampaignStatus: (id, status) => {
          const c = get().campaigns.find((x) => x.id === id); if (!c) return;
          set((s) => ({ campaigns: s.campaigns.map((x) => (x.id === id ? { ...x, status, updatedAt: nowIso() } : x)) }));
          const verb: Record<CampaignStatus, string> = { active: "Activated", paused: "Paused", completed: "Completed", draft: "Moved to draft", scheduled: "Scheduled" };
          audit({ action: `${verb[status]} campaign`, category: "campaign", target: `${c.name} (${id})` });
          if (status === "active") notify({ type: "campaign", title: "Campaign activated", body: `${c.name} is now live.`, roles: ["admin", "brand", "shop", "mechanic"], link: `/app/campaigns/${id}` });
        },

        createProduct: (input) => {
          const id = `p${get().products.length + 1}-${(++seq).toString(36)}`;
          set((s) => ({ products: [{ ...input, id, createdAt: nowIso() }, ...s.products] }));
          audit({ action: "Added product", category: "product", target: `${input.name} (${id})` });
          return id;
        },
        updateProduct: (id, patch) => {
          set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
          audit({ action: "Edited product", category: "product", target: `${get().products.find((p) => p.id === id)?.name} (${id})` });
        },

        recordClick: (code, campaignId) => {
          const st = get();
          const shop = st.shops.find((s) => s.referralCode === code);
          const mech = st.mechanics.find((m) => m.referralCode === code);
          const adv = shop ?? mech; if (!adv) return null;
          const campaigns = st.campaigns.filter((c) => c.status === "active" && adv.campaignIds.includes(c.id));
          const camp = campaigns.find((c) => c.id === campaignId) ?? campaigns[0];
          if (!camp) return null;
          const id = `REF-${10001 + st.referrals.length}`;
          set((s) => ({
            referrals: [...s.referrals, {
              id, advocateId: adv.id, advocateType: shop ? "shop" : "mechanic", code, campaignId: camp.id, productId: camp.productIds[0]!,
              customerRef: `VIS-••${Math.floor(1000 + Math.random() * 8999)}`, createdAt: nowIso(), status: "clicked", purchaseValue: 0, reward: 0, channel: "QR",
            }],
          }));
          return id;
        },
        verifyReferral: (id) => {
          const r = get().referrals.find((x) => x.id === id); if (!r || r.status !== "pending") return;
          const camp = get().campaigns.find((c) => c.id === r.campaignId);
          const reward = r.reward || camp?.rewardPerConversion || 0;
          const txn: RewardTxn = { id: uid("RW"), advocateId: r.advocateId, advocateType: r.advocateType, type: "commission", status: "pending", amount: reward, referralId: r.id, campaignId: r.campaignId, date: nowIso(), note: "Verified conversion reward" };
          set((s) => ({
            referrals: s.referrals.map((x) => (x.id === id ? { ...x, status: "verified", verifiedAt: nowIso(), reward } : x)),
            rewards: [...s.rewards, txn],
          }));
          audit({ action: "Verified purchase", category: "referral", target: `${id} · ${advName(r.advocateId)}`, details: `Reward ₹${reward} queued for approval` });
          notify({ type: "conversion", title: "Referral converted", body: `${id} was verified — ₹${reward} reward is pending approval.`, roles: [r.advocateType, "admin"], link: "/app/referrals" });
        },
        rejectReferral: (id, reason) => {
          const r = get().referrals.find((x) => x.id === id); if (!r || r.status !== "pending") return;
          set((s) => ({ referrals: s.referrals.map((x) => (x.id === id ? { ...x, status: "rejected", rejectedAt: nowIso(), rejectReason: reason, reward: 0 } : x)) }));
          audit({ action: "Rejected purchase claim", category: "referral", target: `${id} · ${advName(r.advocateId)}`, details: reason });
        },

        approveReward: (txnId) => {
          const t = get().rewards.find((x) => x.id === txnId); if (!t || t.status !== "pending") return;
          set((s) => ({ rewards: s.rewards.map((x) => (x.id === txnId ? { ...x, status: "approved" } : x)) }));
          audit({ action: "Approved reward", category: "reward", target: `${txnId} · ${advName(t.advocateId)}`, details: `₹${t.amount}` });
          notify({ type: "reward", title: "Reward approved", body: `₹${t.amount.toLocaleString("en-IN")} is now available in your wallet.`, roles: [t.advocateType], link: "/app/rewards" });
        },
        requestPayout: (advocateId, amount) => {
          const isShop = get().shops.some((s) => s.id === advocateId);
          const txn: RewardTxn = { id: uid("RW"), advocateId, advocateType: isShop ? "shop" : "mechanic", type: "payout", status: "requested", amount, date: nowIso(), note: "Payout request (simulated)" };
          set((s) => ({ rewards: [...s.rewards, txn] }));
          audit({ action: "Requested payout", category: "reward", target: `${advName(advocateId)}`, details: `₹${amount} (simulated)` });
          notify({ type: "reward", title: "Payout requested", body: `${advName(advocateId)} requested a ₹${amount.toLocaleString("en-IN")} payout.`, roles: ["admin"], link: "/app/approvals" });
          return txn.id;
        },
        setPayoutStatus: (txnId, status) => {
          const t = get().rewards.find((x) => x.id === txnId); if (!t || t.status !== "requested") return;
          if (status === "paid") set((s) => ({ rewards: s.rewards.map((x) => (x.id === txnId ? { ...x, status: "paid", note: "Payout approved (simulated — no money moved)" } : x)) }));
          else set((s) => ({ rewards: s.rewards.filter((x) => x.id !== txnId) }));
          audit({ action: status === "paid" ? "Approved payout" : "Declined payout", category: "reward", target: `${advName(t.advocateId)}`, details: `₹${t.amount}` });
          notify({ type: "reward", title: status === "paid" ? "Payout approved" : "Payout declined", body: status === "paid" ? `Your ₹${t.amount.toLocaleString("en-IN")} payout was approved (simulated).` : `Your ₹${t.amount.toLocaleString("en-IN")} payout request was declined. The amount is back in your available balance.`, roles: [t.advocateType], link: "/app/rewards" });
        },

        redeemReward: (customerId, rewardId) => {
          const item = REWARD_CATALOG.find((r) => r.id === rewardId);
          if (!item) return { ok: false, error: "Reward not found." };
          const st = get();
          const loyalty = customerLoyalty(st.loyalty, customerId);
          const used = st.redemptions.filter((r) => r.rewardId === rewardId).length;
          if (item.stock - used <= 0) return { ok: false, error: "This reward is out of stock." };
          if (item.minTier && tierRank(loyalty.tier) < tierRank(item.minTier)) return { ok: false, error: `This reward requires ${item.minTier} tier or above.` };
          if (loyalty.balance < item.points) return { ok: false, error: `You need ${(item.points - loyalty.balance).toLocaleString("en-IN")} more points.` };
          const redemption: Redemption = { id: uid("RDM"), customerId, rewardId, date: nowIso(), points: item.points, code: `AX-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, status: "issued" };
          set((s) => ({
            redemptions: [redemption, ...s.redemptions],
            loyalty: [...s.loyalty, { id: uid("LT"), customerId, date: redemption.date, points: -item.points, type: "redeem", description: `Redeemed: ${item.title}` }],
          }));
          audit({ action: "Redeemed reward (simulated)", category: "loyalty", target: item.title, details: `${item.points} points` });
          return { ok: true, redemption };
        },

        setFlagStatus: (id, status, note) => {
          set((s) => ({ flags: s.flags.map((f) => (f.id === id ? { ...f, status, reviewNote: note ?? f.reviewNote } : f)) }));
          const label: Record<FlagStatus, string> = { new: "Reopened", under_review: "Marked under review", resolved: "Resolved", dismissed: "Dismissed" };
          audit({ action: `${label[status]} fraud flag`, category: "fraud", target: id, details: note });
        },

        markNotificationRead: (id, read = true) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read } : n)) })),
        markAllNotificationsRead: (role) => set((s) => ({ notifications: s.notifications.map((n) => (n.roles.includes(role) ? { ...n, read: true } : n)) })),

        resetDemo: () => {
          set({ ...generateDemoData() });
          audit({ action: "Reset demo data", category: "settings", target: "All demo records" });
        },
      };
    },
    {
      name: "advx-data",
      version: 1,
      partialize: (s) => {
        const { shops, mechanics, products, campaigns, referrals, rewards, customers, purchases, loyalty, redemptions, flags, notifications, audit, generatedAt } = s;
        return { shops, mechanics, products, campaigns, referrals, rewards, customers, purchases, loyalty, redemptions, flags, notifications, audit, generatedAt };
      },
    }
  )
);
