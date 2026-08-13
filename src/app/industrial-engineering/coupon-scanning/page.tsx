"use client";

import React, { useState, useEffect, useRef } from "react";
import { Calendar, FileText, TrendingUp, Cpu } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";

interface ScanningRow {
  index: number;
  barCode: string;
  anlCode: string;
  cutNo: string;
  category: string; // [A,B,C]
  bundleNo: string;
  qty: string;
  inseam: string;
  sizeCode: string;
  sectionCode: string;
  sectionName: string;
  oprCode: string;
  operationName: string;
  skillCode: string;
  smv: string;
  rate: string;
  value: string;
}

export default function CouponScanningPage() {
  // Information panel state variables
  const [employeeCode, setEmployeeCode] = useState("");
  const [department, setDepartment] = useState("");

  const [designation, setDesignation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [alreadyDailyScan, setAlreadyDailyScan] = useState("");
  const [alreadyMonthlyScan, setAlreadyMonthlyScan] = useState("");
  const [lineId, setLineId] = useState("");
  const [scanBy, setScanBy] = useState("");
  const [dated, setDated] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [section, setSection] = useState("");
  const [shift, setShift] = useState("");
  const [aniNo, setAniNo] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  // Coupon verification headers state
  const [workOrder, setWorkOrder] = useState("");
  const [bundleNo, setBundleNo] = useState("");
  const [opNo, setOpNo] = useState("");
  const [scanCouponCode, setScanCouponCode] = useState("");
  const [scanError, setScanError] = useState("");

  // Scanning state and modals
  const [isScanning, setIsScanning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchWorkerSuggestions = async (query: string) => {
    try {
      const response = await fetch(
        `/api/workers?query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Worker suggestions fetch error:", err);
    }
    return [];
  };

  const fetchWorkOrderSuggestions = async (query: string) => {
    try {
      const response = await fetch(
        `/api/open-order/suggestions?query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("WO suggestions fetch error:", err);
    }
    return [];
  };

  const fetchBundleSuggestions = async (query: string) => {
    if (!workOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=bundle&query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Bundle suggestions fetch error:", err);
    }
    return [];
  };

  const fetchOpSuggestions = async (query: string) => {
    if (!workOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=operation&query=${encodeURIComponent(query)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Op suggestions fetch error:", err);
    }
    return [];
  };

  const handleScanCoupon = () => {
    setScanError("");

    if (!employeeCode.trim()) {
      setScanError("Please enter or select an Employee Code first!");
      setErrorMessage("Please enter or select an Employee Code first!");
      setShowErrorModal(true);
      return;
    }

    if (!scanBy.trim()) {
      setScanError("Please enter Scanner Name in Scan By first!");
      setErrorMessage("Please enter Scanner Name in Scan By first!");
      setShowErrorModal(true);
      return;
    }

    if (!scanCouponCode.trim() && !workOrder) {
      setScanError("Please select a Work Order or enter a Coupon Code first!");
      setErrorMessage(
        "Please select a Work Order or enter a Coupon Code first!",
      );
      setShowErrorModal(true);
      return;
    }

    setShowConfirmModal(true);
  };

  const executeScanCoupon = async () => {
    setShowConfirmModal(false);
    setIsScanning(true);
    setScanError("");

    try {
      const url = scanCouponCode.trim()
        ? `/api/coupons/scan?barcode=${encodeURIComponent(scanCouponCode.trim())}&employeeCode=${encodeURIComponent(employeeCode)}&scanBy=${encodeURIComponent(scanBy)}`
        : `/api/coupons/scan?wo=${encodeURIComponent(workOrder)}&bundle=${encodeURIComponent(bundleNo)}&op=${encodeURIComponent(opNo)}&employeeCode=${encodeURIComponent(employeeCode)}&scanBy=${encodeURIComponent(scanBy)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        setIsScanning(false);
        setErrorMessage(data.error || "Failed to scan coupon.");
        setShowErrorModal(true);
        return;
      }

      const items = Array.isArray(data) ? data : [data];

      setRows((prev) => {
        let updatedRows = [...prev];
        items.forEach((item) => {
          // Find the first empty row in our table grid (where row.barCode is empty)
          const targetIndex = updatedRows.findIndex((row) => !row.barCode);
          const newRowData = {
            barCode: item.CouponCode || "",
            anlCode: item.Inseam ? `ANL-${item.Inseam}` : "",
            cutNo: String(item.CutNo ?? ""),
            category: item.Category || "",
            bundleNo: item.BundleNo || "",
            qty: String(item.Qty ?? ""),
            inseam: String(item.Inseam ?? ""),
            sizeCode: String(item.SizeCode ?? ""),
            sectionCode: item.SectionCode || "",
            sectionName: item.SectionName || "",
            oprCode: item.OprCode || "",
            operationName: item.OperationName || "",
            skillCode: String(item.SkillCode ?? ""),
            smv: String(item.Smv ?? ""),
            rate: String(item.Rate ?? ""),
            value: String(item.Value ?? ""),
          };

          if (targetIndex !== -1) {
            updatedRows[targetIndex] = {
              ...updatedRows[targetIndex],
              ...newRowData,
            };
          } else {
            // Append a new row dynamically!
            updatedRows.push({
              index: updatedRows.length + 1,
              ...newRowData,
            });
          }
        });
        return updatedRows;
      });

      setIsScanning(false);
      setSuccessMessage(
        `Coupon(s) scanned successfully! Matched ${items.length} operation(s).`,
      );
      setShowSuccessModal(true);
      setScanCouponCode("");
    } catch (err: any) {
      console.error("Coupon lookup error:", err);
      setIsScanning(false);
      setErrorMessage(
        err.message || "An unexpected error occurred while scanning.",
      );
      setShowErrorModal(true);
    }
  };
  // Table rows state
  const [rows, setRows] = useState<ScanningRow[]>(
    Array.from({ length: 10 }, (_, i) => ({
      index: i + 1,
      barCode: "",
      anlCode: "",
      cutNo: "",
      category: "",
      bundleNo: "",
      qty: "",
      inseam: "",
      sizeCode: "",
      sectionCode: "",
      sectionName: "",
      oprCode: "",
      operationName: "",
      skillCode: "",
      smv: "",
      rate: "",
      value: "",
    })),
  );

  const handleCellChange = (
    index: number,
    field: keyof ScanningRow,
    val: string,
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.index === index) {
          const updatedRow = { ...row, [field]: val };
          // If qty or rate changes, automatically calculate value
          if (field === "qty" || field === "rate") {
            const qtyNum = parseFloat(updatedRow.qty) || 0;
            const rateNum = parseFloat(updatedRow.rate) || 0;
            updatedRow.value = (qtyNum * rateNum).toFixed(2);
          }
          return updatedRow;
        }
        return row;
      }),
    );
  };

  const handleSelectWorker = (worker: any) => {
    setEmployeeCode(String(worker.EmployeeID));
    setEmployeeName(worker.FirstName ? worker.FirstName.trim() : "");
    setDepartment(worker.ParentDepartment || worker.DepartmentName || "");
    setDesignation(worker.DesignationName || "");
    setSection(worker.DepartmentName || "");
  };

  // Direct fetch by code (on Enter or Tab press)
  const handleEmployeeCodeKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" || e.key === "Tab") {
      const code = e.currentTarget.value.trim();
      if (!code) return;

      try {
        const response = await fetch(
          `/api/workers?code=${encodeURIComponent(code)}`,
        );
        if (response.ok) {
          const worker = await response.json();
          if (worker) {
            handleSelectWorker(worker);
          } else {
            // Clear details if worker not found
            setEmployeeName("");
            setDepartment("");
            setDesignation("");
            setSection("");
          }
        }
      } catch (err) {
        console.error("Employee fetch by code error:", err);
      }
    }
  };

  // Simulate scanning lookup when Bar # is entered and Enter/Tab is pressed
  const handleBarcodeKeyDown = async (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" || e.key === "Tab") {
      const code = e.currentTarget.value.trim();
      if (!code) return;

      setScanError("");

      if (!employeeCode.trim()) {
        setScanError("Please enter or select an Employee Code first!");
        return;
      }

      if (!scanBy.trim()) {
        setScanError("Please enter Scanner Name in Scan By first!");
        return;
      }

      try {
        const response = await fetch(
          `/api/coupons/scan?barcode=${encodeURIComponent(code)}&wo=${encodeURIComponent(workOrder)}&employeeCode=${encodeURIComponent(employeeCode)}&scanBy=${encodeURIComponent(scanBy)}`,
        );
        const data = await response.json();

        if (!response.ok) {
          setScanError(data.error || "Failed to scan coupon.");
          return;
        }

        const items = Array.isArray(data) ? data : [data];
        if (items.length > 0) {
          const item = items[0];
          // Successfully scanned! Update the row with the returned data from the DB
          setRows((prev) =>
            prev.map((row) => {
              if (row.index === index) {
                return {
                  ...row,
                  barCode: code,
                  anlCode: item.Inseam ? `ANL-${item.Inseam}` : "",
                  cutNo: String(item.CutNo ?? ""),
                  category: item.Category || "",
                  bundleNo: item.BundleNo || "",
                  qty: String(item.Qty ?? ""),
                  inseam: String(item.Inseam ?? ""),
                  sizeCode: String(item.SizeCode ?? ""),
                  sectionCode: item.SectionCode || "",
                  sectionName: item.SectionName || "",
                  oprCode: item.OprCode || "",
                  operationName: item.OperationName || "",
                  skillCode: String(item.SkillCode ?? ""),
                  smv: String(item.Smv ?? ""),
                  rate: String(item.Rate ?? ""),
                  value: String(item.Value ?? ""),
                };
              }
              return row;
            }),
          );
        }
      } catch (err: any) {
        console.error("Coupon lookup error:", err);
        setScanError(
          err.message || "An unexpected error occurred while scanning.",
        );
      }
    }
  };

  // Calculate totals
  const totalQty = rows.reduce((sum, row) => sum + (parseInt(row.qty) || 0), 0);
  const totalRecords = rows.filter(
    (row) => row.barCode.trim().length > 0,
  ).length;
  const totalValue = rows.reduce(
    (sum, row) => sum + (parseFloat(row.value) || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6 w-full text-xs text-[#334155] animate-fade-in pb-16 px-4 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3 no-print">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Coupon Scanning</span>
        </div>
      </div>

      {/* Main Grid: Info Cards + Total Status Box */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left Columns: Information panels */}
        <div className="xl:col-span-10 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Cpu className="w-4 h-4 text-[#4f46e5]" />
            <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
              Information
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1 */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 relative">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Employee Code <span className="text-red-500">*</span>
                </span>
                <Autocomplete<any>
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
                  inputClassName="w-full px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  onKeyDown={handleEmployeeCodeKeyDown}
                  minChars={1}
                />
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Department
                </span>
                <input
                  type="text"
                  placeholder="Department Name"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Designation
                </span>
                <input
                  type="text"
                  placeholder="Enter designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Dated
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={dated}
                    onChange={(e) => setDated(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white w-full"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" />
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Shift
                </span>
                <input
                  type="text"
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Employee Name
                </span>
                <input
                  type="text"
                  placeholder="Enter employee name"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Section
                </span>
                <input
                  type="text"
                  placeholder="Section Name"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Already Daily Scan
                </span>
                <input
                  type="text"
                  readOnly
                  placeholder="Enter daily scan"
                  value={alreadyDailyScan}
                  onChange={(e) => setAlreadyDailyScan(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-default"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Already Monthly Scan
                </span>
                <input
                  type="text"
                  readOnly
                  placeholder="Enter monthly scan"
                  value={alreadyMonthlyScan}
                  onChange={(e) => setAlreadyMonthlyScan(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-500 bg-slate-50 focus:outline-none cursor-default"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Line I.D
                </span>
                <input
                  type="text"
                  placeholder="Enter line id"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Scan By <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  placeholder="Enter scanner"
                  value={scanBy}
                  onChange={(e) => setScanBy(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
            </div>

            {/* Column 3 */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-bold text-[#475569] text-[10px] uppercase">
                  Remarks
                </span>
                <input
                  type="text"
                  placeholder="Enter remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-bold text-[#475569] text-[10px] uppercase">
                    Ani No.
                  </span>
                  <input
                    type="text"
                    placeholder="Enter ANI no."
                    value={aniNo}
                    onChange={(e) => setAniNo(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-bold text-[#475569] text-[10px] uppercase">
                    Sort Order
                  </span>
                  <input
                    type="text"
                    placeholder="Enter sort order"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
                  Coupon Code
                </span>
                <input
                  type="text"
                  placeholder="Scan or enter Coupon Code"
                  value={scanCouponCode}
                  onChange={(e) => setScanCouponCode(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </div>

              <div className="h-[1px] bg-slate-100 my-2" />

              <div className="flex flex-col gap-1 relative">
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
                    setBundleNo("");
                    setOpNo("");
                  }}
                  fetchSuggestions={fetchWorkOrderSuggestions}
                  renderSuggestion={(item) => <span>{item}</span>}
                  getSuggestionValue={(item) => item}
                  placeholder="Enter Work Order (e.g. W/O-003355)"
                  inputClassName="w-full px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 relative">
                  <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
                    Bundle
                  </span>
                  <Autocomplete<string>
                    value={bundleNo}
                    onChange={setBundleNo}
                    onSelect={setBundleNo}
                    fetchSuggestions={fetchBundleSuggestions}
                    renderSuggestion={(item) => <span>{item}</span>}
                    getSuggestionValue={(item) => item}
                    placeholder="e.g. 33550019"
                    inputClassName="w-full px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  />
                </div>

                <div className="flex flex-col gap-1 relative">
                  <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
                    Operation No
                  </span>
                  <Autocomplete<any>
                    value={opNo}
                    onChange={setOpNo}
                    onSelect={(op) => setOpNo(op.Operation_Code)}
                    fetchSuggestions={fetchOpSuggestions}
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
                    inputClassName="w-full px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleScanCoupon}
                className="w-full mt-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-md active:scale-[0.98]"
              >
                <span>🔍 Scan Coupon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Status Card: Total / Remaining */}
        <div className="xl:col-span-2 bg-[#fdfdfd] border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center min-h-[180px] bg-gradient-to-br from-indigo-50/30 to-purple-50/20">
          <TrendingUp className="w-5 h-5 text-indigo-500 mb-2" />
          <span className="font-bold text-indigo-900 text-[11px] uppercase tracking-wider text-center">
            Total / Remaining
          </span>
          <span className="text-[44px] font-black text-indigo-600 mt-2 select-none">
            {totalRecords}
          </span>
        </div>
      </div>

      {/* Rebuilt SCANNING DETAILS block */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm mt-1 flex flex-col gap-4">
        {scanError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 font-bold text-xs animate-fade-in flex items-center gap-2 no-print">
            <span>⚠️</span>
            <span>{scanError}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4f46e5]" />
            <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
              Scanning Details
            </h2>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            Rate Section
          </span>
        </div>

        {/* Scrollable table container */}
        <div className="overflow-x-auto overflow-y-auto w-full border border-slate-100 rounded-xl max-h-[500px] shadow-inner bg-slate-50/40">
          <table className="w-full border-collapse text-[11px] min-w-[1500px]">
            {/* Header groups */}
            <thead>
              {/* Category label row */}
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th
                  colSpan={14}
                  className="py-1.5 px-3 border-r border-slate-200"
                ></th>
                <th
                  colSpan={3}
                  className="py-1 px-3 text-center text-[9px] uppercase tracking-wider bg-slate-200/60 text-slate-800 border-b border-slate-300"
                >
                  Rate
                </th>
              </tr>
              {/* Main table headers */}
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-left">
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[40px]">
                  #
                </th>
                <th className="py-2 px-3 border-r border-slate-200 w-[140px]">
                  Bar #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 w-[100px]">
                  ANL #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 w-[100px]">
                  Cut #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[60px]">
                  [A,B,C]
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[80px]">
                  Bundle #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[70px]">
                  Qty
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[80px]">
                  Inseam
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[70px]">
                  Size #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 w-[90px]">
                  Section #
                </th>
                <th className="py-2 px-3 border-r border-slate-200 w-[130px]">
                  Section Name
                </th>
                <th className="py-2 px-2 border-r border-slate-200 w-[90px]">
                  Opr #
                </th>
                <th className="py-2 px-3 border-r border-slate-200 w-[180px]">
                  Operation Name
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-center w-[60px]">
                  Skill #
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-[80px] bg-slate-100/30">
                  SMV
                </th>
                <th className="py-2 px-2 border-r border-slate-200 text-right w-[90px] bg-slate-100/30">
                  Rate
                </th>
                <th className="py-2 px-3 text-right w-[100px] bg-indigo-50/20 text-[#4f46e5]">
                  Value
                </th>
              </tr>
            </thead>

            {/* Editable row inputs */}
            <tbody>
              {isScanning
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <tr
                      key={`skeleton-${idx}`}
                      className="animate-pulse bg-white border-b border-slate-100"
                    >
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-4 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-3 border-r border-slate-200">
                        <div className="h-3 w-24 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200">
                        <div className="h-3 w-16 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200">
                        <div className="h-3 w-12 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-8 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-16 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-12 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200">
                        <div className="h-3 w-16 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-3 border-r border-slate-200">
                        <div className="h-3 w-28 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200">
                        <div className="h-3 w-16 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-3 border-r border-slate-200">
                        <div className="h-3 w-36 bg-slate-200 rounded" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-center">
                        <div className="h-3 w-8 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-right bg-slate-50/50">
                        <div className="h-3 w-12 bg-slate-200 rounded ml-auto" />
                      </td>
                      <td className="py-3 px-2 border-r border-slate-200 text-right bg-slate-50/50">
                        <div className="h-3 w-12 bg-slate-200 rounded ml-auto" />
                      </td>
                      <td className="py-3 px-3 text-right bg-indigo-50/10">
                        <div className="h-3 w-14 bg-indigo-200/50 rounded ml-auto" />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr
                      key={row.index}
                      className="bg-white hover:bg-slate-50/50 border-b border-slate-100 transition-colors"
                    >
                      {/* # */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-slate-400">
                        {row.index}
                      </td>
                      {/* Bar # */}
                      <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-800">
                        {row.barCode || "-"}
                      </td>
                      {/* ANL # */}
                      <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                        {row.anlCode || "-"}
                      </td>
                      {/* Cut # */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.cutNo || "-"}
                      </td>
                      {/* [A,B,C] */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.category || "-"}
                      </td>
                      {/* Bundle # */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.bundleNo || "-"}
                      </td>
                      {/* Qty */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-[#4f46e5]">
                        {row.qty || "-"}
                      </td>
                      {/* Inseam */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.inseam || "-"}
                      </td>
                      {/* Size # */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.sizeCode || "-"}
                      </td>
                      {/* Section # */}
                      <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-700">
                        {row.sectionCode || "-"}
                      </td>
                      {/* Section Name */}
                      <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                        {row.sectionName || "-"}
                      </td>
                      {/* Opr # */}
                      <td className="py-1 px-2 border-r border-slate-200 font-semibold text-slate-700">
                        {row.oprCode || "-"}
                      </td>
                      {/* Operation Name */}
                      <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                        {row.operationName || "-"}
                      </td>
                      {/* Skill # */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                        {row.skillCode || "-"}
                      </td>
                      {/* SMV */}
                      <td className="py-1 px-2 border-r border-slate-200 text-right bg-slate-50/30 font-semibold text-slate-700">
                        {row.smv || "-"}
                      </td>
                      {/* Rate */}
                      <td className="py-1 px-2 border-r border-slate-200 text-right bg-slate-50/30 font-semibold text-slate-700">
                        {row.rate || "-"}
                      </td>
                      {/* Value */}
                      <td className="py-1 px-3 text-right bg-indigo-50/10 text-indigo-700 font-bold">
                        {row.value || "-"}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Container */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 bg-slate-50 border border-slate-200/60 rounded-xl px-6 py-4 mt-2">
          {/* Total Qty */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
              Total Qty
            </span>
            <div className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-black text-xs text-center min-w-[80px] shadow-sm">
              {totalQty}
            </div>
          </div>

          {/* Total Records */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
              Total Records
            </span>
            <div className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-black text-xs text-center min-w-[80px] shadow-sm">
              {totalRecords}
            </div>
          </div>

          {/* Total Value */}
          <div className="flex items-center gap-2 font-semibold">
            <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
              Total Value
            </span>
            <div className="px-4 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 text-indigo-700 font-black text-sm text-right min-w-[120px] shadow-sm">
              {totalValue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 animate-scale-up">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5 text-indigo-600">
              <span>🔍</span> Confirm Coupon Scan
            </h3>
            <div className="text-xs text-slate-600 mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col gap-2">
              {scanCouponCode.trim() ? (
                <div>
                  <strong className="text-slate-800">Coupon Code:</strong>{" "}
                  {scanCouponCode.trim()}
                </div>
              ) : (
                <>
                  <div>
                    <strong className="text-slate-800">Work Order:</strong>{" "}
                    {workOrder}
                  </div>
                  <div>
                    <strong className="text-slate-800">Bundle No:</strong>{" "}
                    {bundleNo || "All Bundles"}
                  </div>
                  <div>
                    <strong className="text-slate-800">Operation No:</strong>{" "}
                    {opNo || "All Operations"}
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to scan this coupon? This will update the
              database records.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeScanCoupon}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Confirm Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ✓
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Scan Successful
            </h3>
            <p className="text-xs text-slate-500 mb-6">{successMessage}</p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-100 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Scan Error
            </h3>
            <p className="text-xs text-rose-600 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50 mb-6 font-semibold">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setShowErrorModal(false)}
              className="w-full py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
