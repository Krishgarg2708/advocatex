import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DatePreset, DateRange, NotificationPrefs } from "@/types";

export type Theme = "light" | "dark" | "system";

export function rangeFromPreset(preset: Exclude<DatePreset, "custom">): DateRange {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - (days - 1));
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { preset, from: fmt(from), to: fmt(to) };
}

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  dateRange: DateRange;
  notificationPrefs: NotificationPrefs;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setDateRange: (r: DateRange) => void;
  setPreset: (p: Exclude<DatePreset, "custom">) => void;
  setNotificationPrefs: (p: Partial<NotificationPrefs>) => void;
}

export const applyTheme = (theme: Theme) => {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarCollapsed: false,
      dateRange: rangeFromPreset("30d"),
      notificationPrefs: { email: true, push: true, conversions: true, rewards: true, campaigns: true, fraud: true, weeklyDigest: false },
      setTheme: (theme) => { applyTheme(theme); set({ theme }); },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDateRange: (dateRange) => set({ dateRange }),
      setPreset: (p) => set({ dateRange: rangeFromPreset(p) }),
      setNotificationPrefs: (p) => set((s) => ({ notificationPrefs: { ...s.notificationPrefs, ...p } })),
    }),
    {
      name: "advx-ui",
      version: 1,
      // presets are re-anchored to today on load so "Last 30 days" never goes stale
      onRehydrateStorage: () => (state) => {
        if (state && state.dateRange.preset !== "custom") state.dateRange = rangeFromPreset(state.dateRange.preset);
      },
    }
  )
);
