import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/** Generic search + sort + paginate state for client-side tables. */
export function useTableState<T>(rows: T[], opts: {
  search?: (row: T, q: string) => boolean;
  sorters?: Record<string, (row: T) => string | number>;
  initialSort?: { key: string; dir: SortDir };
  pageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(opts.initialSort);
  const [page, setPage] = useState(1);
  const pageSize = opts.pageSize ?? 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q && opts.search ? rows.filter((r) => opts.search!(r, q)) : rows;
    if (sort && opts.sorters?.[sort.key]) {
      const get = opts.sorters[sort.key]!;
      out = [...out].sort((a, b) => {
        const av = get(a), bv = get(b);
        const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? c : -c;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };
  return {
    query, setQuery: (q: string) => { setQuery(q); setPage(1); }, sort, toggleSort,
    page: safePage, setPage, pageCount, pageSize, filtered, pageRows, total: filtered.length,
    resetPage: () => setPage(1),
  };
}

export function SortableHead({ label, sortKey, sort, onSort, className, align }: { label: string; sortKey: string; sort?: { key: string; dir: SortDir }; onSort: (k: string) => void; className?: string; align?: "right" }) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" && "text-right", className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 rounded hover:text-foreground", active && "text-foreground", align === "right" && "flex-row-reverse")}>
        {label}<Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-8" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onPage, className }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void; className?: string }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground", className)}>
      <span className="num">Showing {from}–{to} of {total.toLocaleString("en-IN")}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="px-2 num">Page {page} of {pageCount}</span>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

/** Row of filter controls above a table. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}
