import {
  Activity, BarChart3, Bell, BrainCircuit, ClipboardCheck, Gift, LayoutDashboard, Megaphone, Network, Package,
  ScrollText, Settings, ShieldAlert, Store, Wallet, Wrench, Link2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/types";
import { ROLE_HOME } from "@/store/auth";

export interface NavItem { label: string; to: string; icon: LucideIcon; roles: Role[]; group: "main" | "manage" | "insights" | "account"; badge?: "notifications" | "approvals" | "flags" }

export const NAV: NavItem[] = [
  { label: "Overview", to: "__home__", icon: LayoutDashboard, roles: ["admin", "brand", "shop", "mechanic", "customer"], group: "main" },
  { label: "Network", to: "/app/network", icon: Network, roles: ["admin", "brand"], group: "main" },
  { label: "Shops", to: "/app/shops", icon: Store, roles: ["admin", "brand", "customer"], group: "main" },
  { label: "Mechanics", to: "/app/mechanics", icon: Wrench, roles: ["admin", "brand", "shop"], group: "main" },
  { label: "Products", to: "/app/products", icon: Package, roles: ["admin", "brand", "shop", "mechanic", "customer"], group: "main" },
  { label: "Campaigns", to: "/app/campaigns", icon: Megaphone, roles: ["admin", "brand", "shop", "mechanic"], group: "manage" },
  { label: "Referrals", to: "/app/referrals", icon: Link2, roles: ["admin", "brand", "shop", "mechanic"], group: "manage" },
  { label: "Rewards", to: "/app/rewards", icon: Wallet, roles: ["admin", "brand", "shop", "mechanic"], group: "manage" },
  { label: "Loyalty", to: "/app/loyalty", icon: Gift, roles: ["admin", "brand", "customer"], group: "manage" },
  { label: "Approvals", to: "/app/approvals", icon: ClipboardCheck, roles: ["admin"], group: "manage", badge: "approvals" },
  { label: "Analytics", to: "/app/analytics", icon: BarChart3, roles: ["admin", "brand", "shop", "mechanic"], group: "insights" },
  { label: "AI Insights", to: "/app/ai", icon: BrainCircuit, roles: ["admin", "brand", "shop", "mechanic"], group: "insights" },
  { label: "Fraud Monitor", to: "/app/fraud", icon: ShieldAlert, roles: ["admin", "brand"], group: "insights", badge: "flags" },
  { label: "Audit Log", to: "/app/audit", icon: ScrollText, roles: ["admin"], group: "insights" },
  { label: "Notifications", to: "/app/notifications", icon: Bell, roles: ["admin", "brand", "shop", "mechanic", "customer"], group: "account", badge: "notifications" },
  { label: "Settings", to: "/app/settings", icon: Settings, roles: ["admin", "brand", "shop", "mechanic", "customer"], group: "account" },
];

export const GROUP_LABEL: Record<NavItem["group"], string> = { main: "Workspace", manage: "Programme", insights: "Insights", account: "Account" };

export function navFor(role: Role) {
  return NAV.filter((n) => n.roles.includes(role)).map((n) => ({ ...n, to: n.to === "__home__" ? ROLE_HOME[role] : n.to }));
}

/** Route → allowed roles, used by the route guard. */
export function rolesForPath(path: string): Role[] | null {
  const homes = Object.entries(ROLE_HOME).find(([, p]) => p === path);
  if (homes) return [homes[0] as Role];
  const item = NAV.filter((n) => n.to !== "__home__").sort((a, b) => b.to.length - a.to.length).find((n) => path === n.to || path.startsWith(n.to + "/"));
  return item ? item.roles : null;
}

export const ActivityIcon = Activity;
