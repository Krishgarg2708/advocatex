import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Store, Wrench } from "lucide-react";

export function EntityAvatar({ name, hue = 240, size = "md", type, className }: { name: string; hue?: number; size?: "sm" | "md" | "lg" | "xl"; type?: "shop" | "mechanic"; className?: string }) {
  const dims = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm", xl: "h-16 w-16 text-lg" }[size];
  const rounded = type === "shop" ? "rounded-lg" : "rounded-full";
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center font-semibold", dims, rounded, className)}
      style={{ background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 55% 32%)` }}
      aria-hidden>
      {initials(name)}
      {type && size !== "sm" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-card text-muted-foreground">
          {type === "shop" ? <Store className="h-2.5 w-2.5" /> : <Wrench className="h-2.5 w-2.5" />}
        </span>
      )}
    </span>
  );
}
