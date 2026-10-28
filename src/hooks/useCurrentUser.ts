import { useAuthStore } from "@/store/auth";
import { useDataStore } from "@/store/data";
import type { Role } from "@/types";

/** Current demo user plus their linked business entity (brand / shop / mechanic / customer). */
export function useCurrentUser() {
  const user = useAuthStore((s) => s.user);
  const shop = useDataStore((s) => (user?.role === "shop" ? s.shops.find((x) => x.id === user.entityId) : undefined));
  const mechanic = useDataStore((s) => (user?.role === "mechanic" ? s.mechanics.find((x) => x.id === user.entityId) : undefined));
  const customer = useDataStore((s) => (user?.role === "customer" ? s.customers.find((x) => x.id === user.entityId) : undefined));
  const role = (user?.role ?? "customer") as Role;
  return {
    user, role, shop, mechanic, customer,
    brandId: user?.role === "brand" ? user.entityId : undefined,
    advocateId: shop?.id ?? mechanic?.id,
    isAdmin: role === "admin",
    can: (perm: Permission) => PERMISSIONS[perm].includes(role),
  };
}

export type Permission =
  | "manageCampaigns" | "manageProducts" | "approveAdvocates" | "verifyReferrals" | "approveRewards"
  | "reviewFraud" | "viewAudit" | "requestPayout" | "viewAllReferrals";

export const PERMISSIONS: Record<Permission, Role[]> = {
  manageCampaigns: ["admin", "brand"],
  manageProducts: ["admin", "brand"],
  approveAdvocates: ["admin"],
  verifyReferrals: ["admin", "brand"],
  approveRewards: ["admin"],
  reviewFraud: ["admin"],
  viewAudit: ["admin"],
  requestPayout: ["shop", "mechanic"],
  viewAllReferrals: ["admin", "brand"],
};
