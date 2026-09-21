"use client";

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
    <Dialog open={!!temporaryPassword} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password reset</DialogTitle>
          <DialogDescription>
            Share this temporary password with the user. They will be required
            to change it on their next sign-in. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md bg-muted p-3 text-center font-mono text-sm select-all">
          {temporaryPassword}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
