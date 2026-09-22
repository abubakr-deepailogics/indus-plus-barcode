"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ResetPasswordResultDialog({
  temporaryPassword,
  onClose,
}: {
  temporaryPassword: string | null;
  onClose: () => void;
}) {
  return (
    // Remount (via key) instead of an effect so `copied` resets whenever a
    // new temporary password is shown, without setState-in-effect.
    <ResetPasswordResultDialogInner
      key={temporaryPassword}
      temporaryPassword={temporaryPassword}
      onClose={onClose}
    />
  );
}

function ResetPasswordResultDialogInner({
  temporaryPassword,
  onClose,
}: {
  temporaryPassword: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      // ponytail: clipboard permission/HTTP-context failure has no fallback UI, add a manual-select hint if it comes up.
    }
  }

  return (
    <Dialog open={!!temporaryPassword} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password reset</DialogTitle>
          <DialogDescription>
            Share this temporary password with the user. They will be required
            to change it on their next sign-in. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <p className="flex-1 rounded-md bg-muted p-3 text-center font-mono text-sm select-all">
            {temporaryPassword}
          </p>
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy password">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
