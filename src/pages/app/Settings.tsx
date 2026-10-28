import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Bell, Building2, Database, KeyRound, Loader2, Lock, Monitor, Moon, Palette, RefreshCcw, Repeat, Save, ShieldCheck, Sun, TriangleAlert, User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { EntityAvatar } from "@/components/shared/EntityAvatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLookups } from "@/hooks/useLookups";
import { useAuthStore, ROLE_LABEL } from "@/store/auth";
import { useDataStore } from "@/store/data";
import { useUIStore, type Theme } from "@/store/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationPrefs } from "@/types";

const TABS = ["profile", "business", "preferences", "notifications", "demo", "privacy"] as const;
type Tab = (typeof TABS)[number];
const STORAGE_KEYS = [
  { key: "advx-auth", purpose: "Signed-in demo user and “remember me” choice" },
  { key: "advx-data", purpose: "All demo records: advocates, campaigns, referrals, rewards, loyalty, audit log" },
  { key: "advx-ui", purpose: "Theme, sidebar state, date range and notification preferences" },
];

const Field = ({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);
const fakeSave = () => new Promise((r) => setTimeout(r, 450));

export default function Settings() {
  const { role } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((t) => !(role === "customer" && t === "business"));
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.includes(requested) ? requested : "profile";
  const setTab = (t: string) => { const p = new URLSearchParams(params); p.set("tab", t); setParams(p, { replace: true }); };

  const LABEL: Record<Tab, { label: string; icon: typeof User }> = {
    profile: { label: "Profile", icon: User }, business: { label: "Business", icon: Building2 }, preferences: { label: "Preferences", icon: Palette },
    notifications: { label: "Notifications", icon: Bell }, demo: { label: "Demo account", icon: Database }, privacy: { label: "Privacy & security", icon: ShieldCheck },
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, business details, appearance and demo data." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10">
          {tabs.map((t) => { const Icon = LABEL[t].icon; return <TabsTrigger key={t} value={t} className="py-1.5"><Icon className="h-3.5 w-3.5" />{LABEL[t].label}</TabsTrigger>; })}
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        {role !== "customer" && <TabsContent value="business"><BusinessTab /></TabsContent>}
        <TabsContent value="preferences"><PreferencesTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="demo"><DemoTab /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ profile */
const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number"),
  title: z.string().trim().max(80, "Keep the title under 80 characters"),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileTab() {
  const { user, role } = useCurrentUser();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", title: user?.title ?? "" } });
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = form;
  if (!user) return null;
  const onSubmit = async (v: ProfileValues) => {
    await fakeSave();
    useAuthStore.getState().updateProfile(v);
    reset(v);
    toast.success("Profile updated");
  };
  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div className="flex items-center gap-4">
            <EntityAvatar name={user.name} hue={user.avatarHue} size="lg" />
            <div className="min-w-0"><CardTitle>{user.name}</CardTitle><CardDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 break-all">{user.email}<Badge variant="secondary">{ROLE_LABEL[role]}</Badge></CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="p-name" label="Full name" error={errors.name?.message}><Input id="p-name" aria-invalid={!!errors.name} {...register("name")} /></Field>
          <Field id="p-email" label="Email" error={errors.email?.message} hint="Used for demo sign-in only."><Input id="p-email" type="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
          <Field id="p-phone" label="Phone" error={errors.phone?.message}><Input id="p-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} /></Field>
          <Field id="p-title" label="Title" error={errors.title?.message}><Input id="p-title" aria-invalid={!!errors.title} {...register("title")} /></Field>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>Discard</Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ business */
const shopSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name"),
  owner: z.string().trim().min(2, "Enter the owner's name"),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number"),
  gstin: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"),
  category: z.string().trim().min(2, "Enter a category"),
});
const mechSchema = z.object({
  workshop: z.string().trim().min(2, "Enter the workshop name"),
  specialization: z.string().trim().min(2, "Enter a specialization"),
  experienceYears: z.coerce.number({ invalid_type_error: "Enter years" }).int().min(0, "Cannot be negative").max(60, "That seems too high"),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid phone number"),
});
const SHOP_CATEGORIES = ["Multi-brand spares", "Tyres & alignment", "Batteries & electricals", "Lubricants", "Accessories", "Brakes & suspension"];
const SPECIALIZATIONS = ["Engine & diagnostics", "Periodic servicing", "Two-wheeler specialist", "Tyres & alignment", "Brakes & suspension", "Auto electricals"];

function BusinessTab() {
  const { role, shop, mechanic, brandId } = useCurrentUser();
  const { brandById } = useLookups();
  if (role === "shop" && shop) return <ShopForm />;
  if (role === "mechanic" && mechanic) return <MechanicForm />;
  const brand = brandId ? brandById.get(brandId) : undefined;
  const rows: [string, React.ReactNode][] = role === "brand" && brand
    ? [["Brand", brand.name], ["Category", brand.category], ["Brand ID", <code key="b" className="font-mono text-xs">{brand.id}</code>], ["Your access", "Campaigns, products and referrals for this brand"]]
    : [["Organisation", "AdvocateX Platform (demo)"], ["Workspace", "All brands, advocates and customers"], ["Your access", "Full administrative access"], ["Brands on platform", formatNumber(brandById.size)]];
  return (
    <Card className="max-w-3xl">
      <CardHeader><CardTitle>{role === "brand" ? "Brand profile" : "Organisation"}</CardTitle><CardDescription>Managed by the platform. Contact AdvocateX support to change these details.</CardDescription></CardHeader>
      <CardContent>
        <dl className="divide-y rounded-lg border text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
      </CardContent>
    </Card>
  );
}

function ShopForm() {
  const { shop } = useCurrentUser();
  type V = z.infer<typeof shopSchema>;
  const form = useForm<V>({ resolver: zodResolver(shopSchema), values: { name: shop!.name, owner: shop!.owner, phone: shop!.phone, gstin: shop!.gstin, category: shop!.category } });
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, watch, setValue } = form;
  const onSubmit = async (v: V) => { await fakeSave(); useDataStore.getState().updateShop(shop!.id, v); reset(v); toast.success("Business profile updated"); };
  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader><CardTitle>Shop profile</CardTitle><CardDescription>Shown to customers and brands on referral pages and in the shop directory.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="s-name" label="Shop name" error={errors.name?.message}><Input id="s-name" aria-invalid={!!errors.name} {...register("name")} /></Field>
          <Field id="s-owner" label="Owner" error={errors.owner?.message}><Input id="s-owner" aria-invalid={!!errors.owner} {...register("owner")} /></Field>
          <Field id="s-phone" label="Business phone" error={errors.phone?.message}><Input id="s-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} /></Field>
          <Field id="s-gstin" label="GSTIN" error={errors.gstin?.message} hint="Fictional demo GSTIN."><Input id="s-gstin" className="font-mono uppercase" aria-invalid={!!errors.gstin} {...register("gstin")} /></Field>
          <Field id="s-category" label="Category" error={errors.category?.message}>
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger id="s-category"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from(new Set([...SHOP_CATEGORIES, shop!.category])).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="s-loc" label="Location"><Input id="s-loc" value={`${shop!.city}, ${shop!.state}`} disabled /></Field>
        </CardContent>
        <CardFooter className="justify-between gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">Referral code <code className="font-mono">{shop!.referralCode}</code></span>
          <div className="flex gap-2"><Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>Discard</Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}Save business profile</Button></div>
        </CardFooter>
      </form>
    </Card>
  );
}

