import { useMemo } from "react";
import { useDataStore } from "@/store/data";
import { BRANDS } from "@/data/catalog";

/** Memoised id → entity maps for fast lookups in tables and charts. */
export function useLookups() {
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const products = useDataStore((s) => s.products);
  const campaigns = useDataStore((s) => s.campaigns);
  const customers = useDataStore((s) => s.customers);
  return useMemo(() => {
    const shopById = new Map(shops.map((x) => [x.id, x]));
    const mechById = new Map(mechanics.map((x) => [x.id, x]));
    const productById = new Map(products.map((x) => [x.id, x]));
    const campaignById = new Map(campaigns.map((x) => [x.id, x]));
    const customerById = new Map(customers.map((x) => [x.id, x]));
    const brandById = new Map(BRANDS.map((b) => [b.id, b]));
    const advocate = (id: string) => {
      const s = shopById.get(id);
      if (s) return { id, type: "shop" as const, name: s.name, subtitle: s.owner, city: s.city, hue: s.hue, status: s.status, code: s.referralCode };
      const m = mechById.get(id);
      if (m) return { id, type: "mechanic" as const, name: m.name, subtitle: m.workshop, city: m.city, hue: m.hue, status: m.status, code: m.referralCode };
      return undefined;
    };
    return { shopById, mechById, productById, campaignById, customerById, brandById, advocate, advocateName: (id: string) => advocate(id)?.name ?? id };
  }, [shops, mechanics, products, campaigns, customers]);
}
