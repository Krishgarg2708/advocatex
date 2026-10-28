import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductImage } from "@/components/shared/ProductImage";
import { BRANDS } from "@/data/catalog";
import { api } from "@/services/api";
import type { Product, ProductCategory } from "@/types";

export const PRODUCT_CATEGORIES: ProductCategory[] = ["Engine Oil", "Tyres", "Batteries", "Brakes", "Filters", "Lighting", "Coolants", "Accessories"];

const schema = z.object({
  name: z.string().trim().min(3, "Enter a product name (at least 3 characters)").max(80, "Keep the name under 80 characters"),
  brandId: z.string().min(1, "Choose a brand"),
  category: z.enum(["Engine Oil", "Tyres", "Batteries", "Brakes", "Filters", "Lighting", "Coolants", "Accessories"]),
  sku: z.string().trim().min(3, "Enter a SKU").max(24, "SKU is too long").regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  description: z.string().trim().min(10, "Add a short description (at least 10 characters)").max(400, "Keep it under 400 characters"),
  price: z.coerce.number({ invalid_type_error: "Enter a price" }).positive("Price must be greater than ₹0"),
  referralReward: z.coerce.number({ invalid_type_error: "Enter a reward" }).min(0, "Reward cannot be negative"),
  loyaltyPoints: z.coerce.number({ invalid_type_error: "Enter points" }).int("Use whole points").min(0, "Points cannot be negative"),
  loyaltyOffer: z.string().trim().max(120, "Keep the offer under 120 characters"),
  status: z.enum(["active", "draft", "discontinued"]),
}).refine((v) => v.referralReward <= v.price, { path: ["referralReward"], message: "Reward cannot exceed the product price" });

type FormValues = z.infer<typeof schema>;

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Create / edit product. Brand managers are locked to their own brand. */
export function ProductFormDialog({ open, onOpenChange, product, lockedBrandId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; lockedBrandId?: string; onSaved?: (id: string) => void;
}) {
  const defaults = (): FormValues => product ? {
    name: product.name, brandId: product.brandId, category: product.category, sku: product.sku, description: product.description, price: product.price,
    referralReward: product.referralReward, loyaltyPoints: product.loyaltyPoints, loyaltyOffer: product.loyaltyOffer, status: product.status,
  } : { name: "", brandId: lockedBrandId ?? "", category: "Engine Oil", sku: "", description: "", price: 0, referralReward: 0, loyaltyPoints: 0, loyaltyOffer: "", status: "draft" };

  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) reset(defaults()); }, [open, product?.id]);

  const name = watch("name"), category = watch("category"), price = Number(watch("price")) || 0, reward = Number(watch("referralReward")) || 0;

  const onSubmit = async (v: FormValues) => {
    const input = { ...v, brandId: lockedBrandId ?? v.brandId, loyaltyOffer: v.loyaltyOffer || "No active offer", sku: v.sku.toUpperCase() };
    if (product) {
      await api.products.update(product.id, input);
      toast.success("Product updated", { description: input.name });
      onSaved?.(product.id);
    } else {
      const id = await api.products.create(input);
      toast.success("Product added to the catalogue", { description: input.status === "active" ? "It's now visible to advocates and customers." : "Saved as draft — only admins and your brand can see it." });
      onSaved?.(id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>Catalogue details shown to advocates and customers. Campaigns can set their own per-conversion reward on top of the standard reward.</DialogDescription>
        </DialogHeader>
        <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-[140px,1fr]" noValidate>
          <div className="hidden sm:block">
            <ProductImage category={category} name={name || "New product"} className="h-[140px] rounded-lg border" />
            <p className="mt-2 text-[11px] text-muted-foreground">Illustration is generated from the category and name.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="p-name" label="Product name" error={errors.name?.message}>
                <Input id="p-name" {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Veltrix Synth 0W-20 (3.5L)" />
              </Field>
            </div>
            <Field id="p-brand" label="Brand" error={errors.brandId?.message} hint={lockedBrandId ? "Fixed to your brand" : undefined}>
              <Controller control={control} name="brandId" render={({ field }) => (
                <Select value={lockedBrandId ?? field.value} onValueChange={field.onChange} disabled={!!lockedBrandId}>
                  <SelectTrigger id="p-brand" aria-invalid={!!errors.brandId}><SelectValue placeholder="Choose a brand" /></SelectTrigger>
                  <SelectContent>{BRANDS.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="p-cat" label="Category" error={errors.category?.message}>
              <Controller control={control} name="category" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="p-sku" label="SKU" error={errors.sku?.message}>
              <Input id="p-sku" {...register("sku")} aria-invalid={!!errors.sku} placeholder="VLX-SYN-020" className="font-mono uppercase" />
            </Field>
            <Field id="p-status" label="Status">
              <Controller control={control} name="status" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="p-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active — visible to everyone</SelectItem>
                    <SelectItem value="draft">Draft — internal only</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="p-desc" label="Description" error={errors.description?.message}>
                <Textarea id="p-desc" rows={3} {...register("description")} aria-invalid={!!errors.description} placeholder="What it is, who it's for and the key benefit." />
              </Field>
            </div>
            <Field id="p-price" label="Indicative price (₹)" error={errors.price?.message}>
              <Input id="p-price" type="number" inputMode="decimal" min={0} step="1" {...register("price")} aria-invalid={!!errors.price} />
            </Field>
            <Field id="p-reward" label="Standard referral reward (₹)" error={errors.referralReward?.message} hint={price > 0 ? `${((reward / price) * 100).toFixed(1)}% of price` : undefined}>
              <Input id="p-reward" type="number" inputMode="decimal" min={0} step="1" {...register("referralReward")} aria-invalid={!!errors.referralReward} />
            </Field>
            <Field id="p-points" label="Customer loyalty points" error={errors.loyaltyPoints?.message}>
              <Input id="p-points" type="number" inputMode="numeric" min={0} step="1" {...register("loyaltyPoints")} aria-invalid={!!errors.loyaltyPoints} />
            </Field>
            <Field id="p-offer" label="Loyalty offer" error={errors.loyaltyOffer?.message}>
              <Input id="p-offer" {...register("loyaltyOffer")} aria-invalid={!!errors.loyaltyOffer} placeholder="e.g. Free oil-filter check" />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="product-form" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{product ? "Save changes" : "Add product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
