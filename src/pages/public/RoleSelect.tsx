import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import { ROLE_HOME, ROLE_LABEL, useAuthStore } from "@/store/auth";
import { DEMO_USERS } from "@/data/catalog";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { DemoAuthNotice, ROLE_META, ROLE_ORDER, SimpleHeader } from "./components/public-kit";

export default function RoleSelect() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [pending, setPending] = useState<Role | null>(null);

  const choose = async (role: Role) => {
    if (pending) return;
    setPending(role);
    try {
      const u = await api.auth.loginAs(role);
      toast.success(`Signed in as ${u.name}`, { description: `${ROLE_LABEL[role]} demo workspace` });
      navigate(ROLE_HOME[role]);
    } catch {
      toast.error("Couldn't switch role. Please try again.");
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Choose a demo role</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Each role opens a workspace with realistic sample data. You can switch roles at any time.</p>
          {user && (
            <p className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border bg-card px-3 py-1 text-[13px]">
              Currently signed in as <span className="font-medium">{user.name}</span><Badge variant="action">{ROLE_LABEL[user.role]}</Badge>
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_ORDER.map((role) => {
            const meta = ROLE_META[role];
            const demo = DEMO_USERS[role]!;
            const current = user?.role === role;
            const loading = pending === role;
            return (
              <button key={role} type="button" onClick={() => choose(role)} disabled={pending !== null} aria-busy={loading}
                className={cn(
                  "group flex flex-col rounded-xl border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-action/50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:translate-y-0",
                  current && "border-action/60 ring-1 ring-action/30",
                  pending && !loading && "opacity-60",
                )}>
                <div className="flex items-start justify-between gap-3">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", meta.tone)}><meta.icon className="h-5 w-5" /></span>
                  {current && <Badge variant="action"><Check />Current</Badge>}
                </div>
                <p className="mt-4 text-base font-semibold">{ROLE_LABEL[role]}</p>
                <p className="text-xs text-muted-foreground">{demo.name} · {demo.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{meta.description}</p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What you'll see</p>
                <ul className="mt-2 space-y-1.5 text-[13px]">
                  {meta.bullets.map((b) => <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />{b}</li>)}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-action">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Opening workspace…</> : <>{current ? "Continue" : "Enter"} as {ROLE_LABEL[role]}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                </span>
              </button>
            );
          })}
        </div>
        <DemoAuthNotice className="mx-auto mt-10 max-w-2xl" />
      </main>
    </div>
  );
}
