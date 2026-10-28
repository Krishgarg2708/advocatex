import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Coins, Gift, IndianRupee, Info, Megaphone, MousePointerClick, Package, Pencil, Plus, Sparkles, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ProductImage } from "@/components/shared/ProductImage";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterBar, Pagination, SearchInput, SortableHead, useTableState } from "@/components/shared/table-kit";
import { FilterSelect, SortControl, ViewToggle, type ViewMode } from "@/pages/app/components/DirectoryKit";
import { PRODUCT_CATEGORIES, ProductFormDialog } from "@/pages/app/components/ProductFormDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { useLookups } from "@/hooks/useLookups";
import { useDataStore } from "@/store/data";
import { BRANDS } from "@/data/catalog";
import { funnel } from "@/lib/metrics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, Product } from "@/types";

const REWARD_HINT = "Standard reward is the default advocate payout per verified sale. Campaigns can set their own per-conversion reward, which applies while the campaign is live.";

export default function Products() {
  const { role, can, brandId } = useCurrentUser();
  const scope = useScope();
  const campaigns = useDataStore((s) => s.campaigns);
  const { brandById } = useLookups();
  const [params, setParams] = useSearchParams();
  const canManage = can("manageProducts");
  const isCustomer = role === "customer";
  const isAdvocate = role === "shop" || role === "mechanic";
  const products = scope.products;

  const [view, setView] = useState<ViewMode>("grid");
  const [cat, setCat] = useState<string>("all");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    const id = params.get("open");
    if (id) setOpenId(id);
    if (params.get("new") === "1" && canManage) { setEditing(null); setFormOpen(true); }
  }, [params, canManage]);
  const clearParam = (key: string) => { if (params.get(key)) { const p = new URLSearchParams(params); p.delete(key); setParams(p, { replace: true }); } };

  // campaigns visible to this role that include each product
  const visibleCampaigns = useMemo<Campaign[]>(() => (role === "admin" ? campaigns : role === "customer" ? campaigns.filter((c) => c.status === "active") : scope.campaigns), [role, campaigns, scope.campaigns]);
  const campaignsFor = useMemo(() => {
    const m = new Map<string, Campaign[]>();
    for (const c of visibleCampaigns) for (const pid of c.productIds) m.set(pid, [...(m.get(pid) ?? []), c]);
    return m;
  }, [visibleCampaigns]);
  const bestLiveReward = (p: Product) => Math.max(0, ...(campaignsFor.get(p.id) ?? []).filter((c) => c.status === "active").map((c) => c.rewardPerConversion));
  const bestBonus = (p: Product) => Math.max(0, ...(campaignsFor.get(p.id) ?? []).filter((c) => c.status === "active").map((c) => c.customerBonusPoints));

  const filteredRows = useMemo(() => products.filter((p) =>
    (cat === "all" || p.category === cat) && (brand === "all" || p.brandId === brand) && (status === "all" || p.status === status)
  ), [products, cat, brand, status]);

  const t = useTableState(filteredRows, {
    search: (p, q) => [p.name, p.sku, p.category, p.description, brandById.get(p.brandId)?.name ?? ""].some((x) => x.toLowerCase().includes(q)),
    sorters: { name: (p) => p.name, price: (p) => p.price, reward: (p) => p.referralReward, points: (p) => p.loyaltyPoints, newest: (p) => p.createdAt, category: (p) => p.category, campaigns: (p) => (campaignsFor.get(p.id) ?? []).length },
    initialSort: { key: "newest", dir: "desc" },
    pageSize: view === "grid" ? 12 : 10,
  });

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if ((brand === "all" || p.brandId === brand) && (status === "all" || p.status === status)) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products, brand, status]);
  const anyFilter = cat !== "all" || brand !== "all" || status !== "all" || !!t.query;
  const clearFilters = () => { setCat("all"); setBrand("all"); setStatus("all"); t.setQuery(""); };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  const sortOptions = [{ key: "newest", label: "Newest" }, { key: "name", label: "Name" }, { key: "price", label: "Price" }, { key: isCustomer ? "points" : "reward", label: isCustomer ? "Points" : "Reward" }];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCustomer ? "Products & rewards" : "Product catalogue"}
        description={isCustomer ? "Eligible products from participating brands — see the loyalty points you earn on every verified purchase."
          : isAdvocate ? "Active products you can recommend. Rewards shown are standard rates; live campaigns may pay more."
          : role === "brand" ? `Your brand's products · ${brandById.get(brandId ?? "")?.name ?? ""}` : "Every product across participating brands, with rewards, loyalty offers and campaign availability."}
        actions={canManage ? <Button onClick={openNew}><Plus />Add product</Button> : undefined}
      />

      {/* category chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin" role="group" aria-label="Filter by category">
        {[["all", "All products", Array.from(catCounts.values()).reduce((s, n) => s + n, 0)] as const, ...PRODUCT_CATEGORIES.filter((c) => catCounts.get(c)).map((c) => [c, c, catCounts.get(c) ?? 0] as const)].map(([v, label, n]) => (
          <button key={v} type="button" onClick={() => { setCat(v); t.resetPage(); }} aria-pressed={cat === v}
            className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors", cat === v ? "border-action bg-action text-white" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {label}<span className={cn("rounded-full px-1.5 text-[11px] num", cat === v ? "bg-white/20" : "bg-muted")}>{n}</span>
          </button>
        ))}
      </div>

      <Card>
        <FilterBar>
          <SearchInput value={t.query} onChange={t.setQuery} placeholder="Search products, SKU…" />
          {role === "admin" && <FilterSelect label="Brand" value={brand} onChange={(v) => { setBrand(v); t.resetPage(); }} allLabel="All brands" options={BRANDS.map((b) => ({ value: b.id, label: b.name }))} className="sm:w-48" />}
          {canManage && <FilterSelect label="Product status" value={status} onChange={(v) => { setStatus(v); t.resetPage(); }} allLabel="All statuses" options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "discontinued", label: "Discontinued" }]} />}
          <div className="flex items-center gap-2 sm:ml-auto">
            {view === "grid" && <SortControl sort={t.sort} onSort={t.toggleSort} options={sortOptions} />}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </FilterBar>

        {t.total === 0 ? (
          <EmptyState icon={Package} title={anyFilter ? "No products match these filters" : "No products yet"}
            description={anyFilter ? "Try another category or clear the filters." : canManage ? "Add your first product to start building campaigns." : "Products will appear here once brands publish them."}
            action={anyFilter ? <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> : canManage ? <Button size="sm" onClick={openNew}><Plus />Add product</Button> : undefined} />
        ) : view === "grid" ? (
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {t.pageRows.map((p) => {
              const cs = campaignsFor.get(p.id) ?? [];
              const live = cs.filter((c) => c.status === "active");
              const best = bestLiveReward(p);
              return (
                <div key={p.id} role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-action/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="relative">
                    <ProductImage category={p.category} name={p.name} className="h-36" />
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      <Badge variant="outline" className="border-white/60 bg-white/80 text-slate-700 backdrop-blur">{p.category}</Badge>
                    </div>
                    {p.status !== "active" && <div className="absolute right-3 top-3"><StatusBadge status={p.status} context="product" /></div>}
                    {live.length > 0 && !isCustomer && <div className="absolute bottom-3 right-3"><Badge variant="positive" className="shadow-sm"><Megaphone />{live.length} live</Badge></div>}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{brandById.get(p.brandId)?.name}</div>
                    <div className="mt-0.5 line-clamp-2 font-medium leading-snug group-hover:text-action">{p.name}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    <div className="mt-auto pt-3">
                      <div className="flex items-end justify-between gap-2">
                        <div><div className="text-[11px] text-muted-foreground">Indicative price</div><div className="text-lg font-semibold num">{formatCurrency(p.price)}</div></div>
                        {isCustomer ? (
                          <div className="text-right"><div className="text-[11px] text-muted-foreground">You earn</div><div className="text-sm font-semibold text-brand num">{formatNumber(p.loyaltyPoints + bestBonus(p))} pts</div></div>
                        ) : (
                          <div className="text-right"><div className="text-[11px] text-muted-foreground">Standard reward</div><div className="text-sm font-semibold text-positive num">{formatCurrency(p.referralReward)}</div></div>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                        <Gift className="h-3.5 w-3.5 shrink-0 text-brand" /><span className="truncate">{p.loyaltyOffer}</span>
                      </div>
                      {!isCustomer && (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {best > 0 ? <>Up to <span className="font-semibold text-foreground">{formatCurrency(best)}</span> per sale in live campaigns</> : cs.length ? `${cs.length} campaign${cs.length > 1 ? "s" : ""} (none live)` : "Not in any campaign"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Product" sortKey="name" sort={t.sort} onSort={t.toggleSort} />
                <SortableHead label="Category" sortKey="category" sort={t.sort} onSort={t.toggleSort} className="hidden md:table-cell" />
                <SortableHead label="Price" sortKey="price" sort={t.sort} onSort={t.toggleSort} align="right" />
                {isCustomer
                  ? <SortableHead label="Points" sortKey="points" sort={t.sort} onSort={t.toggleSort} align="right" />
                  : <SortableHead label="Std. reward" sortKey="reward" sort={t.sort} onSort={t.toggleSort} align="right" className="hidden sm:table-cell" />}
                <SortableHead label={isCustomer ? "Offers" : "Campaigns"} sortKey="campaigns" sort={t.sort} onSort={t.toggleSort} className="hidden lg:table-cell" />
                {canManage && <SortableHead label="Added" sortKey="newest" sort={t.sort} onSort={t.toggleSort} className="hidden xl:table-cell" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.pageRows.map((p) => {
                const cs = campaignsFor.get(p.id) ?? [];
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setOpenId(p.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductImage category={p.category} name={p.name} size="sm" className="h-10 w-10 shrink-0 rounded-lg" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><span className="truncate font-medium">{p.name}</span>{p.status !== "active" && <StatusBadge status={p.status} context="product" />}</div>
                          <div className="truncate text-xs text-muted-foreground">{brandById.get(p.brandId)?.name} · <span className="font-mono">{p.sku}</span></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-[13px] md:table-cell">{p.category}</TableCell>
                    <TableCell className="text-right num">{formatCurrency(p.price)}</TableCell>
                    {isCustomer
                      ? <TableCell className="text-right font-medium text-brand num">{formatNumber(p.loyaltyPoints + bestBonus(p))}</TableCell>
                      : <TableCell className="hidden text-right font-medium text-positive num sm:table-cell">{formatCurrency(p.referralReward)}</TableCell>}
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {cs.slice(0, 2).map((c) => <Badge key={c.id} variant={c.status === "active" ? "positive" : "muted"} className="max-w-[160px] truncate">{c.name}</Badge>)}
                        {cs.length > 2 && <Badge variant="outline">+{cs.length - 2}</Badge>}
                        {cs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    {canManage && <TableCell className="hidden text-[13px] text-muted-foreground xl:table-cell">{formatDate(p.createdAt)}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={t.page} pageCount={t.pageCount} total={t.total} pageSize={t.pageSize} onPage={t.setPage} />
      </Card>

      <ProductDetailSheet id={openId} onClose={() => { setOpenId(null); clearParam("open"); }} campaigns={campaignsFor} onEdit={canManage ? openEdit : undefined} />
      <ProductFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) { setEditing(null); clearParam("new"); } }}
        product={editing} lockedBrandId={role === "brand" ? brandId : undefined} onSaved={(id) => setOpenId(id)} />
    </div>
  );
}

function ProductDetailSheet({ id, onClose, campaigns, onEdit }: { id: string | null; onClose: () => void; campaigns: Map<string, Campaign[]>; onEdit?: (p: Product) => void }) {
  const { role } = useCurrentUser();
  const scope = useScope();
  const allProducts = useDataStore((s) => s.products);
  const { brandById } = useLookups();
  const p = id ? scope.products.find((x) => x.id === id) ?? (role === "admin" ? allProducts.find((x) => x.id === id) : undefined) : undefined;
  const isCustomer = role === "customer";
  const isAdvocate = role === "shop" || role === "mechanic";
  const perf = useMemo(() => (p && !isCustomer ? funnel(scope.referrals.filter((r) => r.productId === p.id)) : null), [p, isCustomer, scope.referrals]);
  const cs = p ? campaigns.get(p.id) ?? [] : [];
  const live = cs.filter((c) => c.status === "active");

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg">
        {!p ? (
          <>
            <SheetHeader><SheetTitle>Product not found</SheetTitle><SheetDescription>It may be inactive or outside your access.</SheetDescription></SheetHeader>
            <SheetBody><EmptyState icon={Package} title="Nothing to show" /></SheetBody>
          </>
        ) : (
          <>
            <ProductImage category={p.category} name={p.name} size="lg" className="h-44 shrink-0" />
            <SheetHeader className="border-t">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{p.category}</Badge>
                <StatusBadge status={p.status} context="product" />
                <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
              </div>
              <SheetTitle className="text-lg leading-snug">{p.name}</SheetTitle>
              <SheetDescription>{brandById.get(p.brandId)?.name}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <p className="text-sm leading-relaxed">{p.description}</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><IndianRupee className="h-3.5 w-3.5" />Indicative price</div><div className="mt-1 text-lg font-semibold num">{formatCurrency(p.price)}</div></div>
                {isCustomer ? (
                  <div className="rounded-lg border border-brand/20 bg-brand-soft/50 p-3"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-brand" />Points you earn</div><div className="mt-1 text-lg font-semibold text-brand num">{formatNumber(p.loyaltyPoints)}{live.length > 0 && <span className="ml-1 text-xs font-medium">+ up to {Math.max(...live.map((c) => c.customerBonusPoints))} bonus</span>}</div></div>
                ) : (
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Coins className="h-3.5 w-3.5 text-positive" />Standard reward
                      <Hint content={REWARD_HINT}><button type="button" aria-label="About standard reward"><Info className="h-3 w-3" /></button></Hint>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-positive num">{formatCurrency(p.referralReward)}</div>
                  </div>
                )}
                {!isCustomer && <div className="rounded-lg border p-3"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-brand" />Customer points</div><div className="mt-1 text-lg font-semibold num">{formatNumber(p.loyaltyPoints)}</div></div>}
                <div className={cn("rounded-lg border p-3", isCustomer && "col-span-2")}><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Gift className="h-3.5 w-3.5 text-brand" />Loyalty offer</div><div className="mt-1 text-[13px] font-medium">{p.loyaltyOffer}</div></div>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">{isCustomer ? "Live offers" : "Campaign availability"}</h3>
                {cs.length === 0 ? <p className="text-[13px] text-muted-foreground">{isCustomer ? "No campaign offers right now." : "Not part of any campaign you can see."}</p> : (
                  <div className="space-y-2">
                    {cs.map((c) => {
                      const inner = (
                        <>
                          <Megaphone className="h-4 w-4 shrink-0 text-action" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{isCustomer ? `+${c.customerBonusPoints} bonus points · until ${formatDate(c.endDate)}` : `${formatCurrency(c.rewardPerConversion)} per verified sale · ${formatDate(c.startDate, { day: "numeric", month: "short" })} – ${formatDate(c.endDate, { day: "numeric", month: "short" })}`}</div>
                          </div>
                          {!isCustomer && <StatusBadge status={c.status} />}
                        </>
                      );
                      return isCustomer ? <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2.5">{inner}</div> : (
                        <Link key={c.id} to={`/app/campaigns/${c.id}`} className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:border-action/40 hover:bg-muted/30">{inner}</Link>
                      );
                    })}
                  </div>
                )}
                {!isCustomer && <p className="mt-2 text-[11px] text-muted-foreground">{REWARD_HINT}</p>}
              </section>

              {perf && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold">Performance</h3>
                    <span className="text-[11px] text-muted-foreground">{isAdvocate ? "Your referrals · lifetime" : role === "brand" ? "Your campaigns · lifetime" : "All campaigns · lifetime"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-muted/60 p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><MousePointerClick className="h-3 w-3" />Referrals</div><div className="text-sm font-semibold num">{formatNumber(perf.clicks)}</div></div>
                    <div className="rounded-lg bg-muted/60 p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3 w-3" />Verified</div><div className="text-sm font-semibold num">{formatNumber(perf.verified)}</div></div>
                    <div className="rounded-lg bg-muted/60 p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Tag className="h-3 w-3" />Conv. rate</div><div className="text-sm font-semibold num">{formatPercent(perf.conversionRate)}</div></div>
                    <div className="rounded-lg bg-muted/60 p-2.5"><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><IndianRupee className="h-3 w-3" />Revenue</div><div className="text-sm font-semibold num">{formatCurrency(perf.revenue, { compact: true })}</div></div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Attributed revenue counts verified purchases only.</p>
                </section>
              )}
              <div className="text-[11px] text-muted-foreground">Added {formatDate(p.createdAt)}</div>
            </SheetBody>
            {(onEdit || isAdvocate) && (
              <SheetFooter>
                {isAdvocate && live.length > 0 && <Button variant="outline" asChild><Link to={`/app/campaigns/${live[0]!.id}`}><Megaphone />Promote via campaign</Link></Button>}
                {onEdit && <Button onClick={() => onEdit(p)}><Pencil />Edit product</Button>}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
