import { BatteryCharging, CircleDot, Disc3, Droplet, Filter, Lightbulb, Package, Thermometer, type LucideIcon } from "lucide-react";
import type { ProductCategory } from "@/types";
import { cn } from "@/lib/utils";

const CAT: Record<ProductCategory, { icon: LucideIcon; hue: number }> = {
  "Engine Oil": { icon: Droplet, hue: 38 },
  Tyres: { icon: CircleDot, hue: 220 },
  Batteries: { icon: BatteryCharging, hue: 152 },
  Brakes: { icon: Disc3, hue: 352 },
  Filters: { icon: Filter, hue: 190 },
  Lighting: { icon: Lightbulb, hue: 50 },
  Coolants: { icon: Thermometer, hue: 200 },
  Accessories: { icon: Package, hue: 262 },
};

/** Clean illustrative product visual — category icon on a tinted, patterned tile (no stock photos). */
export function ProductImage({ category, name, className, size = "md" }: { category: ProductCategory; name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const c = CAT[category] ?? CAT.Accessories;
  const Icon = c.icon;
  const seed = Array.from(name).reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const hue = (c.hue + (seed % 24) - 12 + 360) % 360;
  const iconSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-16 w-16" : "h-10 w-10";
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 75% 95%), hsl(${(hue + 25) % 360} 70% 88%))` }}
      role="img" aria-label={`${category} product illustration`}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden>
        <defs>
          <pattern id={`pp-${seed}`} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform={`rotate(${seed % 60})`}>
            <circle cx="2" cy="2" r="1.2" fill={`hsl(${hue} 50% 60%)`} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#pp-${seed})`} />
      </svg>
      <span className="relative flex items-center justify-center rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:bg-white/80" style={{ color: `hsl(${hue} 60% 38%)` }}>
        <Icon className={iconSize} strokeWidth={1.6} />
      </span>
    </div>
  );
}
