"use client";

import { useState, useMemo, useRef } from "react";
import { Calendar as CalendarIcon, Cpu } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { Worker, OperationSuggestion } from "../types";
import type { useCouponScanning } from "../hooks/useCouponScanning";

type Facade = ReturnType<typeof useCouponScanning>;

function parseDateString(str: string): Date | null {
  const trimmed = str.trim();
  const regex = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
  const match = trimmed.match(regex);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed month
  const year = parseInt(match[3], 10);

  const date = new Date(year, month, day);
  if (
    date.getDate() === day &&
    date.getMonth() === month &&
    date.getFullYear() === year
  ) {
    return date;
  }
  return null;
}

function isValidSelectedDate(date: Date): boolean {
  if (date.getDay() === 0) return false; // Sunday
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const comp = new Date(date);
  comp.setHours(0, 0, 0, 0);
  if (comp > today) return false; // Future
  
  return true;
}

export function InformationPanel(props: Facade) {
  const {
    employeeCode,
    setEmployeeCode,
    employeeName,
    department,
    designation,
    dated,
    setDated,
    shift,
    setShift,
    section,
    isEmployeePresent,
    checkingAttendance,
    verifyAttendance,
    lineId,
    setLineId,
    scanBy,
    alreadyDailyScan,
    alreadyMonthlyScan,
    scanCouponCode,
    setScanCouponCode,
    workOrder,
    setWorkOrder,
    fromCut,
    setFromCut,
    toCut,
    setToCut,
    bundleNo,
    setBundleNo,
    opNo,
    setOpNo,
    isScanning,
    fetchWorkerSuggestions,
    fetchWorkOrderSuggestions,
    fetchBundleSuggestions,
    fetchCutSuggestions,
    fetchOpSuggestions,
    handleSelectWorker,
    handleEmployeeCodeKeyDown,
    handleFetchAndScan,
    clearForm,
  } = props;

  const [prevDated, setPrevDated] = useState(dated);
  const [typedValue, setTypedValue] = useState<string | null>(null);

  if (dated !== prevDated) {
    setPrevDated(dated);
    let matches = false;
    if (typedValue !== null) {
      const parsed = parseDateString(typedValue);
      const parsedIso = parsed ? format(parsed, "yyyy-MM-dd") : "";
      if (parsedIso === dated) {
        matches = true;
      }
    }
    if (!matches) {
      setTypedValue(null);
    }
  }

  const displayValue = typedValue !== null
    ? typedValue
    : (dated ? format(new Date(dated), "dd-MM-yyyy") : "");

  // Dated is gated on Employee Code — same "disabled until the field
  // before it is filled" convention as From Cut/To Cut/Bundle No/Operation
  // No below (those gate on Work Order). Part of the sequential
  // Employee Code -> Dated -> Coupon Scanning flow (the scanning field
  // itself is gated on both, in ScanningDetailsTable).
  const isEmployeeCodeFilled = !!employeeCode.trim();

  // Hands off focus to the scanner field (a sibling component, hence the
  // plain DOM lookup by id rather than a shared ref) once Dated is
  // *committed* — on blur or an explicit calendar pick, never from the
  // onChange above. Committing on every keystroke there (instead of just
  // on a final valid value) is what previously stole focus out from under
  // the user mid-type, the instant a partial date happened to parse valid.
  // Attendance is verified right here too — this is the one moment the
  // Employee Code -> Dated -> Coupon Scanning chain completes, so it's the
  // natural place to check and, if the employee is present, move on;
  // verifyAttendance itself raises the blocking error if they're not.
  const focusScannerIfReady = async () => {
    if (!isEmployeeCodeFilled || !dated) return;
    const present = await verifyAttendance();
    if (present) {
      document.getElementById("scanner-input")?.focus();
    }
  };

  const isInvalid = useMemo(() => {
    if (!displayValue.trim()) return false;
    const parsed = parseDateString(displayValue);
    if (!parsed) return true;
    return !isValidSelectedDate(parsed);
  }, [displayValue]);

  // Closes the calendar popover imperatively once a date is picked — left
  // uncontrolled otherwise (no `open`/`onOpenChange`) since only this one
  // moment needs to force it shut. Shape must match Base UI's
  // PopoverRootActions exactly (RefObject is invariant), even though only
  // `close` is ever called here.
  const datePopoverActionsRef = useRef<{
    close: () => void;
    unmount: () => void;
  } | null>(null);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
      <div className="xl:col-span-12 bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 mb-2.5 border-b border-slate-100 pb-1.5">
          <Cpu className="w-4 h-4 text-[#4f46e5]" />
          <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
            Information
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Employee Code */}
            <div className="flex flex-col gap-0.5 relative">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Employee Code <span className="text-red-500">*</span>
              </span>
              <Autocomplete<Worker>
                value={employeeCode}
                onChange={setEmployeeCode}
                onSelect={handleSelectWorker}
                fetchSuggestions={fetchWorkerSuggestions}
                renderSuggestion={(worker) => (
                  <>
                    <div>
                      <span className="text-[#4f46e5] font-bold mr-2">
                        {worker.EmployeeID}
                      </span>
                      <span>{worker.FirstName?.trim()}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                      {worker.ParentDepartment || "Worker"}
                    </span>
                  </>
                )}
                getSuggestionValue={(worker) => String(worker.EmployeeID)}
                placeholder="Enter Employee Code"
                inputClassName="w-full px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                onKeyDown={handleEmployeeCodeKeyDown}
                minChars={1}
              />
            </div>

            {/* Employee Name */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Employee Name
              </span>
              <input
                type="text"
                placeholder="Enter employee name"
                value={employeeName}
                readOnly
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-not-allowed"
              />
            </label>

            {/* Department */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Department
              </span>
              <input
                type="text"
                placeholder="Department Name"
                value={department}
                readOnly
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-not-allowed"
              />
            </label>

            {/* Designation */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Designation
              </span>
              <input
                type="text"
                placeholder="Enter designation"
                value={designation}
                readOnly
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-not-allowed"
              />
            </label>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Dated */}
            <div className="flex flex-col gap-0.5">
              <span
                className={`font-bold text-[10px] uppercase transition-colors ${!isEmployeeCodeFilled ? "text-slate-400" : "text-[#475569]"}`}
              >
                Dated
              </span>
              <div className="relative flex items-center w-full">
                <input
                  type="text"
                  placeholder={isEmployeeCodeFilled ? "DD-MM-YYYY" : "Enter Employee Code first"}
                  value={displayValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTypedValue(val);
                    if (!val.trim()) {
                      setDated("");
                      return;
                    }
                    const parsed = parseDateString(val);
                    if (parsed && isValidSelectedDate(parsed)) {
                      setDated(format(parsed, "yyyy-MM-dd"));
                    } else {
                      setDated("");
                    }
                  }}
                  onBlur={focusScannerIfReady}
                  aria-invalid={isInvalid}
                  disabled={!isEmployeeCodeFilled}
                  className={`w-full pl-3 pr-8 py-1 rounded-lg border text-xs font-semibold placeholder-slate-400 focus:outline-none aria-invalid:border-red-500 aria-invalid:ring-red-500/10 transition-all h-[26px] ${
                    !isEmployeeCodeFilled
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      : "bg-white text-slate-800 border-[#e2e8f0] focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                  }`}
                />
                <Popover actionsRef={datePopoverActionsRef}>
                  <PopoverTrigger
                    disabled={!isEmployeeCodeFilled}
                    className="absolute right-2 p-1 hover:bg-slate-100 rounded-md cursor-pointer flex items-center justify-center disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <CalendarIcon
                      className={`w-3.5 h-3.5 ${!isEmployeeCodeFilled ? "text-slate-300" : "text-slate-400"}`}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={dated ? new Date(dated) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const iso = format(date, "yyyy-MM-dd");
                          setDated(iso);
                          setTypedValue(null);
                          // Picking a date is "done" — close the calendar
                          // immediately rather than leaving it open.
                          datePopoverActionsRef.current?.close();
                          // An explicit pick, not a keystroke — safe to verify
                          // and hand off focus right away (isEmployeeCodeFilled
                          // is already guaranteed true, since the trigger that
                          // opens this calendar is disabled otherwise). `iso`
                          // is passed explicitly rather than relying on the
                          // `dated` state, which won't reflect setDated above
                          // until the next render.
                          void verifyAttendance(iso).then((present) => {
                            if (present) {
                              document.getElementById("scanner-input")?.focus();
                            }
                          });
                        } else {
                          setDated("");
                          setTypedValue(null);
                        }
                      }}
                      disabled={(date) => {
                        if (date.getDay() === 0) return true;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const comp = new Date(date);
                        comp.setHours(0, 0, 0, 0);
                        return comp > today;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {checkingAttendance && (
                <span className="text-[10px] font-semibold text-slate-400">
                  Checking attendance…
                </span>
              )}
              {!checkingAttendance && isEmployeePresent === false && (
                <span className="text-[10px] font-bold text-red-600">
                  Not present on this date
                </span>
              )}
            </div>

            {/* Shift */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Shift
              </span>
              <input
                type="text"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              />
            </label>

            {/* Section */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Section
              </span>
              <input
                type="text"
                placeholder="Section Name"
                value={section}
                readOnly
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-not-allowed"
              />
            </label>

            {/* Line I.D */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Line I.D
              </span>
              <input
                type="text"
                placeholder="Enter line id"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              />
            </label>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Scan By */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Scan By <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                placeholder="Enter scanner"
                value={scanBy}
                readOnly
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-not-allowed"
              />
            </label>

            {/* Already Daily Scan */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Already Daily Scan
              </span>
              <input
                type="text"
                readOnly
                placeholder="Enter daily scan"
                value={alreadyDailyScan}
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-default"
              />
            </label>

            {/* Already Monthly Scan */}
            <label className="flex flex-col gap-0.5">
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Already Monthly Scan
              </span>
              <input
                type="text"
                readOnly
                placeholder="Enter monthly scan"
                value={alreadyMonthlyScan}
                className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-default"
              />
            </label>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Coupon Code */}
            <div className="flex flex-col gap-0.5 md:col-span-2">
              <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
                Coupon Code
              </span>
              <input
                type="text"
                placeholder="Scan or enter Coupon Code"
                value={scanCouponCode}
                onChange={(e) => setScanCouponCode(e.target.value)}
                className="w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              />
            </div>

            {/* Work Order */}
            <div className="flex flex-col gap-0.5 relative md:col-span-2">
              <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
                Work Order{" "}
                {!scanCouponCode.trim() && (
                  <span className="text-red-500">*</span>
                )}
              </span>
              <Autocomplete<string>
                value={workOrder}
                onChange={setWorkOrder}
                onSelect={(wo) => {
                  setWorkOrder(wo);
                  setFromCut("");
                  setToCut("");
                  setBundleNo("");
                  setOpNo("");
                }}
                fetchSuggestions={fetchWorkOrderSuggestions}
                renderSuggestion={(item) => <span>{item}</span>}
                getSuggestionValue={(item) => item}
                placeholder="Enter W/O"
                inputClassName="w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              />
            </div>

            {/* From Cut & To Cut (grouped side-by-side in one md-col-span-2 slot) */}
            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <div className="flex flex-col gap-0.5 relative">
                <span
                  className={`font-bold text-[10px] uppercase transition-colors ${!workOrder.trim() ? "text-slate-400" : "text-[#4f46e5]"}`}
                >
                  From Cut
                </span>
                <Autocomplete<string>
                  value={fromCut}
                  onChange={setFromCut}
                  onSelect={setFromCut}
                  fetchSuggestions={fetchCutSuggestions}
                  renderSuggestion={(item) => <span>{item}</span>}
                  getSuggestionValue={(item) => item}
                  minChars={0}
                  disabled={!workOrder.trim()}
                  placeholder="e.g. 1"
                  inputClassName={`w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold focus:outline-none transition-all ${
                    !workOrder.trim()
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      : "bg-white text-slate-800 focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                  }`}
                />
              </div>

              <div className="flex flex-col gap-0.5 relative">
                <span
                  className={`font-bold text-[10px] uppercase transition-colors ${!workOrder.trim() ? "text-slate-400" : "text-[#4f46e5]"}`}
                >
                  To Cut
                </span>
                <Autocomplete<string>
                  value={toCut}
                  onChange={setToCut}
                  onSelect={setToCut}
                  fetchSuggestions={fetchCutSuggestions}
                  renderSuggestion={(item) => <span>{item}</span>}
                  getSuggestionValue={(item) => item}
                  minChars={0}
                  disabled={!workOrder.trim()}
                  placeholder="e.g. 10"
                  inputClassName={`w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold focus:outline-none transition-all ${
                    !workOrder.trim()
                      ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      : "bg-white text-slate-800 focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                  }`}
                />
              </div>
            </div>

            {/* Bundle No */}
            <div className="flex flex-col gap-0.5 relative md:col-span-2">
              <span
                className={`font-bold text-[10px] uppercase transition-colors ${!workOrder.trim() ? "text-slate-400" : "text-[#4f46e5]"}`}
              >
                Bundle No
              </span>
              <Autocomplete<string>
                value={bundleNo}
                onChange={setBundleNo}
                onSelect={setBundleNo}
                fetchSuggestions={fetchBundleSuggestions}
                disabled={!workOrder.trim()}
                renderSuggestion={(item) => <span>{item}</span>}
                getSuggestionValue={(item) => item}
                minChars={0}
                placeholder="e.g. 33550001"
                inputClassName={`w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold focus:outline-none transition-all ${
                  !workOrder.trim()
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                    : "bg-white text-slate-800 focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                }`}
              />
            </div>

            {/* Operation No */}
            <div className="flex flex-col gap-0.5 relative md:col-span-2">
              <span
                className={`font-bold text-[10px] uppercase transition-colors ${!workOrder.trim() ? "text-slate-400" : "text-[#4f46e5]"}`}
              >
                Operation No
              </span>
              <Autocomplete<OperationSuggestion>
                value={opNo}
                onChange={setOpNo}
                onSelect={(op) => setOpNo(op.Operation_Code)}
                fetchSuggestions={fetchOpSuggestions}
                disabled={!workOrder.trim()}
                renderSuggestion={(op) => (
                  <div className="flex flex-col">
                    <span className="text-[#4f46e5] font-bold text-[10px]">
                      {op.Operation_Code}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {op.Operation_Name}
                    </span>
                  </div>
                )}
                getSuggestionValue={(op) => op.Operation_Code}
                placeholder="e.g. SW0000090"
                inputClassName={`w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold focus:outline-none transition-all ${
                  !workOrder.trim()
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                    : "bg-white text-slate-800 focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                }`}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col justify-end md:col-span-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleFetchAndScan()}
                  disabled={isScanning}
                  className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-1 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer hover:shadow-md active:scale-[0.98] border border-transparent h-[26px] whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>🔍 Scan</span>
                </button>
                <button
                  type="button"
                  onClick={clearForm}
                  className="flex-1 bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 font-bold py-1 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer hover:shadow-md active:scale-[0.98] h-[26px] whitespace-nowrap"
                  title="Clear all fields and tables (Ctrl+N or Cmd+N)"
                >
                  <span>➕ New</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
