import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, FileQuestion, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { EmptyState } from "@/components/shared/EmptyState";
import { FieldError, SimpleHeader } from "./components/public-kit";

type Doc = "privacy" | "terms" | "contact";
const TITLES: Record<Doc, string> = { privacy: "Privacy notice", terms: "Terms of use", contact: "Contact us" };
const UPDATED = "Last updated 1 October 2026";

const PRIVACY: { h: string; p: string }[] = [
  { h: "This is a demo", p: "AdvocateX is a demonstration product. This page is placeholder policy text written in plain language for the demo and is not a legally reviewed privacy policy." },
  { h: "What we store", p: "Everything you do in the demo — sign-in, campaigns, referrals and rewards — is stored only in your own browser (local or session storage). Nothing is sent to a server." },
  { h: "Sample data", p: "All people, shops, workshops, brands and figures shown are fictional and generated for demonstration. Any resemblance to real businesses is coincidental." },
  { h: "Referral pages", p: "Opening a referral link records a simulated click in your browser's demo data only. No tracking cookies, analytics or third-party scripts are used." },
  { h: "Clearing your data", p: "You can reset the demo at any time by clearing this site's data in your browser." },
];
const TERMS: { h: string; p: string }[] = [
  { h: "Demo use only", p: "These are placeholder terms for a demo product. AdvocateX is provided as-is for evaluation and presentation purposes, without warranties of any kind." },
  { h: "No real transactions", p: "Payouts, rewards, redemptions and messages in the demo are simulated. No money moves and no messages are delivered." },
  { h: "Accounts", p: "Demo authentication is client-side only and offers no real security. Don't enter real passwords or personal information." },
  { h: "Acceptable use", p: "Please don't attempt to use the demo to impersonate real businesses or to collect information from others." },
  { h: "Changes", p: "These placeholder terms may change as the demo evolves. Continued use of the demo means you accept the current version." },
];

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(1000, "Keep it under 1,000 characters"),
});
type ContactValues = z.infer<typeof contactSchema>;

function ContactPage() {
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: { name: "", email: "", message: "" } });
  const onSubmit = async (v: ContactValues) => {
    await new Promise((r) => setTimeout(r, 700));
    setSent(v.name.split(" ")[0] ?? v.name);
    reset();
    toast.success("Message received", { description: "Simulated — nothing was sent." });
  };
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-muted-foreground">Questions about the demo, plans or a pilot? Send us a note and the (fictional) team will get back to you.</p>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-action-soft text-action"><Mail className="h-4 w-4" /></span>hello@advocatex.demo</li>
          <li className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-positive-soft text-positive"><Phone className="h-4 w-4" /></span>+91 20 4000 0000</li>
          <li className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><MapPin className="h-4 w-4" /></span>Level 4, Demo Tower, Baner Road, Pune 411045</li>
        </ul>
        <p className="text-xs text-muted-foreground">Contact details are fictional and for demonstration only.</p>
      </div>
      <Card className="p-5 sm:p-6">
        {sent ? (
          <div className="py-6 text-center" role="status">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive"><CheckCircle2 className="h-6 w-6" /></span>
            <p className="mt-4 text-lg font-semibold">Message received</p>
            <p className="mt-1 text-sm text-muted-foreground">Thanks, {sent}. In a live product we'd reply within one business day.</p>
            <DemoNotice className="mt-5 text-left">Simulated submission — your message was not sent or stored anywhere.</DemoNotice>
            <Button variant="outline" className="mt-5" onClick={() => setSent(null)}>Send another message</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" autoComplete="name" aria-invalid={!!errors.name} aria-describedby="c-name-error" {...register("name")} />
                <FieldError id="c-name-error" message={errors.name?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="c-email-error" {...register("email")} />
                <FieldError id="c-email-error" message={errors.email?.message} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-message">Message</Label>
              <Textarea id="c-message" rows={5} placeholder="How can we help?" aria-invalid={!!errors.message} aria-describedby="c-message-error" {...register("message")} />
              <FieldError id="c-message-error" message={errors.message?.message} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">{isSubmitting && <Loader2 className="animate-spin" />}Send message</Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function PolicyPage({ sections }: { sections: { h: string; p: string }[] }) {
  return (
    <div className="max-w-2xl space-y-7">
      <DemoNotice>Demo placeholder policy text for a demo product. Not legal advice and not a binding agreement.</DemoNotice>
      {sections.map((s, i) => (
        <section key={s.h}>
          <h2 className="text-base font-semibold"><span className="num mr-2 text-muted-foreground">{i + 1}.</span>{s.h}</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{s.p}</p>
        </section>
      ))}
      <p className="border-t pt-5 text-sm text-muted-foreground">Questions? <Link to="/legal/contact" className="font-medium text-action hover:underline">Contact us</Link>.</p>
    </div>
  );
}

export default function Legal() {
  const { doc = "" } = useParams();
  const known = (["privacy", "terms", "contact"] as const).includes(doc as Doc);
  const d = doc as Doc;
  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        {!known ? (
          <Card><EmptyState icon={FileQuestion} title="Page not found" description="That document doesn't exist." action={<Button asChild><Link to="/">Back to home</Link></Button>} /></Card>
        ) : (
          <>
            <nav className="mb-6 flex flex-wrap gap-1 text-sm" aria-label="Legal">
              {(Object.keys(TITLES) as Doc[]).map((k) => (
                <Link key={k} to={`/legal/${k}`} aria-current={k === d ? "page" : undefined}
                  className={k === d ? "rounded-md bg-muted px-3 py-1.5 font-medium" : "rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"}>
                  {TITLES[k]}
                </Link>
              ))}
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{TITLES[d]}</h1>
            {d !== "contact" && <p className="mt-1 text-sm text-muted-foreground">{UPDATED}</p>}
            <div className="mt-8">
              {d === "privacy" && <PolicyPage sections={PRIVACY} />}
              {d === "terms" && <PolicyPage sections={TERMS} />}
              {d === "contact" && <ContactPage />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
