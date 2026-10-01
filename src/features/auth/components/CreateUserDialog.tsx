"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRoundPlus,
  UserRound,
  WandSparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CreateUserInput } from "@/features/auth/types";

// Browser-safe password generator (Node's `crypto` module used by
// @/lib/password's version isn't available client-side).
function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  const randomIndex = (max: number) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  };
  const pick = (chars: string) => chars[randomIndex(chars.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 8 }, () => pick(all));

  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

export function CreateUserDialog({
  onCreate,
}: {
  onCreate: (input: CreateUserInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setEmail("");
    setDisplayName("");
    setPassword("");
    setIsAdmin(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({ email, displayName, password, isAdmin });
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button className="h-10 gap-2 rounded-lg bg-indigo-700 px-4 text-white shadow-sm hover:bg-indigo-800">
            <UserRoundPlus className="size-4" />
            New user
          </Button>
        }
      />
      <DialogContent data-client-brand className="max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[520px]">
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-7">
          <DialogHeader className="flex-row items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <UserRoundPlus className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                Account provisioning
              </p>
              <DialogTitle className="mt-1 text-lg font-semibold text-slate-950">
                Create user
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500">
                Add a person to the directory and set their initial access.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 px-6 py-5 sm:px-7"
        >
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-email"
              className="text-xs font-semibold text-slate-700"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="new-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-lg border-slate-200 bg-white pl-10 text-sm focus-visible:border-indigo-400 focus-visible:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-displayName"
              className="text-xs font-semibold text-slate-700"
            >
              Display name
            </Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="new-displayName"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 rounded-lg border-slate-200 bg-white pl-10 text-sm focus-visible:border-indigo-400 focus-visible:ring-indigo-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="new-password"
              className="text-xs font-semibold text-slate-700"
            >
              Initial password
            </Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="new-password"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 rounded-lg border-slate-200 bg-white pl-10 text-sm focus-visible:border-indigo-400 focus-visible:ring-indigo-100"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 gap-2 rounded-lg border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                onClick={() => setPassword(generateStrongPassword())}
              >
                <WandSparkles className="size-3.5" />
                Generate
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <RefreshCw className="size-3 shrink-0" />
              At least 8 characters, with upper and lower case letters and a
              number.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/50">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-indigo-600"
            />
            <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  Administrator access
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                  Grants full access to every area and action.
                </span>
              </span>
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" />
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-800"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <DialogFooter className="-mx-6 -mb-5 rounded-none border-t border-slate-200 bg-slate-50 px-6 py-4 sm:-mx-7 sm:flex-row sm:px-7">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border-slate-200 bg-white px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-9 gap-2 rounded-lg bg-indigo-700 px-4 text-xs font-semibold text-white hover:bg-indigo-800"
            >
              {submitting ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
