import { useRef, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CalendarDays, Check, Coins, Gauge, Loader2, Lock, MapPin, Megaphone, Package, Rocket, Save, Store, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductImage } from "@/components/shared/ProductImage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { isoToday } from "@/pages/app/components/CampaignKit";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDataStore } from "@/store/data";
import { BRANDS, STATES } from "@/data/catalog";
import { api } from "@/services/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { DAY_MS } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { AdvocateType, Campaign, CampaignStatus } from "@/types";

const num = (msg: string) => z.coerce.number({ invalid_type_error: msg });
const schema = z.object({
  name: z.string().trim().min(3, "Give the campaign a name (at least 3 characters)").max(80, "Keep the name under 80 characters"),
  description: z.string().trim().min(10, "Describe the campaign in at least 10 characters").max(500, "Keep it under 500 characters"),
  brandId: z.string().min(1, "Choose a brand"),
  productIds: z.array(z.string()).min(1, "Select at least one eligible product"),
  startDate: z.string().min(1, "Choose a start date"),
  endDate: z.string().min(1, "Choose an end date"),
  locations: z.array(z.string()).min(1, "Select at least one target state"),
  advocateTypes: z.array(z.enum(["shop", "mechanic"])).min(1, "Select at least one advocate type"),
  rewardPerConversion: num("Enter a reward").positive("Reward must be greater than ₹0"),
  customerBonusPoints: num("Enter bonus points").int("Use whole points").min(0, "Points cannot be negative"),
  budget: num("Enter a budget").positive("Budget must be greater than ₹0"),
  maxRewardPerAdvocate: num("Enter a cap").positive("Cap must be greater than ₹0"),
  eligibility: z.string().trim().max(400, "Keep it under 400 characters"),
}).superRefine((v, ctx) => {
  if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date can't be before the start date" });
  if (v.budget < v.rewardPerConversion) ctx.addIssue({ code: "custom", path: ["budget"], message: "Budget must cover at least one reward" });
  if (v.maxRewardPerAdvocate > v.budget) ctx.addIssue({ code: "custom", path: ["maxRewardPerAdvocate"], message: "Cap can't exceed the total budget" });
  if (v.maxRewardPerAdvocate < v.rewardPerConversion) ctx.addIssue({ code: "custom", path: ["maxRewardPerAdvocate"], message: "Cap must allow at least one reward" });
});
type FormValues = z.infer<typeof schema>;

