import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="hsl(var(--brand))" />
      <path d="M9 23 L16 8 L23 23" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18 L20 18" stroke="#5eead4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = "/", collapsed, className }: { to?: string; collapsed?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} aria-label="AdvocateX home">
      <LogoMark />
      {!collapsed && <span className="text-[17px] font-semibold tracking-tight">Advocate<span className="text-action">X</span></span>}
    </Link>
  );
}
