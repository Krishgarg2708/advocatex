import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageLoader({ full }: { full?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center text-muted-foreground", full ? "min-h-screen" : "min-h-[50vh]")} role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" /><span className="sr-only">Loading…</span>
    </div>
  );
}
