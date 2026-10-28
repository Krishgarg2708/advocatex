import { useMemo } from "react";
import { useDataStore } from "@/store/data";
import { useCurrentUser } from "./useCurrentUser";

/**
 * Data visible to the current role:
 *  - admin: everything
 *  - brand: its own brand's campaigns and the referrals/rewards they produced
 *  - shop / mechanic: their own referrals and rewards, campaigns they joined
 *  - customer: nothing operational (portal uses loyalty data instead)
 */
export function useScope() {
  const { role, brandId, advocateId, shop, mechanic } = useCurrentUser();
  const campaigns = useDataStore((s) => s.campaigns);
  const referrals = useDataStore((s) => s.referrals);
  const rewards = useDataStore((s) => s.rewards);
  const products = useDataStore((s) => s.products);

  return useMemo(() => {
    if (role === "admin") return { campaigns, referrals, rewards, products, scopeLabel: "All brands" };
    if (role === "brand") {
      const cs = campaigns.filter((c) => c.brandId === brandId);
      const ids = new Set(cs.map((c) => c.id));
      return {
        campaigns: cs,
        referrals: referrals.filter((r) => ids.has(r.campaignId)),
        rewards: rewards.filter((t) => t.campaignId && ids.has(t.campaignId)),
        products: products.filter((p) => p.brandId === brandId),
        scopeLabel: "Your brand",
      };
    }
    if (role === "shop" || role === "mechanic") {
      const joined = new Set((shop ?? mechanic)?.campaignIds ?? []);
      const type = role;
      return {
        // joined campaigns plus any live/upcoming campaign open to this advocate type
        campaigns: campaigns.filter((c) => joined.has(c.id) || ((c.status === "active" || c.status === "scheduled") && c.advocateTypes.includes(type))),
        referrals: referrals.filter((r) => r.advocateId === advocateId),
        rewards: rewards.filter((t) => t.advocateId === advocateId),
        products: products.filter((p) => p.status === "active"),
        scopeLabel: "Your performance",
      };
    }
    return { campaigns: campaigns.filter((c) => c.status === "active"), referrals: [], rewards: [], products: products.filter((p) => p.status === "active"), scopeLabel: "" };
  }, [role, brandId, advocateId, shop, mechanic, campaigns, referrals, rewards, products]);
}
