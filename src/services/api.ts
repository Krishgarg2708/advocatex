/**
 * Service layer — the single seam for backend integration.
 *
 * Today every function resolves against the in-browser Zustand store after a short
 * simulated latency. To connect a real backend, replace the body of each function with
 * a fetch/axios call (e.g. `return http.post("/campaigns", input)`) and update the store
 * from the response. Pages call these functions, never `fetch` directly.
 *
 * SECURITY: secrets such as AI or payment API keys must never be shipped to the browser.
 * Any future AI assistant or payout provider must be called through your own backend.
 */
import { useDataStore, type CampaignInput, type ProductInput } from "@/store/data";
import { useAuthStore } from "@/store/auth";
import type { CampaignStatus, FlagStatus, Role } from "@/types";

const latency = (ms = 450) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));
const store = () => useDataStore.getState();

export const api = {
  auth: {
    async loginAs(role: Role, remember = true) { await latency(500); return useAuthStore.getState().loginAs(role, remember); },
    async loginWithEmail(email: string, remember: boolean) { await latency(700); return useAuthStore.getState().loginWithEmail(email, remember); },
    async register(input: { name: string; email: string; role: Role; phone?: string }) { await latency(800); return useAuthStore.getState().register(input); },
    async requestPasswordReset(_email: string) { await latency(800); return { ok: true as const }; },
    async logout() { await latency(200); useAuthStore.getState().logout(); },
  },
  campaigns: {
    async create(input: CampaignInput) { await latency(); return store().createCampaign(input); },
    async update(id: string, patch: Partial<CampaignInput>) { await latency(); store().updateCampaign(id, patch); },
    async setStatus(id: string, status: CampaignStatus) { await latency(300); store().setCampaignStatus(id, status); },
  },
  products: {
    async create(input: ProductInput) { await latency(); return store().createProduct(input); },
    async update(id: string, patch: Partial<ProductInput>) { await latency(); store().updateProduct(id, patch); },
  },
  referrals: {
    async verify(id: string) { await latency(400); store().verifyReferral(id); },
    async reject(id: string, reason: string) { await latency(400); store().rejectReferral(id, reason); },
  },
  rewards: {
    async approve(txnId: string) { await latency(400); store().approveReward(txnId); },
    async requestPayout(advocateId: string, amount: number) { await latency(600); return store().requestPayout(advocateId, amount); },
    async setPayoutStatus(txnId: string, status: "paid" | "rejected") { await latency(500); store().setPayoutStatus(txnId, status); },
  },
  loyalty: {
    async redeem(customerId: string, rewardId: string) { await latency(700); return store().redeemReward(customerId, rewardId); },
  },
  advocates: {
    async setStatus(type: "shop" | "mechanic", id: string, status: "verified" | "rejected", reason?: string) { await latency(400); store().setAdvocateStatus(type, id, status, reason); },
  },
  fraud: {
    async setStatus(id: string, status: FlagStatus, note?: string) { await latency(350); store().setFlagStatus(id, status, note); },
  },
};
