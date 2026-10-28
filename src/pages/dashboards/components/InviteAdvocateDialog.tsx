import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DemoNotice } from "@/components/shared/DemoNotice";
import type { Campaign } from "@/types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;

const schema = z.object({
  name: z.string().trim().min(2, "Enter the advocate's name"),
  contact: z.string().trim().min(1, "Enter a mobile number or email").refine((v) => EMAIL.test(v) || PHONE.test(v), "Enter a valid 10-digit Indian mobile number or email address"),
  type: z.enum(["shop", "mechanic"], { required_error: "Choose an advocate type" }),
  campaignId: z.string().min(1, "Choose a campaign"),
});
type FormValues = z.infer<typeof schema>;

/** Simulated advocate invitation — validates the form and confirms, but sends nothing. */
export function InviteAdvocateDialog({ open, onOpenChange, campaigns }: { open: boolean; onOpenChange: (o: boolean) => void; campaigns: Campaign[] }) {
  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", contact: "", type: "mechanic", campaignId: "" },
  });
  useEffect(() => { if (!open) reset(); }, [open, reset]);
  const type = watch("type");
  const eligible = campaigns.filter((c) => c.advocateTypes.includes(type) && (c.status === "active" || c.status === "scheduled" || c.status === "draft"));

  const onSubmit = async (v: FormValues) => {
    await new Promise((r) => setTimeout(r, 650));
    const camp = campaigns.find((c) => c.id === v.campaignId);
    toast.success(`Invite prepared for ${v.name}`, { description: `Simulated — no ${EMAIL.test(v.contact) ? "email" : "SMS"} was sent. Campaign: ${camp?.name ?? v.campaignId}.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an advocate</DialogTitle>
          <DialogDescription>Invite a shop or mechanic to join one of your campaigns. They'll need to complete verification before earning rewards.</DialogDescription>
        </DialogHeader>
        <form id="invite-advocate" onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-name">Name</Label>
            <Input id="inv-name" placeholder="e.g. Sharma Auto Care" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-contact">Mobile number or email</Label>
            <Input id="inv-contact" placeholder="+91 98xxx xxxxx or name@example.com" aria-invalid={!!errors.contact} {...register("contact")} />
            {errors.contact && <p className="text-xs text-destructive">{errors.contact.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-type">Advocate type</Label>
              <Controller control={control} name="type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="inv-type" aria-invalid={!!errors.type}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="mechanic">Mechanic</SelectItem><SelectItem value="shop">Retail shop</SelectItem></SelectContent>
                </Select>
              )} />
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-campaign">Campaign</Label>
              <Controller control={control} name="campaignId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="inv-campaign" aria-invalid={!!errors.campaignId}><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>
                    {eligible.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    {eligible.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No campaigns open to this advocate type</div>}
                  </SelectContent>
                </Select>
              )} />
              {errors.campaignId && <p className="text-xs text-destructive">{errors.campaignId.message}</p>}
            </div>
          </div>
          <DemoNotice>Demo action — the invitation is simulated. No message, SMS or email is actually sent.</DemoNotice>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="invite-advocate" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}Send invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
