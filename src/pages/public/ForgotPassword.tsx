import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { api } from "@/services/api";
import { FieldError, SimpleHeader } from "./components/public-kit";

const schema = z.object({ email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (v: FormValues) => {
    await api.auth.requestPasswordReset(v.email);
    setSentTo(v.email);
    toast.success("Reset request recorded", { description: "Simulated — no email was sent." });
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader backTo="/login" backLabel="Back to login" />
      <main className="mx-auto flex max-w-6xl justify-center px-4 py-14 sm:px-6 sm:py-20">
        <Card className="w-full max-w-md p-6 sm:p-8">
          {sentTo ? (
            <div className="text-center" role="status">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive"><MailCheck className="h-6 w-6" /></span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, a reset link would be sent to it.
              </p>
              <DemoNotice className="mt-5 text-left">This is a demo: no email is actually sent and no password is changed. Use quick demo access on the login page to continue.</DemoNotice>
              <div className="mt-6 grid gap-2">
                <Button asChild><Link to="/login">Back to login</Link></Button>
                <Button variant="ghost" onClick={() => setSentTo(null)}>Use a different email</Button>
              </div>
            </div>
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-action-soft text-action"><KeyRound className="h-5 w-5" /></span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Reset your password</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Enter the email you signed up with and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email} aria-describedby="email-error" {...register("email")} />
                  <FieldError id="email-error" message={errors.email?.message} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}Send reset link</Button>
              </form>
              <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-action hover:underline"><ArrowLeft className="h-4 w-4" />Back to login</Link>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
