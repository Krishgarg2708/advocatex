/**
 * DEMO AUTHENTICATION — client-side only.
 * There is no password check, no token and no server session. This is NOT secure and
 * exists only so the demo can switch between roles. Replace with a real auth provider
 * (e.g. OAuth/OIDC + httpOnly session cookies) when a backend is added.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DemoUser, Role } from "@/types";
import { DEMO_USERS } from "@/data/catalog";

interface AuthState {
  user: DemoUser | null;
  remember: boolean;
  loginAs: (role: Role, remember?: boolean) => DemoUser;
  loginWithEmail: (email: string, remember: boolean) => DemoUser | null;
  register: (input: { name: string; email: string; role: Role; phone?: string }) => DemoUser;
  updateProfile: (patch: Partial<Pick<DemoUser, "name" | "email" | "phone" | "title">>) => void;
  logout: () => void;
}

/** Store in localStorage when "remember me" is on, otherwise only for this browser tab. */
const rememberAwareStorage = createJSONStorage(() => ({
  getItem: (k: string) => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => {
    try {
      const remember = JSON.parse(v)?.state?.remember !== false;
      (remember ? localStorage : sessionStorage).setItem(k, v);
      (remember ? sessionStorage : localStorage).removeItem(k);
    } catch { /* storage unavailable */ }
  },
  removeItem: (k: string) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } },
}));

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      remember: true,
      loginAs: (role, remember = true) => {
        const user = { ...DEMO_USERS[role]! };
        set({ user, remember });
        return user;
      },
      loginWithEmail: (email, remember) => {
        const match = Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!match) return null;
        set({ user: { ...match }, remember });
        return match;
      },
      register: ({ name, email, role, phone }) => {
        const base = DEMO_USERS[role]!;
        // New registrations reuse the role's demo workspace so every screen has data.
        const user: DemoUser = { ...base, name, email, phone: phone || base.phone };
        set({ user, remember: true });
        return user;
      },
      updateProfile: (patch) => { const u = get().user; if (u) set({ user: { ...u, ...patch } }); },
      logout: () => set({ user: null }),
    }),
    { name: "advx-auth", version: 1, storage: rememberAwareStorage }
  )
);

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Super Admin",
  brand: "Brand Manager",
  shop: "Shop Owner",
  mechanic: "Mechanic Advocate",
  customer: "Customer",
};

export const ROLE_HOME: Record<Role, string> = {
  admin: "/app/admin",
  brand: "/app/brand",
  shop: "/app/shop",
  mechanic: "/app/mechanic",
  customer: "/app/customer",
};