const addDays = (iso: string, d: number) => { const t = new Date(`${iso}T00:00:00`); t.setDate(t.getDate() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

function Section({ step, title, description, children }: { step: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-action-soft text-xs font-semibold text-action">{step}</span>
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
function Err({ msg }: { msg?: string }) { return msg ? <p className="text-xs text-destructive" role="alert">{msg}</p> : null; }

export default function CampaignForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, brandId: myBrand, can } = useCurrentUser();
  const campaigns = useDataStore((s) => s.campaigns);
  const products = useDataStore((s) => s.products);
  const existing = id ? campaigns.find((c) => c.id === id) : undefined;
  const isEdit = !!id;
  const forbidden = !can("manageCampaigns") || (isEdit && existing && role === "brand" && existing.brandId !== myBrand);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [submitting, setSubmitting] = useState<null | "draft" | "launch" | "save">(null);

  const defaults = useMemo<FormValues>(() => {
    if (existing) {
      const { name, description, brandId, productIds, startDate, endDate, locations, advocateTypes, rewardPerConversion, customerBonusPoints, budget, maxRewardPerAdvocate, eligibility } = existing;
      return { name, description, brandId, productIds, startDate, endDate, locations, advocateTypes, rewardPerConversion, customerBonusPoints, budget, maxRewardPerAdvocate, eligibility };
    }
    const today = isoToday();
    return { name: "", description: "", brandId: myBrand ?? "", productIds: [], startDate: addDays(today, 7), endDate: addDays(today, 67), locations: [], advocateTypes: ["shop", "mechanic"], rewardPerConversion: 250, customerBonusPoints: 100, budget: 50000, maxRewardPerAdvocate: 5000, eligibility: "Verified advocates in target states. Purchase invoice must be uploaded within 7 days." };
  }, [existing, myBrand]);

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // re-seed only when navigating between campaigns, never over the user's first keystrokes
  const seededFor = useRef(existing?.id);
  useEffect(() => { if (seededFor.current !== existing?.id) { seededFor.current = existing?.id; reset(defaults); } }, [existing?.id]);

  const v = watch();
  const brandId = role === "brand" ? myBrand ?? "" : v.brandId;
  const brandProducts = useMemo(() => products.filter((p) => p.brandId === brandId && (p.status !== "discontinued" || v.productIds.includes(p.id))), [products, brandId, v.productIds]);

  // drop products from another brand when admin switches brand
  useEffect(() => {
    const valid = v.productIds.filter((pid) => products.find((p) => p.id === pid)?.brandId === brandId);
    if (valid.length !== v.productIds.length) setValue("productIds", valid, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  if (forbidden) {
    return <Card><EmptyState icon={Lock} title="You can't edit this campaign" description="Only admins and the owning brand's managers can create or edit campaigns."
      action={<Button variant="outline" asChild><Link to="/app/campaigns"><ArrowLeft />Back to campaigns</Link></Button>} /></Card>;
  }
  if (isEdit && !existing) {
    return <Card><EmptyState icon={Megaphone} title="Campaign not found" description="It may have been removed."
      action={<Button variant="outline" asChild><Link to="/app/campaigns"><ArrowLeft />Back to campaigns</Link></Button>} /></Card>;
  }

  const reward = Number(v.rewardPerConversion) || 0, budget = Number(v.budget) || 0, cap = Number(v.maxRewardPerAdvocate) || 0;
  const maxConv = reward > 0 ? Math.floor(budget / reward) : 0;
  const capConv = reward > 0 ? Math.floor(cap / reward) : 0;
  const minAdvocates = cap > 0 ? Math.ceil(budget / cap) : 0;
  const days = v.startDate && v.endDate && v.endDate >= v.startDate ? Math.round((new Date(v.endDate).getTime() - new Date(v.startDate).getTime()) / DAY_MS) + 1 : 0;
  const selectedProducts = products.filter((p) => v.productIds.includes(p.id));
  const avgPrice = selectedProducts.length ? selectedProducts.reduce((s, p) => s + p.price, 0) / selectedProducts.length : 0;
  const launchStatus: CampaignStatus = v.startDate > isoToday() ? "scheduled" : "active";

  const toggle = <T extends string>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const submit = (mode: "draft" | "launch" | "save") => handleSubmit(async (vals) => {
    setSubmitting(mode);
    try {
      const input = { ...vals, brandId: role === "brand" ? myBrand! : vals.brandId, eligibility: vals.eligibility || "No additional requirements." };
      if (existing) {
        const patch: Partial<Campaign> = { ...input };
        if (mode === "draft") patch.status = "draft";
        if (mode === "launch") patch.status = launchStatus;
        await api.campaigns.update(existing.id, patch);
        toast.success(mode === "launch" ? (launchStatus === "active" ? "Campaign saved and live" : "Campaign saved and scheduled") : "Campaign saved", { description: input.name });
        navigate(`/app/campaigns/${existing.id}`);
      } else {
        const status: CampaignStatus = mode === "draft" ? "draft" : launchStatus;
        const newId = await api.campaigns.create({ ...input, status });
        toast.success(status === "draft" ? "Draft saved" : status === "active" ? "Campaign launched" : "Campaign scheduled", { description: status === "scheduled" ? `${input.name} goes live on ${formatDate(input.startDate)}.` : input.name });
        navigate(`/app/campaigns/${newId}`);
      }
    } finally { setSubmitting(null); }
  }, () => toast.error("Please fix the highlighted fields"));

  const onCancel = () => (isDirty ? setCancelOpen(true) : navigate(existing ? `/app/campaigns/${existing.id}` : "/app/campaigns"));
  const busy = submitting !== null;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" onClick={onCancel}><ArrowLeft />{existing ? "Back to campaign" : "Campaigns"}</Button>
        <PageHeader className="mb-0" title={existing ? `Edit ${existing.name}` : "New campaign"}
          eyebrow={existing ? <StatusBadge status={existing.status} /> : undefined}
          description={existing ? "Changes apply immediately to the campaign and every dashboard that reports on it." : "Set up products, audience, rewards and budget. Save as a draft or launch when ready."} />
      </div>

      <form className="grid gap-6 lg:grid-cols-[1fr,340px]" onSubmit={(e) => { e.preventDefault(); submit(existing ? "save" : "launch")(); }} noValidate>
        <div className="min-w-0 space-y-4">
          <Section step={1} title="Basics" description="What the campaign is and who runs it">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Campaign name</Label>
              <Input id="c-name" {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Monsoon Engine Care" />
              <Err msg={errors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea id="c-desc" rows={3} {...register("description")} aria-invalid={!!errors.description} placeholder="Goal of the campaign and what advocates should promote." />
              <Err msg={errors.description?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-brand">Brand</Label>
              {role === "brand" ? (
                <div id="c-brand" className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm"><Lock className="h-3.5 w-3.5 text-muted-foreground" />{BRANDS.find((b) => b.id === myBrand)?.name}</div>
              ) : (
                <Controller control={control} name="brandId" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="c-brand" aria-invalid={!!errors.brandId}><SelectValue placeholder="Choose a brand" /></SelectTrigger>
                    <SelectContent>{BRANDS.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              )}
              <Err msg={errors.brandId?.message} />
            </div>
          </Section>

          <Section step={2} title="Eligible products" description="Verified purchases of these products earn the campaign reward">
            {!brandId ? <p className="text-[13px] text-muted-foreground">Choose a brand first to see its products.</p> : (
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Eligible products" aria-invalid={!!errors.productIds}>
                {brandProducts.map((p) => {
                  const checked = v.productIds.includes(p.id);
                  return (
                    <label key={p.id} htmlFor={`prod-${p.id}`} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40", checked && "border-action/50 bg-action-soft/40")}>
                      <Checkbox id={`prod-${p.id}`} checked={checked} onCheckedChange={() => setValue("productIds", toggle(v.productIds, p.id), { shouldDirty: true, shouldValidate: true })} />
                      <ProductImage category={p.category} name={p.name} size="sm" className="h-9 w-9 shrink-0 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{formatCurrency(p.price)} · {p.category}{p.status !== "active" && ` · ${p.status}`}</div>
                      </div>
                    </label>
                  );
                })}
                {brandProducts.length === 0 && <p className="text-[13px] text-muted-foreground">This brand has no products yet. <Link to="/app/products?new=1" className="text-action hover:underline">Add a product</Link></p>}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Err msg={errors.productIds?.message} />
              {brandProducts.length > 0 && (
                <button type="button" className="ml-auto text-xs font-medium text-action hover:underline" onClick={() => setValue("productIds", v.productIds.length === brandProducts.length ? [] : brandProducts.map((p) => p.id), { shouldDirty: true, shouldValidate: true })}>
                  {v.productIds.length === brandProducts.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
          </Section>

          <Section step={3} title="Schedule & audience" description="When it runs, where, and which advocates can join">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-start">Start date</Label>
                <Input id="c-start" type="date" {...register("startDate")} aria-invalid={!!errors.startDate} />
                <Err msg={errors.startDate?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-end">End date</Label>
                <Input id="c-end" type="date" min={v.startDate} {...register("endDate")} aria-invalid={!!errors.endDate} />
                <Err msg={errors.endDate?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Target locations</Label>
                <button type="button" className="text-xs font-medium text-action hover:underline" onClick={() => setValue("locations", v.locations.length === STATES.length ? [] : [...STATES], { shouldDirty: true, shouldValidate: true })}>
                  {v.locations.length === STATES.length ? "Clear all" : "All states"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Target locations">
                {STATES.map((s) => {
                  const on = v.locations.includes(s);
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => setValue("locations", toggle(v.locations, s), { shouldDirty: true, shouldValidate: true })}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] transition-colors", on ? "border-action bg-action text-white" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      {on && <Check className="h-3 w-3" />}{s}
                    </button>
                  );
                })}
              </div>
              <Err msg={errors.locations?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Eligible advocate types</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {([["shop", "Shops", "Retail spares & accessory stores", Store], ["mechanic", "Mechanics", "Workshops & independent technicians", Wrench]] as const).map(([val, label, sub, Icon]) => {
                  const on = v.advocateTypes.includes(val);
                  return (
                    <label key={val} htmlFor={`adv-${val}`} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40", on && "border-action/50 bg-action-soft/40")}>
                      <Checkbox id={`adv-${val}`} checked={on} onCheckedChange={() => setValue("advocateTypes", toggle<AdvocateType>(v.advocateTypes, val), { shouldDirty: true, shouldValidate: true })} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div><div className="text-[13px] font-medium">{label}</div><div className="text-[11px] text-muted-foreground">{sub}</div></div>
                    </label>
                  );
                })}
              </div>
              <Err msg={errors.advocateTypes?.message} />
            </div>
          </Section>

          <Section step={4} title="Rewards & budget" description="Advocates earn only on verified purchases. Rewards are simulated in this demo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-reward">Reward per verified conversion (₹)</Label>
                <Input id="c-reward" type="number" min={0} step="1" inputMode="decimal" {...register("rewardPerConversion")} aria-invalid={!!errors.rewardPerConversion} />
                <Err msg={errors.rewardPerConversion?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-points">Customer bonus points</Label>
                <Input id="c-points" type="number" min={0} step="1" inputMode="numeric" {...register("customerBonusPoints")} aria-invalid={!!errors.customerBonusPoints} />
                <Err msg={errors.customerBonusPoints?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-budget">Total budget (₹)</Label>
                <Input id="c-budget" type="number" min={0} step="100" inputMode="decimal" {...register("budget")} aria-invalid={!!errors.budget} />
                <Err msg={errors.budget?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-cap">Maximum reward per advocate (₹)</Label>
                <Input id="c-cap" type="number" min={0} step="100" inputMode="decimal" {...register("maxRewardPerAdvocate")} aria-invalid={!!errors.maxRewardPerAdvocate} />
                <Err msg={errors.maxRewardPerAdvocate?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-elig">Eligibility requirements</Label>
              <Textarea id="c-elig" rows={3} {...register("eligibility")} aria-invalid={!!errors.eligibility} placeholder="e.g. Verified advocates only. Invoice must be uploaded within 7 days." />
              <Err msg={errors.eligibility?.message} />
            </div>
          </Section>

          {/* actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
            {(!existing || existing.status === "draft") && (
              <Button type="button" variant="outline" onClick={() => submit("draft")()} disabled={busy}>{submitting === "draft" ? <Loader2 className="animate-spin" /> : <Save />}Save as draft</Button>
            )}
            {existing && existing.status !== "draft" ? (
              <Button type="submit" disabled={busy}>{submitting === "save" ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button>
            ) : (
              <Button type="button" onClick={() => submit("launch")()} disabled={busy}>{submitting === "launch" ? <Loader2 className="animate-spin" /> : <Rocket />}{launchStatus === "scheduled" ? "Schedule campaign" : existing ? "Save & launch" : "Create & launch"}</Button>
            )}
          </div>
        </div>

        {/* live preview */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand/10 via-action/10 to-positive/10 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{BRANDS.find((b) => b.id === brandId)?.name ?? "No brand selected"}</span>
                <StatusBadge status={existing && existing.status !== "draft" ? existing.status : launchStatus} />
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">{v.name || "Untitled campaign"}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />
                {v.startDate ? formatDate(v.startDate, { day: "numeric", month: "short" }) : "—"} – {v.endDate ? formatDate(v.endDate, { day: "numeric", month: "short", year: "numeric" }) : "—"}{days > 0 && ` · ${days} days`}
              </div>
            </div>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Coins className="h-3 w-3" />Per conversion</div><div className="text-sm font-semibold text-positive num">{formatCurrency(reward)}</div></div>
                <div className="rounded-lg border p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Gauge className="h-3 w-3" />Budget</div><div className="text-sm font-semibold num">{formatCurrency(budget, { compact: budget >= 100000 })}</div></div>
                <div className="rounded-lg border p-2.5"><div className="text-[11px] text-muted-foreground">Max conversions</div><div className="text-sm font-semibold num">{formatNumber(maxConv)}</div></div>
                <div className="rounded-lg border p-2.5"><div className="text-[11px] text-muted-foreground">Per-advocate cap</div><div className="text-sm font-semibold num">{formatNumber(capConv)} sales</div></div>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>Budget funds up to <span className="font-semibold text-foreground num">{formatNumber(maxConv)}</span> verified conversions ({formatCurrency(budget)} ÷ {formatCurrency(reward)}).</li>
                <li>At least <span className="font-semibold text-foreground num">{formatNumber(minAdvocates)}</span> advocates needed to fully use the budget at the {formatCurrency(cap)} cap.</li>
                {avgPrice > 0 && <li>Reward ≈ <span className="font-semibold text-foreground num">{((reward / avgPrice) * 100).toFixed(1)}%</span> of the average eligible product price ({formatCurrency(avgPrice)}).</li>}
                {maxConv > 0 && avgPrice > 0 && <li>Max attributed revenue ≈ <span className="font-semibold text-foreground num">{formatCurrency(maxConv * avgPrice, { compact: true })}</span> if fully used.</li>}
                <li>Customers get <span className="font-semibold text-foreground num">+{Number(v.customerBonusPoints) || 0}</span> bonus loyalty points per verified purchase.</li>
              </ul>
              <div className="space-y-2 border-t pt-3 text-xs">
                <div className="flex items-start gap-2"><Package className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span>{selectedProducts.length ? selectedProducts.map((p) => p.name).join(", ") : <span className="text-muted-foreground">No products selected</span>}</span></div>
                <div className="flex items-start gap-2"><MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span>{v.locations.length ? (v.locations.length === STATES.length ? "All states" : v.locations.join(", ")) : <span className="text-muted-foreground">No locations selected</span>}</span></div>
                <div className="flex items-start gap-2"><Users className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex flex-wrap gap-1">{v.advocateTypes.length ? v.advocateTypes.map((a) => <Badge key={a} variant="secondary">{a === "shop" ? "Shops" : "Mechanics"}</Badge>) : <span className="text-muted-foreground">No advocate types</span>}</span>
                </div>
              </div>
              <DemoNotice>{launchStatus === "scheduled" ? "Launching will schedule this campaign — it goes live on the start date." : "Launching makes it live immediately for eligible advocates."} Rewards and budgets are simulated.</DemoNotice>
            </CardContent>
          </Card>
        </aside>
      </form>

      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Discard unsaved changes?" description="Your edits to this campaign haven't been saved and will be lost."
        confirmLabel="Discard changes" variant="destructive" onConfirm={() => navigate(existing ? `/app/campaigns/${existing.id}` : "/app/campaigns")} />
    </div>
  );
}