function MechanicForm() {
  const { mechanic } = useCurrentUser();
  type V = z.infer<typeof mechSchema>;
  const form = useForm<V>({ resolver: zodResolver(mechSchema), values: { workshop: mechanic!.workshop, specialization: mechanic!.specialization, experienceYears: mechanic!.experienceYears, phone: mechanic!.phone } });
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, watch, setValue } = form;
  const onSubmit = async (v: V) => { await fakeSave(); useDataStore.getState().updateMechanic(mechanic!.id, v); reset(v); toast.success("Business profile updated"); };
  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader><CardTitle>Workshop profile</CardTitle><CardDescription>Shown to customers on your referral page and in the mechanic directory.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="m-workshop" label="Workshop name" error={errors.workshop?.message}><Input id="m-workshop" aria-invalid={!!errors.workshop} {...register("workshop")} /></Field>
          <Field id="m-spec" label="Specialization" error={errors.specialization?.message}>
            <Select value={watch("specialization")} onValueChange={(v) => setValue("specialization", v, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger id="m-spec"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from(new Set([...SPECIALIZATIONS, mechanic!.specialization])).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field id="m-exp" label="Experience (years)" error={errors.experienceYears?.message}><Input id="m-exp" type="number" min={0} max={60} aria-invalid={!!errors.experienceYears} {...register("experienceYears")} /></Field>
          <Field id="m-phone" label="Phone" error={errors.phone?.message}><Input id="m-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} /></Field>
          <Field id="m-loc" label="Location"><Input id="m-loc" value={`${mechanic!.city}, ${mechanic!.state}`} disabled /></Field>
        </CardContent>
        <CardFooter className="justify-between gap-2 border-t pt-4">
          <span className="text-xs text-muted-foreground">Referral code <code className="font-mono">{mechanic!.referralCode}</code></span>
          <div className="flex gap-2"><Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset()}>Discard</Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}Save business profile</Button></div>
        </CardFooter>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ preferences */
