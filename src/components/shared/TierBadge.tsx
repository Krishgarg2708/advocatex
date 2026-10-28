import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  Bronze: "bg-[hsl(28_70%_93%)] text-[hsl(28_60%_35%)] dark:bg-[hsl(28_40%_18%)] dark:text-[hsl(28_80%_70%)]",
  Silver: "bg-[hsl(220_14%_92%)] text-[hsl(220_12%_35%)] dark:bg-[hsl(220_10%_22%)] dark:text-[hsl(220_12%_78%)]",
  Gold: "bg-[hsl(45_90%_90%)] text-[hsl(38_80%_32%)] dark:bg-[hsl(42_50%_18%)] dark:text-[hsl(45_90%_65%)]",
  Platinum: "bg-[hsl(250_60%_94%)] text-[hsl(250_45%_40%)] dark:bg-[hsl(250_30%_22%)] dark:text-[hsl(250_80%_80%)]",
  Member: "bg-muted text-muted-foreground",
};
export function TierBadge({ tier, className }: { tier: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", STYLE[tier] ?? STYLE.Member, className)}>
      <Award className="h-3 w-3" />{tier}
    </span>
  );
}
