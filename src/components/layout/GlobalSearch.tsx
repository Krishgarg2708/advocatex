import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Megaphone, Package, Search, Store, Wrench } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDataStore } from "@/store/data";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useScope } from "@/hooks/useScope";
import { navFor } from "./nav";
import { cn } from "@/lib/utils";

interface Hit { id: string; label: string; sub: string; to: string; icon: React.ComponentType<{ className?: string }>; group: string }

export function GlobalSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const scope = useScope();
  const shops = useDataStore((s) => s.shops);
  const mechanics = useDataStore((s) => s.mechanics);
  const allowed = new Set(navFor(role).map((n) => n.to));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Hit[] = [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(t));
    navFor(role).filter((n) => has(n.label)).forEach((n) => out.push({ id: n.to, label: n.label, sub: "Page", to: n.to, icon: n.icon, group: "Pages" }));
    if (allowed.has("/app/campaigns")) scope.campaigns.filter((c) => has(c.name, c.id)).slice(0, 5).forEach((c) => out.push({ id: c.id, label: c.name, sub: `Campaign · ${c.status}`, to: `/app/campaigns/${c.id}`, icon: Megaphone, group: "Campaigns" }));
    if (allowed.has("/app/shops")) shops.filter((s) => has(s.name, s.owner, s.city, s.referralCode)).slice(0, 4).forEach((s) => out.push({ id: s.id, label: s.name, sub: `Shop · ${s.city}`, to: `/app/shops?open=${s.id}`, icon: Store, group: "Shops" }));
    if (allowed.has("/app/mechanics")) mechanics.filter((m) => has(m.name, m.workshop, m.city, m.referralCode)).slice(0, 4).forEach((m) => out.push({ id: m.id, label: m.name, sub: `Mechanic · ${m.workshop}`, to: `/app/mechanics?open=${m.id}`, icon: Wrench, group: "Mechanics" }));
    if (allowed.has("/app/products")) scope.products.filter((p) => has(p.name, p.sku, p.category)).slice(0, 4).forEach((p) => out.push({ id: p.id, label: p.name, sub: `Product · ${p.category}`, to: `/app/products?open=${p.id}`, icon: Package, group: "Products" }));
    if (allowed.has("/app/referrals")) scope.referrals.filter((r) => has(r.id, r.code, r.txnRef)).slice(-4).reverse().forEach((r) => out.push({ id: r.id, label: r.id, sub: `Referral · ${r.status}`, to: `/app/referrals?open=${r.id}`, icon: Link2, group: "Referrals" }));
    return out.slice(0, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, scope, shops, mechanics]);

  const go = (h: Hit) => { navigate(h.to); setQ(""); setOpen(false); inputRef.current?.blur(); };

  return (
    <Popover open={open && q.trim().length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative w-full max-w-sm", className)}>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input ref={inputRef} value={q} role="combobox" aria-expanded={open} aria-label="Search AdvocateX"
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && hits[active]) go(hits[active]!);
              if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
            }}
            placeholder="Search campaigns, advocates, products…"
            className="h-9 w-full rounded-md border border-input bg-muted/40 pl-8 pr-12 text-sm placeholder:text-muted-foreground focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/40" />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-card px-1.5 text-[10px] font-medium text-muted-foreground sm:block">Ctrl K</kbd>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-1.5" onOpenAutoFocus={(e) => e.preventDefault()}>
        {hits.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results for "{q}"</div>
        ) : (
          <ul role="listbox" className="max-h-80 overflow-y-auto">
            {hits.map((h, i) => (
              <li key={h.group + h.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left", i === active && "bg-muted")}>
                  <h.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{h.label}</span><span className="block truncate text-xs capitalize text-muted-foreground">{h.sub}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
