import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small, consistent disclosure that an action or figure is simulated. */
export function DemoNotice({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground", className)}>
      <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
