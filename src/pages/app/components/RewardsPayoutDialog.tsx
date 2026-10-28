import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Landmark, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DemoNotice } from "@/components/shared/DemoNotice";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export const MIN_PAYOUT = 500;
type Method = "upi" | "bank";

export function RewardsPayoutDialog({ open, onOpenChange, advocateId, available, payeeName }: {
  open: boolean; onOpenChange: (o: boolean) => void; advocateId: string; available: number; payeeName: string;
}) {
  const schema = useMemo(() => z.object({
    amount: z.coerce.number({ invalid_type_error: "Enter an amount" })
      .int("Use whole rupees")
      .min(MIN_PAYOUT, `Minimum payout is ${formatCurrency(MIN_PAYOUT)}`)
      .max(available, `You can withdraw up to ${formatCurrency(available)}`),
    method: z.enum(["upi", "bank"]),
  }), [available]);
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { amount: Math.floor(available), method: "upi" } });
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = form;
  const [confirm, setConfirm] = useState<Values | null>(null);
  const method = watch("method");

  useEffect(() => { if (open) reset({ amount: Math.floor(available), method: "upi" }); }, [open, available, reset]);

  const handle = (first: string) => first.toLowerCase().replace(/[^a-z]/g, "").slice(0, 6) || "advocate";
  const METHODS: { id: Method; label: string; detail: string; icon: typeof Smartphone }[] = [
    { id: "upi", label: "UPI", detail: `${handle(payeeName)}••@okdemo`, icon: Smartphone },
    { id: "bank", label: "Bank transfer", detail: "Demo Bank · A/C ••••4821 · IFSC DEMO0001234", icon: Landmark },
  ];

  return (
    <>
      <Dialog open={open && !confirm} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request payout</DialogTitle>
            <DialogDescription>Withdraw approved rewards to your registered payout method. Available: <span className="font-medium text-foreground num">{formatCurrency(available)}</span></DialogDescription>
          </DialogHeader>
          <form id="payout-form" className="space-y-4" onSubmit={handleSubmit((v) => setConfirm(v))} noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="payout-amount">Amount (₹)</Label>
              <div className="flex gap-2">
                <Input id="payout-amount" type="number" inputMode="numeric" min={MIN_PAYOUT} max={available} step={1} aria-invalid={!!errors.amount} {...register("amount")} />
                <Button type="button" variant="outline" onClick={() => setValue("amount", Math.floor(available), { shouldValidate: true })}>Max</Button>
              </div>
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : <p className="text-xs text-muted-foreground">Minimum {formatCurrency(MIN_PAYOUT)} · maximum {formatCurrency(available)}</p>}
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-medium">Payout method</legend>
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <label key={m.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors", active ? "border-action bg-action-soft/40 ring-1 ring-action/30" : "hover:bg-muted/40")}>
                    <input type="radio" value={m.id} className="sr-only" {...register("method")} />
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", active ? "bg-action text-white" : "bg-muted text-muted-foreground")}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{m.label}</span><span className="block truncate font-mono text-xs text-muted-foreground">{m.detail}</span></span>
                    <span className={cn("h-4 w-4 rounded-full border-2", active ? "border-action bg-action shadow-[inset_0_0_0_2px_hsl(var(--card))]" : "border-input")} aria-hidden />
                  </label>
                );
              })}
            </fieldset>
            <DemoNotice>Simulated payout. Payment details are fictional and no real money is transferred.</DemoNotice>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="payout-form">Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title="Confirm payout request"
        confirmLabel={confirm ? `Request ${formatCurrency(confirm.amount)}` : "Request payout"}
        description={confirm && (
          <div className="space-y-2">
            <p>You're requesting <span className="font-semibold text-foreground">{formatCurrency(confirm.amount)}</span> via {confirm.method === "upi" ? "UPI" : "bank transfer"}.</p>
            <p>The amount moves to "In payout" until an admin approves it. Your available balance after this request: <span className="font-medium text-foreground num">{formatCurrency(available - confirm.amount)}</span>.</p>
            <p className="text-xs">Simulated demo action — no real money is transferred.</p>
          </div>
        )}
        onConfirm={async () => {
          if (!confirm) return;
          await api.rewards.requestPayout(advocateId, confirm.amount);
          toast.success("Payout requested", { description: `${formatCurrency(confirm.amount)} is awaiting admin approval (simulated).` });
          setConfirm(null);
          onOpenChange(false);
        }}
      />
    </>
  );
}
