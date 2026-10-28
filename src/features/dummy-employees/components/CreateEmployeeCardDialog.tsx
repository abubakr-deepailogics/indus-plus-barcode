"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  BadgePlus,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  ScanLine,
  UserRound,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ErpOperation } from "../types";

export function CreateEmployeeCardDialog({
  createdBy,
  onCreated,
}: {
  createdBy: string;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [operationCode, setOperationCode] = useState("");
  const [operationQuery, setOperationQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  function reset() {
    setEmployeeName("");
    setDepartment("");
    setDepartmentOpen(false);
    setOperationCode("");
    setOperationQuery("");
    setError("");
    setCreatedCode("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!employeeName.trim() || !department.trim() || !operationCode) {
      setError("Complete all three fields to issue this employee card.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/dummy-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName,
          department,
          operationCode,
          createdBy,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not issue employee card.");
      setCreatedCode(data.employeeCode);
      onCreated?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not issue employee card.",
      );
    } finally {
      setSaving(false);
    }
  }

  const fetchOperationSuggestions = useCallback(
    async (query: string) => {
      if (!department) return [];
      const response = await fetch(
        `/api/dummy-employees/operations?department=${encodeURIComponent(department)}&query=${encodeURIComponent(query)}`,
      );
      if (!response.ok) return [];
      return response.json() as Promise<ErpOperation[]>;
    },
    [department],
  );

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
            <BadgePlus className="size-4" />
            Employee card
          </Button>
        }
      />
      <DialogContent
        data-client-brand
        className="max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[560px]"
        showCloseButton={!saving}
      >
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-7">
          <DialogHeader className="flex-row items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <ScanLine className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                Production traceability
              </p>
              <DialogTitle className="mt-1 text-lg font-semibold text-slate-950">
                Issue employee card
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500">
                Create a PIT-only identity for tracing work without creating
                payable production.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>
        {createdCode ? (
          <div className="px-6 py-6 sm:px-7">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Employee card issued
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    Use this code in Coupon Scanning. It can only scan the
                    assigned ERP operation.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3.5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Employee code
                </span>
                <code className="font-mono text-sm font-bold tracking-wider text-slate-900">
                  {createdCode}
                </code>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="block text-slate-500">
                  Restricted operation
                </span>
                <span className="mt-1 block font-semibold text-slate-800">
                  {operationCode}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="block text-slate-500">
                  Rates and incentives
                </span>
                <span className="mt-1 block font-semibold text-slate-800">
                  Always Rs. 0.00
                </span>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                className="h-9 rounded-lg bg-indigo-700 px-4 text-xs font-semibold hover:bg-indigo-800"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 px-6 py-5 sm:px-7"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="dummy-name"
                  className="text-xs font-semibold text-slate-700"
                >
                  Employee name
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="dummy-name"
                    autoFocus
                    required
                    value={employeeName}
                    maxLength={150}
                    onChange={(event) => setEmployeeName(event.target.value)}
                    placeholder="e.g. Line 4 test card"
                    className="h-10 rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-indigo-100"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Department
                </Label>
                <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3 text-left text-sm outline-none transition-colors hover:border-slate-300 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100"
                      />
                    }
                  >
                    <Building2 className="mr-3 size-4 shrink-0 text-slate-400" />
                    <span
                      className={
                        department
                          ? "flex-1 text-slate-800"
                          : "flex-1 text-slate-400"
                      }
                    >
                      {department || "Select department"}
                    </span>
                    <ChevronDown className="size-4 text-slate-400" />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--anchor-width)] gap-1 border border-slate-200 bg-white p-1.5 shadow-xl"
                  >
                    {["Sewing", "Washing", "Finishing"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setDepartment(option);
                          setOperationCode("");
                          setOperationQuery("");
                          setDepartmentOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-800"
                      >
                        <span
                          className={`flex size-7 items-center justify-center rounded-md ${option === "Sewing" ? "bg-indigo-50 text-indigo-700" : option === "Washing" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          <Building2 className="size-3.5" />
                        </span>
                        <span className="flex-1">{option}</span>
                        {department === option && (
                          <Check className="size-4 text-indigo-700" />
                        )}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold text-slate-700">
                Assigned ERP operation
              </Label>
              <div className="relative">
                <Workflow className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
                <Autocomplete<ErpOperation>
                  value={operationQuery}
                  onChange={(value) => {
                    setOperationQuery(value);
                    setOperationCode("");
                  }}
                  onSelect={(operation) => {
                    setOperationCode(operation.operationCode);
                    setOperationQuery(
                      `${operation.operationCode} — ${operation.operationName || "Unnamed operation"}`,
                    );
                  }}
                  fetchSuggestions={fetchOperationSuggestions}
                  renderSuggestion={(operation) => (
                    <>
                      <span className="font-semibold text-indigo-700">
                        {operation.operationCode}
                      </span>
                      <span className="ml-2 truncate text-slate-600">
                        {operation.operationName || "Unnamed operation"}
                      </span>
                    </>
                  )}
                  getSuggestionValue={(operation) => operation.operationCode}
                  placeholder={
                    department
                      ? "Search operation code or name"
                      : "Select a department first"
                  }
                  inputClassName="h-10 w-full rounded-lg border border-slate-200 bg-white py-1 pr-3 pl-10 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  dropdownClassName="max-h-56 rounded-lg"
                  minChars={0}
                  disabled={!department}
                />
              </div>
            </div>
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
                disabled={saving}
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border-slate-200 bg-white px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 gap-2 rounded-lg bg-indigo-700 px-4 text-xs font-semibold text-white hover:bg-indigo-800"
              >
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {saving ? "Issuing…" : "Issue employee card"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
