import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronRight, FlaskConical, LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, UserRound, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { useAuthStore, ROLE_LABEL } from "@/store/auth";
import { useDataStore } from "@/store/data";
import { useUIStore, type Theme } from "@/store/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { GROUP_LABEL, navFor, type NavItem } from "./nav";
import { Logo } from "./Logo";
import { GlobalSearch } from "./GlobalSearch";
import { DateRangePicker } from "./DateRangePicker";

function useBadges() {
  const { role } = useCurrentUser();
  const notifications = useDataStore((s) => s.notifications);
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const rewards = useDataStore((s) => s.rewards);
  const flags = useDataStore((s) => s.flags);
  return useMemo(() => ({
    notifications: notifications.filter((n) => n.roles.includes(role) && !n.read).length,
    approvals: shops.filter((s) => s.status === "pending").length + mechanics.filter((m) => m.status === "pending").length + rewards.filter((t) => t.type === "payout" && t.status === "requested").length,
    flags: flags.filter((f) => f.status === "new" || f.status === "under_review").length,
  }), [notifications, shops, mechanics, rewards, flags, role]);
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { role } = useCurrentUser();
  const badges = useBadges();
  const items = navFor(role);
  const groups = (["main", "manage", "insights", "account"] as const).map((g) => ({ g, items: items.filter((i) => i.group === g) })).filter((x) => x.items.length);

  const renderItem = (item: NavItem) => {
    const count = item.badge ? badges[item.badge] : 0;
    const link = (
      <NavLink key={item.to} to={item.to} onClick={onNavigate}
        className={({ isActive }) => cn(
          "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground",
          isActive && "bg-sidebar-accent text-brand hover:text-brand",
          collapsed && "justify-center px-0"
        )}>
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand" aria-hidden />}
            <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground", item.label === "AI Insights" && !isActive && "text-ai")} />
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {count > 0 && (collapsed
              ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              : <span className={cn("rounded-full px-1.5 text-[10px] font-semibold leading-[18px] num", item.badge === "notifications" ? "bg-action text-white" : "bg-destructive/10 text-destructive")}>{count}</span>)}
          </>
        )}
      </NavLink>
    );
    return collapsed ? <Hint key={item.to} content={item.label} side="right">{link}</Hint> : link;
  };

  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {groups.map(({ g, items }) => (
        <div key={g}>
          {!collapsed && <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{GROUP_LABEL[g]}</div>}
          <div className="space-y-0.5">{items.map(renderItem)}</div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { user } = useCurrentUser();
  if (!user) return null;
  return (
    <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
      <div className={cn("flex items-center gap-2.5 rounded-lg bg-muted/50 p-2", collapsed && "justify-center bg-transparent p-0")}>
        <EntityAvatar name={user.name} hue={user.avatarHue} size="sm" />
        {!collapsed && (
          <div className="min-w-0 text-xs">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-muted-foreground">{ROLE_LABEL[user.role]}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  admin: "Admin overview", brand: "Brand overview", shop: "Shop overview", mechanic: "Advocate overview", customer: "My rewards",
  network: "Network", shops: "Shops", mechanics: "Mechanics", products: "Products", campaigns: "Campaigns", new: "New campaign", edit: "Edit",
  referrals: "Referrals", rewards: "Rewards", loyalty: "Loyalty", analytics: "Analytics", ai: "AI Insights", fraud: "Fraud Monitor",
  notifications: "Notifications", settings: "Settings", approvals: "Approvals", audit: "Audit Log",
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const campaigns = useDataStore((s) => s.campaigns);
  const parts = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  const crumbs = parts.map((p, i) => ({
    label: LABELS[p] ?? campaigns.find((c) => c.id === p)?.name ?? p,
    to: "/app/" + parts.slice(0, i + 1).join("/"),
  }));
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-[13px] text-muted-foreground md:flex">
      <Link to="/app" className="hover:text-foreground">AdvocateX</Link>
      {crumbs.map((c, i) => (
        <span key={c.to} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
          {i === crumbs.length - 1 ? <span className="truncate font-medium text-foreground" aria-current="page">{c.label}</span> : <Link to={c.to} className="truncate hover:text-foreground">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme"><Icon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user } = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  if (!user) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full p-0.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2" aria-label="Account menu">
            <EntityAvatar name={user.name} hue={user.avatarHue} size="sm" />
            <span className="hidden text-left text-xs leading-tight lg:block">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium text-foreground">{user.name}</div>
            <div className="truncate text-xs">{user.email}</div>
            <Badge variant="action" className="mt-1.5">{ROLE_LABEL[user.role]} · demo</Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/app/settings")}><UserRound />Profile</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/app/settings?tab=preferences")}><Settings />Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/select-role")}><Repeat />Switch demo role</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive [&_svg]:text-destructive"><LogOut />Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Log out of the demo?" description="You'll return to the login page. Demo data you changed stays saved in this browser." confirmLabel="Log out" variant="destructive"
        onConfirm={() => { logout(); toast.success("Logged out"); navigate("/login"); }} />
    </>
  );
}

function NotificationBell() {
  const { notifications } = useBadges();
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link to="/app/notifications" aria-label={`Notifications, ${notifications} unread`}>
        <Bell />
        {notifications > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white num">{notifications > 9 ? "9+" : notifications}</span>}
      </Link>
    </Button>
  );
}

export function AppShell() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useCurrentUser();
  const { pathname } = useLocation();
  const showDate = role !== "customer" && !/\/(settings|notifications|audit|approvals|campaigns\/new|edit)/.test(pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-60")}>
        <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
          <Logo to="/app" collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <SidebarFooter collapsed={collapsed} />
      </aside>

      {/* mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-4"><Logo to="/app" /></div>
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          <SidebarFooter collapsed={false} />
        </SheetContent>
      </Sheet>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
          <Hint content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Hint>
          <Breadcrumbs />
          <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
            <GlobalSearch className="hidden md:block" />
            {showDate && <DateRangePicker className="hidden sm:inline-flex" />}
            <Hint content="Demo mode — data lives only in this browser">
              <span className="hidden items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground xl:inline-flex"><FlaskConical className="h-3 w-3" />Demo</span>
            </Hint>
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {showDate && (
          <div className="flex items-center gap-2 border-b px-3 py-2 sm:hidden">
            <DateRangePicker className="w-full justify-between" align="start" />
          </div>
        )}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
