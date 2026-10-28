import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Monitor, Moon, ShieldCheck, Store, Sun, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/layout/Logo";
import { useUIStore, type Theme } from "@/store/ui";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

/** Presentation metadata for the five demo roles (used by landing, login and role selection). */
export const ROLE_META: Record<Role, { icon: LucideIcon; tone: string; short: string; description: string; bullets: string[] }> = {
  admin: {
    icon: ShieldCheck, tone: "bg-brand-soft text-brand", short: "Platform-wide control",
    description: "Oversee the whole advocacy network, approvals, fraud signals and platform health.",
    bullets: ["Network-wide KPIs and funnel", "Approval queue and audit log", "Fraud monitoring centre"],
  },
  brand: {
    icon: Building2, tone: "bg-action-soft text-action", short: "Campaigns and ROI",
    description: "Launch referral campaigns for Veltrix Lubricants and measure attributed revenue.",
    bullets: ["Campaign builder and budgets", "ROAS and conversion analytics", "Top advocates by region"],
  },
  shop: {
    icon: Store, tone: "bg-positive-soft text-positive", short: "Shop referrals",
    description: "Run Sai Motors & Spares' referral programme and track commissions.",
    bullets: ["QR and link referral toolkit", "Commission wallet and payouts", "Campaigns you're enrolled in"],
  },
  mechanic: {
    icon: Wrench, tone: "bg-warning-soft text-warning", short: "Advocate earnings",
    description: "Recommend trusted products as Arjun Mehta and grow your earnings and tier.",
    bullets: ["Earnings, tier and achievements", "Leaderboard rank", "Personal QR and share links"],
  },
  customer: {
    icon: UserRound, tone: "bg-ai-soft text-ai", short: "Loyalty rewards",
    description: "Earn points on referred purchases as Priya Sharma and redeem rewards.",
    bullets: ["Points balance and tier", "Rewards catalogue and redemption", "Purchase and points history"],
  },
};

export const ROLE_ORDER: Role[] = ["admin", "brand", "shop", "mechanic", "customer"];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" className={className}><Icon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4" />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact header used by secondary public pages (auth, legal, referral). */
export function SimpleHeader({ backTo = "/", backLabel = "Back to home", className, right }: { backTo?: string; backLabel?: string; className?: string; right?: React.ReactNode }) {
  return (
    <header className={cn("border-b bg-card/70 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          {right}
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to={backTo}><ArrowLeft />{backLabel}</Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Demo-auth disclosure shown on every auth screen. */
export function DemoAuthNotice({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-foreground/80", className)} role="note">
      <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
      <span><span className="font-medium text-foreground">Demo authentication.</span> Sign-in happens entirely in your browser with no server or password check. It is not suitable for production security.</span>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-destructive">{message}</p>;
}
