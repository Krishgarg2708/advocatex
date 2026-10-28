import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Confirmation dialog that guards against double submission while the action runs. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", variant = "default", onConfirm, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; confirmLabel?: string;
  variant?: ButtonProps["variant"]; onConfirm: () => Promise<unknown> | unknown; children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant={variant} disabled={busy} onClick={async () => {
            if (busy) return;
            setBusy(true);
            try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); }
          }}>
            {busy && <Loader2 className="animate-spin" />}{confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