function PreferencesTab() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const range = useUIStore((s) => s.dateRange);
  const setPreset = useUIStore((s) => s.setPreset);
  const THEMES: { id: Theme; label: string; icon: typeof Sun; desc: string }[] = [
    { id: "light", label: "Light", icon: Sun, desc: "Bright, high-contrast surfaces" },
    { id: "dark", label: "Dark", icon: Moon, desc: "Easier on the eyes at night" },
    { id: "system", label: "System", icon: Monitor, desc: "Follow your device setting" },
  ];
  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader><CardTitle>Theme</CardTitle><CardDescription>Choose how AdvocateX looks on this device.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const active = theme === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={active} onClick={() => { setTheme(t.id); toast.success(`${t.label} theme applied`); }}
                  className={cn("overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "border-action ring-2 ring-action/30" : "hover:border-foreground/20")}>
                  <div className={cn("flex h-20 gap-1.5 p-2.5", t.id === "dark" ? "bg-slate-900" : t.id === "light" ? "bg-slate-100" : "bg-gradient-to-r from-slate-100 from-50% to-slate-900 to-50%")} aria-hidden>
                    <div className={cn("w-1/4 rounded", t.id === "dark" ? "bg-slate-800" : "bg-white")} />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className={cn("h-3 w-2/3 rounded", t.id === "dark" ? "bg-slate-700" : "bg-white")} />
                      <div className={cn("flex-1 rounded", t.id === "dark" ? "bg-slate-800" : "bg-white")} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t p-3">
                    <Icon className={cn("h-4 w-4", active ? "text-action" : "text-muted-foreground")} />
                    <div className="min-w-0"><div className="text-sm font-medium">{t.label}</div><div className="truncate text-[11px] text-muted-foreground">{t.desc}</div></div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Default date range</CardTitle><CardDescription>Applied to dashboards, analytics and tables. You can still change it from the top bar.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-1.5">
            <Label htmlFor="pref-range">Date range</Label>
            <Select value={range.preset === "custom" ? "custom" : range.preset} onValueChange={(v) => { if (v !== "custom") { setPreset(v as "7d" | "30d" | "90d"); toast.success("Default date range updated"); } }}>
              <SelectTrigger id="pref-range"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                {range.preset === "custom" && <SelectItem value="custom" disabled>Custom range (set from top bar)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ notifications */
function NotificationsTab() {
  const prefs = useUIStore((s) => s.notificationPrefs);
  const setPrefs = useUIStore((s) => s.setNotificationPrefs);
  const { role } = useCurrentUser();
  const channels: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: "email", label: "Email notifications", desc: "Send a copy of important notifications to your email." },
    { key: "push", label: "Push notifications", desc: "Show browser push alerts for time-sensitive activity." },
    { key: "weeklyDigest", label: "Weekly digest", desc: "A Monday summary of referrals, conversions and rewards." },
  ];
  const topics: { key: keyof NotificationPrefs; label: string; desc: string; hide?: boolean }[] = [
    { key: "conversions", label: "Conversions", desc: "When a referral is verified or a purchase claim is rejected.", hide: role === "customer" },
    { key: "rewards", label: role === "customer" ? "Loyalty points & rewards" : "Rewards & payouts", desc: role === "customer" ? "Points earned, tier upgrades and redemption confirmations." : "Reward approvals, payout requests and payout status changes." },
    { key: "campaigns", label: role === "customer" ? "Offers" : "Campaigns", desc: role === "customer" ? "New offers and bonus-point promotions." : "Campaign launches, schedule changes and budget alerts." },
    { key: "fraud", label: "Fraud alerts", desc: "Suspicious referral patterns flagged by risk rules.", hide: !(role === "admin" || role === "brand") },
  ];
  const toggle = (key: keyof NotificationPrefs, v: boolean, label: string) => { setPrefs({ [key]: v }); toast.success(`${label} ${v ? "enabled" : "disabled"}`); };
  const Row = ({ k, label, desc }: { k: keyof NotificationPrefs; label: string; desc: string }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div><Label htmlFor={`np-${k}`} className="text-sm font-medium">{label}</Label><p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p></div>
      <Switch id={`np-${k}`} checked={prefs[k]} onCheckedChange={(v) => toggle(k, v, label)} />
    </div>
  );
  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader><CardTitle>Delivery channels</CardTitle><CardDescription>In-app notifications are always on.</CardDescription></CardHeader>
        <CardContent className="divide-y pt-0">{channels.map((c) => <Row key={c.key} k={c.key} label={c.label} desc={c.desc} />)}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Topics</CardTitle><CardDescription>Choose what you want to hear about.</CardDescription></CardHeader>
        <CardContent className="divide-y pt-0">{topics.filter((t) => !t.hide).map((c) => <Row key={c.key} k={c.key} label={c.label} desc={c.desc} />)}</CardContent>
      </Card>
      <DemoNotice>Preferences are saved in this browser. The demo never sends real emails or push messages.</DemoNotice>
    </div>
  );
}

