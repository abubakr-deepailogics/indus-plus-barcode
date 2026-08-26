"use client";

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
    lineId,
    setLineId,
    scanBy,
    alreadyDailyScan,
    alreadyMonthlyScan,
    aniNo,
    setAniNo,
    sortOrder,
    setSortOrder,
    scanCouponCode,
    setScanCouponCode,
    workOrder,
    setWorkOrder,
    setFromCut,
    setToCut,
    fromCut,
    toCut,
    opNo,
    setOpNo,
    isScanning,
    fetchWorkerSuggestions,
    fetchWorkOrderSuggestions,
    fetchCutSuggestions,
    fetchOpSuggestions,
    handleSelectWorker,
    handleEmployeeCodeKeyDown,
    handleFetchInfo,
    clearForm,
  } = props;

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
              <span className="font-bold text-[#475569] text-[10px] uppercase">
                Dated
              </span>
              <Popover>
                <PopoverTrigger className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white w-full text-left flex items-center justify-between cursor-pointer h-[26px]">
                  <span>
                    {dated
                      ? format(new Date(dated), "yyyy-MM-dd")
                      : "Select date"}
                  </span>
                  <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={dated ? new Date(dated) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setDated(format(date, "yyyy-MM-dd"));
                      } else {
                        setDated("");
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

            {/* Ani No. & Sort Order (combined in one column slot) */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Ani No.
                </span>
                <input
                  type="text"
                  placeholder="Enter ANI no."
                  value={aniNo}
                  onChange={(e) => setAniNo(e.target.value)}
                  className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white w-full"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Sort Order
                </span>
                <input
                  type="text"
                  placeholder="Enter sort order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white w-full"
                />
              </label>
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Coupon Code */}
            <div className="flex flex-col gap-0.5 md:col-span-3">
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
                  setOpNo("");
                }}
                fetchSuggestions={fetchWorkOrderSuggestions}
                renderSuggestion={(item) => <span>{item}</span>}
                getSuggestionValue={(item) => item}
                placeholder="Enter W/O"
                inputClassName="w-full px-3 py-1 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              />
            </div>

            {/* From Cut & To Cut (grouped side-by-side in one md-col-span-3 slot) */}
            <div className="grid grid-cols-2 gap-2 md:col-span-3">
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
                  onClick={() => handleFetchInfo()}
                  disabled={isScanning}
                  className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-1 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer hover:shadow-md active:scale-[0.98] border border-transparent h-[26px] whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>📋 Fetch Info</span>
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
