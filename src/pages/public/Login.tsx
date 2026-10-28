import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/Logo";
import { api } from "@/services/api";
import { ROLE_HOME, ROLE_LABEL, useAuthStore } from "@/store/auth";
import { DEMO_USERS } from "@/data/catalog";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { DemoAuthNotice, FieldError, ROLE_META, ROLE_ORDER, ThemeToggle } from "./components/public-kit";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const user = useAuthStore((s) => s.user);
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [quick, setQuick] = useState<Role | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: true },
  });
  const remember = watch("remember");
  const busy = isSubmitting || quick !== null;

  const target = (role: Role) => (from && from.startsWith("/app") ? from : ROLE_HOME[role]);

  const onSubmit = async (v: FormValues) => {
    setAuthError(null);
    const u = await api.auth.loginWithEmail(v.email, v.remember);
    if (!u) {
      const msg = "No demo account matches that email. Use one of the demo emails below or quick demo access.";
      setAuthError(msg);
      toast.error("Sign-in failed", { description: "No demo account found for that email." });
      return;
    }
    toast.success(`Welcome back, ${u.name.split(" ")[0]}`, { description: `Signed in as ${ROLE_LABEL[u.role]}` });
    navigate(target(u.role), { replace: true });
  };

  const quickLogin = async (role: Role) => {
    setQuick(role);
    try {
      const u = await api.auth.loginAs(role, remember);
      toast.success(`Signed in as ${u.name}`, { description: `${ROLE_LABEL[role]} demo workspace` });
      navigate(target(role), { replace: true });
    } catch {
      toast.error("Couldn't start the demo session");
      setQuick(null);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_minmax(0,0.9fr)]">
      {/* form side */}
      <div className="flex flex-col">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <Logo />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to AdvocateX</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Use a demo email or jump straight into a role.</p>

            {user && (
              <button type="button" onClick={() => navigate(ROLE_HOME[user.role])}
                className="mt-5 flex w-full items-center justify-between gap-3 rounded-lg border bg-action-soft/60 px-4 py-3 text-left text-sm transition-colors hover:bg-action-soft">
                <span>Continue as <span className="font-semibold">{user.name}</span><span className="text-muted-foreground"> · {ROLE_LABEL[user.role]}</span></span>
                <ArrowRight className="h-4 w-4 text-action" />
              </button>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email || !!authError}
                  aria-describedby="email-error" {...register("email", { onChange: () => setAuthError(null) })} />
                <FieldError id="email-error" message={errors.email?.message} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs font-medium text-action hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="At least 6 characters" className="pr-10"
                    aria-invalid={!!errors.password} aria-describedby="password-error" {...register("password")} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError id="password-error" message={errors.password?.message} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setValue("remember", c === true)} />
                <Label htmlFor="remember" className="font-normal text-muted-foreground">Remember me on this device</Label>
              </div>
              {authError && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{authError}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {isSubmitting && <Loader2 className="animate-spin" />}Sign in
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick demo access</span><Separator className="flex-1" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_ORDER.map((role, i) => {
                const meta = ROLE_META[role];
                return (
                  <button key={role} type="button" onClick={() => quickLogin(role)} disabled={busy}
                    className={cn("flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:border-action/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                      i === ROLE_ORDER.length - 1 && "sm:col-span-2")}>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", meta.tone)}>
                      {quick === role ? <Loader2 className="h-4 w-4 animate-spin" /> : <meta.icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{ROLE_LABEL[role]}</span>
                      <span className="block truncate text-xs text-muted-foreground">{DEMO_USERS[role]!.email}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <DemoAuthNotice className="mt-6" />
            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to AdvocateX? <Link to="/register" className="font-medium text-action hover:underline">Create a demo account</Link>
            </p>
          </div>
        </main>
      </div>

      {/* brand side */}
      <aside className="relative hidden overflow-hidden bg-brand text-brand-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-action/40 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-ai/40 blur-3xl" />
        </div>
        <div className="relative">
          <p className="text-sm font-medium opacity-80">AdvocateX platform</p>
          <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-tight">Trusted recommendations, tracked from QR scan to verified sale.</h2>
          <ul className="mt-8 space-y-3 text-[15px] opacity-90">
            {["Campaigns for brands, shops and mechanics", "Fair, verified commissions and payouts", "Customer loyalty that brings people back"].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-white/80" />{t}</li>
            ))}
          </ul>
        </div>
        <figure className="relative rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
          <Quote className="h-5 w-5 opacity-70" />
          <blockquote className="mt-3 text-[15px] leading-relaxed">“Our customers already trust their mechanic. AdvocateX makes that trust visible and rewards it fairly.”</blockquote>
          <figcaption className="mt-4 text-sm opacity-80">Sample testimonial · fictional workshop owner</figcaption>
        </figure>
      </aside>
    </div>
  );
}
