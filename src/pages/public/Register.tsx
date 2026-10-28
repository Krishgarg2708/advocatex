import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { ROLE_HOME, ROLE_LABEL } from "@/store/auth";
import type { Role } from "@/types";
import { DemoAuthNotice, FieldError, SimpleHeader } from "./components/public-kit";

const ROLE_OPTIONS: { value: Exclude<Role, "admin">; label: string; hint: string }[] = [
  { value: "mechanic", label: "Mechanic advocate", hint: "Recommend products and earn commissions" },
  { value: "shop", label: "Shop advocate", hint: "Run referrals from your spare-parts shop" },
  { value: "brand", label: "Brand manager", hint: "Create and measure referral campaigns" },
  { value: "customer", label: "Customer", hint: "Earn and redeem loyalty points" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  phone: z.string().trim().optional().refine((v) => !v || /^\+?[0-9\s-]{8,16}$/.test(v), "Enter a valid phone number"),
  role: z.enum(["mechanic", "shop", "brand", "customer"], { errorMap: () => ({ message: "Choose how you'll use AdvocateX" }) }),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm: z.string().min(1, "Confirm your password"),
  terms: z.boolean().refine((v) => v, "You need to accept the terms to continue"),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type FormValues = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", role: undefined, password: "", confirm: "", terms: false },
  });

  const onSubmit = async (v: FormValues) => {
    try {
      const u = await api.auth.register({ name: v.name, email: v.email, role: v.role, phone: v.phone || undefined });
      toast.success("Demo account created", { description: `Welcome, ${u.name.split(" ")[0]}. You're exploring as ${ROLE_LABEL[u.role]}.` });
      navigate(ROLE_HOME[u.role], { replace: true });
    } catch {
      toast.error("Couldn't create the demo account. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      <main className="mx-auto flex max-w-6xl justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-semibold tracking-tight">Create your demo account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">You'll get a fully populated workspace for the role you choose.</p>
          <Card className="mt-6 p-5 sm:p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" autoComplete="name" placeholder="e.g. Anita Rao" aria-invalid={!!errors.name} aria-describedby="name-error" {...register("name")} />
                <FieldError id="name-error" message={errors.name?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email} aria-describedby="email-error" {...register("email")} />
                  <FieldError id="email-error" message={errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="phone" type="tel" autoComplete="tel" placeholder="+91 98xxx xxxxx" aria-invalid={!!errors.phone} aria-describedby="phone-error" {...register("phone")} />
                  <FieldError id="phone-error" message={errors.phone?.message} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">I am a…</Label>
                <Controller control={control} name="role" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="role" aria-invalid={!!errors.role} aria-describedby="role-error" onBlur={field.onBlur}><SelectValue placeholder="Choose your role" /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="font-medium">{o.label}</span><span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{o.hint}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
                <FieldError id="role-error" message={errors.role?.message} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? "text" : "password"} autoComplete="new-password" className="pr-10" aria-invalid={!!errors.password} aria-describedby="password-error" {...register("password")} />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError id="password-error" message={errors.password?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input id="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" aria-invalid={!!errors.confirm} aria-describedby="confirm-error" {...register("confirm")} />
                  <FieldError id="confirm-error" message={errors.confirm?.message} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <Controller control={control} name="terms" render={({ field }) => (
                    <Checkbox id="terms" className="mt-0.5" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-invalid={!!errors.terms} aria-describedby="terms-error" />
                  )} />
                  <Label htmlFor="terms" className="font-normal leading-snug text-muted-foreground">
                    I accept the <Link to="/legal/terms" className="font-medium text-action hover:underline">demo terms</Link> and <Link to="/legal/privacy" className="font-medium text-action hover:underline">privacy notice</Link>.
                  </Label>
                </div>
                <FieldError id="terms-error" message={errors.terms?.message} />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}Create account
              </Button>
            </form>
          </Card>
          <DemoAuthNotice className="mt-4" />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-action hover:underline">Sign in</Link>
            <span className="mx-2">·</span>
            <Link to="/select-role" className="font-medium text-action hover:underline">Try a demo role</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