/* ------------------------------------------------------------------ demo */
function storageUsage() {
  const rows = STORAGE_KEYS.map((k) => {
    let bytes = 0;
    try { const v = localStorage.getItem(k.key) ?? sessionStorage.getItem(k.key); bytes = v ? new Blob([v]).size : 0; } catch { /* unavailable */ }
    return { ...k, bytes };
  });
  return rows;
}
const kb = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);

function DemoTab() {
  const { user, role, shop, mechanic, customer, brandId } = useCurrentUser();
  const { brandById } = useLookups();
  const generatedAt = useDataStore((s) => s.generatedAt);
  const refCount = useDataStore((s) => s.referrals.length);
  const rewCount = useDataStore((s) => s.rewards.length);
  const auditCount = useDataStore((s) => s.audit.length);
  const counts = { referrals: refCount, rewards: rewCount, audit: auditCount };
  const [resetOpen, setResetOpen] = useState(false);
  const [usage, setUsage] = useState(storageUsage);
  useEffect(() => { const t = setTimeout(() => setUsage(storageUsage()), 300); return () => clearTimeout(t); }, [generatedAt, counts.referrals, counts.rewards, counts.audit]);
  const total = usage.reduce((s, u) => s + u.bytes, 0);
  const linked = shop ? `${shop.name} (${shop.id})` : mechanic ? `${mechanic.name} — ${mechanic.workshop} (${mechanic.id})` : customer ? `${customer.name} (${customer.id})` : brandId ? `${brandById.get(brandId)?.name} (${brandId})` : "Platform-wide (no linked entity)";

  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div><CardTitle>Demo account</CardTitle><CardDescription className="mt-1">You are using a shared demo identity.</CardDescription></div>
          <Button variant="outline" size="sm" asChild><Link to="/select-role"><Repeat />Switch role</Link></Button>
        </CardHeader>
        <CardContent>
          <dl className="divide-y rounded-lg border text-sm">
            {([
              ["Current role", <Badge key="r" variant="secondary">{ROLE_LABEL[role]}</Badge>],
              ["Demo user ID", <code key="u" className="font-mono text-xs">{user?.id}</code>],
              ["Linked entity", linked],
              ["Data generated", formatDateTime(generatedAt)],
              ["Records", <span key="c" className="num">{formatNumber(counts.referrals)} referrals · {formatNumber(counts.rewards)} reward txns · {formatNumber(counts.audit)} audit events</span>],
            ] as [string, React.ReactNode][]).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 text-right font-medium">{v}</dd></div>)}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Browser storage</CardTitle><CardDescription>Estimated space used by this demo in your browser · <span className="num">{kb(total)}</span> total.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {usage.map((u) => (
            <div key={u.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><code className="font-mono text-xs font-medium">{u.key}</code><span className="text-xs text-muted-foreground num">{kb(u.bytes)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-action" style={{ width: `${total ? Math.max(1, (u.bytes / total) * 100) : 0}%` }} /></div>
              <p className="mt-1 text-[11px] text-muted-foreground">{u.purpose}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><TriangleAlert className="h-4 w-4" />Danger zone</CardTitle><CardDescription>Restore the original generated demo dataset.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">Removes every change made in this browser — new campaigns, verifications, approvals, payouts, redemptions and notifications. Your sign-in and theme are kept.</p>
          <Button variant="destructive" className="shrink-0" onClick={() => setResetOpen(true)}><RefreshCcw />Reset demo data</Button>
        </CardContent>
      </Card>

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} variant="destructive" title="Reset all demo data?" confirmLabel="Reset demo data"
        description={<p>This regenerates the demo dataset and discards all changes made in this browser. This cannot be undone.</p>}
        onConfirm={async () => { await fakeSave(); useDataStore.getState().resetDemo(); setUsage(storageUsage()); toast.success("Demo data reset", { description: "The original sample data has been restored." }); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ privacy */
function PrivacyTab() {
  const items: { icon: typeof Lock; title: string; body: string }[] = [
    { icon: KeyRound, title: "Demo authentication is client-side only", body: "There are no passwords, tokens or server sessions. Anyone using this browser can switch roles. This is intentional for a demo and is not secure." },
    { icon: Database, title: "Data stays in your browser", body: "All records live in localStorage (advx-data, advx-ui, advx-auth). Nothing is sent to a server, and clearing site data removes everything." },
    { icon: ShieldCheck, title: "Customer identifiers are masked", body: "Referral records use demo-safe masked identifiers (e.g. CUS-••1234). All names, phone numbers and GSTINs are fictional." },
    { icon: Lock, title: "Simulated money and messages", body: "Payouts, rewards and redemptions are simulated. No real money is transferred and no real email, SMS or push message is sent." },
  ];
  const prod = [
    "Real authentication (OAuth/OIDC) with httpOnly, secure session cookies and MFA for admins.",
    "Server-side, role-based authorisation on every API call — never trust the browser for permissions.",
    "Encrypt personal data at rest, mask it in logs, and honour DPDP Act consent, retention and deletion rights.",
    "Verify invoices and payouts server-side, with idempotency keys and an append-only, tamper-evident audit log.",
    "Keep AI and payment provider keys on the server; rate-limit and monitor referral endpoints for abuse.",
  ];
  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader><CardTitle>How this demo handles your data</CardTitle><CardDescription>AdvocateX is a frontend-only demonstration.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {items.map((i) => { const Icon = i.icon; return (
            <div key={i.title} className="flex gap-3 rounded-lg border p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-action-soft text-action"><Icon className="h-4 w-4" /></span>
              <div><div className="text-sm font-medium">{i.title}</div><p className="mt-0.5 text-[13px] text-muted-foreground">{i.body}</p></div>
            </div>
          ); })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>What a production backend must add</CardTitle><CardDescription>Before handling real customers, advocates or money.</CardDescription></CardHeader>
        <CardContent>
          <ul className="space-y-2.5 text-[13px]">
            {prod.map((p) => <li key={p} className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" /><span>{p}</span></li>)}
          </ul>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2 text-xs">
            <Button variant="link" size="sm" className="h-auto p-0" asChild><Link to="/legal/privacy">Privacy policy</Link></Button>
            <span className="text-muted-foreground">·</span>
            <Button variant="link" size="sm" className="h-auto p-0" asChild><Link to="/legal/terms">Terms of use</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
