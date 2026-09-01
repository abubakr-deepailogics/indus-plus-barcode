"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/features/auth/context/auth-context";
import {
  ScanningRow,
  Worker,
  makeEmptyRow,
  getErrorMessage,
  describeFailedScans,
  couponItemToRow,
} from "../types";
import * as couponScanningService from "../services/coupon-scanning.service";

const EMPTY_ROW_COUNT = 10;

function makeEmptyRows() {
  return Array.from({ length: EMPTY_ROW_COUNT }, (_, i) => makeEmptyRow(i + 1));
}

export function useCouponScanning() {
  const { user } = useAuth();
  // Information panel state
  const [employeeCode, setEmployeeCode] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [alreadyDailyScan, setAlreadyDailyScan] = useState("");
  const [alreadyMonthlyScan, setAlreadyMonthlyScan] = useState("");
  const [lineId, setLineId] = useState("");
  const [scanBy, setScanBy] = useState(() => {
    return user?.displayName || user?.email?.split("@")[0] || "";
  });

  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    setScanBy(user?.displayName || user?.email?.split("@")[0] || "");
  }

  const [dated, setDated] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [section, setSection] = useState("");
  const [shift, setShift] = useState("");

  // Coupon verification headers
  const [workOrder, setWorkOrder] = useState("");
  const [fromCut, setFromCut] = useState("");
  const [toCut, setToCut] = useState("");
  const [bundleNo, setBundleNo] = useState("");
  const [opNo, setOpNo] = useState("");
  const [scanCouponCode, setScanCouponCode] = useState("");
  const [scannerInput, setScannerInput] = useState("");
  const [scanError, setScanError] = useState("");

  // Scanning state and modals
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [rows, setRows] = useState<ScanningRow[]>(makeEmptyRows);

  // Whether the current Employee Code was present (per HRMS attendance) on
  // the current Dated value. null = not yet checked for this exact
  // employee/date pair — distinct from `false` (checked, and absent) so
  // callers can tell "unknown, still need to verify" from "verified absent".
  const [isEmployeePresent, setIsEmployeePresent] = useState<boolean | null>(null);
  const [checkingAttendance, setCheckingAttendance] = useState(false);

  // Stale attendance result from a previous employee/date pair must never
  // silently carry over to a new one — reset to "unknown" the moment either
  // changes. Adjusted during render (same pattern as prevUser above) rather
  // than in an effect, since a setState directly in an effect body risks
  // the cascading extra render React's rules warn against.
  const attendanceKey = `${employeeCode}|${dated}`;
  const [prevAttendanceKey, setPrevAttendanceKey] = useState(attendanceKey);
  if (attendanceKey !== prevAttendanceKey) {
    setPrevAttendanceKey(attendanceKey);
    // The "not marked present" error (raised by verifyAttendance below) was
    // about the *previous* employee/date pair specifically — it no longer
    // applies once either changes, so clear it here rather than leaving it
    // to linger until the next scan attempt overwrites it. Scoped to only
    // fire when the previous result was actually "absent" (not just any
    // error), so unrelated errors (missing Scan By, etc.) aren't dismissed
    // by editing Employee Code/Dated.
    if (isEmployeePresent === false) {
      setScanError("");
      setErrorMessage("");
      setShowErrorModal(false);
    }
    setIsEmployeePresent(null);
  }

  const raiseError = (message: string) => {
    setScanError(message);
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Verifies attendance for the current employeeCode/dated pair and caches
  // the result in isEmployeePresent — called both from the UI the moment
  // Dated is committed (InformationPanel, to gate/focus the scanner field)
  // and defensively right before an actual scan runs (handleFetchAndScan/
  // flushPendingScans below), in case a scan is triggered through a path
  // that bypasses that field's disabled state.
  //
  // Accepts an optional date override: a caller that just called setDated
  // synchronously (e.g. picking a date from the calendar) would otherwise
  // read the pre-update `dated` from this closure, since the state update
  // hasn't re-rendered yet — passing the just-set value sidesteps that.
  const verifyAttendance = useCallback(async (overrideDate?: string): Promise<boolean> => {
    const dateToCheck = overrideDate ?? dated;
    if (!employeeCode.trim() || !dateToCheck) {
      setIsEmployeePresent(null);
      return false;
    }
    setCheckingAttendance(true);
    try {
      const result = await couponScanningService.checkAttendance(employeeCode, dateToCheck);
      if (!result.ok) {
        raiseError(result.error);
        setIsEmployeePresent(null);
        return false;
      }
      setIsEmployeePresent(result.present);
      if (!result.present) {
        raiseError("This employee was not marked present on the selected date — scanning is disabled.");
      }
      return result.present;
    } catch (err) {
      raiseError(getErrorMessage(err, "Failed to check employee attendance."));
      setIsEmployeePresent(null);
      return false;
    } finally {
      setCheckingAttendance(false);
    }
  }, [employeeCode, dated]);

  // useCallback keeps these referentially stable across renders — Autocomplete
  // re-runs its fetch effect whenever `fetchSuggestions` changes identity, so
  // an inline closure here would re-fire every Autocomplete on the page (not
  // just the one being typed into) on every keystroke anywhere in the form.
  const fetchWorkerSuggestions = useCallback((query: string) => {
    return couponScanningService.fetchWorkerSuggestions(query).catch((err) => {
      console.error("Worker suggestions fetch error:", err);
      return [];
    });
  }, []);

  const fetchWorkOrderSuggestions = useCallback((query: string) => {
    return couponScanningService.fetchWorkOrderSuggestions(query).catch((err) => {
      console.error("WO suggestions fetch error:", err);
      return [];
    });
  }, []);

  const fetchBundleSuggestions = useCallback(
    (query: string) => {
      if (!workOrder) return Promise.resolve([]);
      return couponScanningService
        .fetchBundleSuggestions(workOrder, query)
        .catch((err) => {
          console.error("Bundle suggestions fetch error:", err);
          return [];
        });
    },
    [workOrder],
  );

  const fetchOpSuggestions = useCallback(
    (query: string) => {
      if (!workOrder) return Promise.resolve([]);
      return couponScanningService
        .fetchOpSuggestions(workOrder, query)
        .catch((err) => {
          console.error("Op suggestions fetch error:", err);
          return [];
        });
    },
    [workOrder],
  );

  const fetchCutSuggestions = useCallback(
    (query: string) => {
      if (!workOrder) return Promise.resolve([]);
      return couponScanningService
        .fetchCutSuggestions(workOrder, query)
        .catch((err) => {
          console.error("Cut suggestions fetch error:", err);
          return [];
        });
    },
    [workOrder],
  );

  // Fetches matching coupons and immediately marks them as scanned in the database.
  const handleFetchAndScan = async () => {
    setScanError("");
    setSuccessMessage("");
    setErrorMessage("");

    if (!employeeCode.trim()) {
      raiseError("Please enter or select an Employee Code first!");
      return;
    }
    if (!dated) {
      raiseError("Please enter a Date first!");
      return;
    }
    if (!scanBy.trim()) {
      raiseError("Please enter Scanner Name in Scan By first!");
      return;
    }
    // isEmployeePresent is only trustworthy for the *current* employeeCode/
    // dated pair (reset to null the instant either changes — see the effect
    // above), so a cached `true` can be reused, but anything else needs a
    // fresh check rather than assuming this path was already gated by UI.
    if (isEmployeePresent !== true && !(await verifyAttendance())) {
      return;
    }

    if (!scanCouponCode.trim() && !workOrder) {
      raiseError("Please select a Work Order or enter a Coupon Code first!");
      return;
    }

    setIsScanning(true);

    try {
      // 1. Fetch matching coupons
      const result = await couponScanningService.fetchCouponInfo({
        couponCode: scanCouponCode,
        workOrder,
        opNo,
        fromCut,
        toCut,
        bundleNo,
      });

      if (!result.ok) {
        setIsScanning(false);
        setErrorMessage(result.error);
        setShowErrorModal(true);
        return;
      }

      if (result.items.length === 0) {
        setIsScanning(false);
        setErrorMessage("No matching coupons found for the entered criteria.");
        setShowErrorModal(true);
        return;
      }

      const barcodesToScan = result.items
        .map((item) => item.CouponCode || "")
        .filter((code) => code.trim().length > 0);

      if (barcodesToScan.length === 0) {
        setIsScanning(false);
        setErrorMessage("No valid coupon codes found.");
        setShowErrorModal(true);
        return;
      }

      // 2. Scan the fetched barcodes immediately in a batch
      const scanResult = await couponScanningService.scanCouponsBatch({
        barcodes: barcodesToScan,
        employeeCode,
        scanBy,
        scanDate: dated,
      });

      if (!scanResult.ok) {
        setIsScanning(false);
        setErrorMessage(scanResult.error);
        setShowErrorModal(true);
        return;
      }

      // 3. Update the local rows state with scanned items
      const scannedMap = new Map(
        scanResult.scanned.map((item) => [item.CouponCode, item]),
      );

      setRows((prev) => {
        const updatedRows = [...prev];
        result.items.forEach((item) => {
          const code = item.CouponCode || "";
          const scanItem = scannedMap.get(code);

          const isScanned = !!scanItem;
          const newRowData = {
            ...couponItemToRow(item),
            scanned: isScanned,
            scanDate: scanItem?.ScannedAt
              ? new Date(scanItem.ScannedAt).toLocaleDateString()
              : dated || new Date().toLocaleDateString(),
          };

          const existingIdx = updatedRows.findIndex((row) => row.barCode === code);
          if (existingIdx !== -1) {
            updatedRows[existingIdx] = {
              ...updatedRows[existingIdx],
              ...newRowData,
            };
          } else {
            const emptyIdx = updatedRows.findIndex((row) => !row.barCode);
            if (emptyIdx !== -1) {
              updatedRows[emptyIdx] = {
                ...updatedRows[emptyIdx],
                ...newRowData,
              };
            } else {
              updatedRows.push({
                index: updatedRows.length + 1,
                ...newRowData,
              });
            }
          }
        });
        return updatedRows;
      });

      // 4. Update counts
      const newlyScannedCount = scanResult.scanned.length;
      if (newlyScannedCount > 0) {
        setAlreadyDailyScan((prev) =>
          String((parseInt(prev, 10) || 0) + newlyScannedCount),
        );
        setAlreadyMonthlyScan((prev) =>
          String((parseInt(prev, 10) || 0) + newlyScannedCount),
        );
      }

      setIsScanning(false);
      setScanCouponCode("");

      if (scanResult.failed.length > 0) {
        setScanError(describeFailedScans(scanResult.failed));
      } else {
        setScanError("");
      }

      setSuccessMessage(
        `Successfully scanned ${newlyScannedCount} coupon(s)!` +
          (scanResult.failed.length > 0
            ? ` (${scanResult.failed.length} skipped/failed)`
            : ""),
      );
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Combined search and scan error:", err);
      setIsScanning(false);
      setErrorMessage(
        getErrorMessage(err, "An unexpected error occurred during search and scan."),
      );
      setShowErrorModal(true);
    }
  };

  const clearForm = () => {
    // Clear Information panel
    setEmployeeCode("");
    setDepartment("");
    setDesignation("");
    setAlreadyDailyScan("");
    setAlreadyMonthlyScan("");
    setLineId("");
    setScanBy(user?.displayName || user?.email?.split("@")[0] || "");
    setDated("");
    setEmployeeName("");
    setSection("");
    setShift("");

    // Clear Coupon verification headers
    setWorkOrder("");
    setFromCut("");
    setToCut("");
    setBundleNo("");
    setOpNo("");
    setScanCouponCode("");
    setScanError("");
    setSuccessMessage("");
    setErrorMessage("");

    // Clear Table (reset to empty rows)
    setRows(makeEmptyRows());
  };

  // Cmd/Ctrl+N clears the form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isNewFormKey =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n";
      if (isNewFormKey) {
        e.preventDefault();
        clearForm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Barcode-gun field: a scanner types the code then sends Enter/Tab itself,
  // firing fast in bursts. Each code is appended to the table right away as
  // "pending" for instant visual feedback, then queued; a burst is flushed
  // to the batch-scan API 400ms after the *last* scan in it (trailing
  // debounce), so N codes typed in a row become one DB round trip instead
  // of N — the timer keeps resetting while codes keep arriving, and only
  // fires once the gun goes quiet.
  const FLUSH_DELAY_MS = 400;
  const pendingCodesRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingScans = useCallback(async () => {
    const codes = pendingCodesRef.current;
    pendingCodesRef.current = [];
    flushTimerRef.current = null;
    if (codes.length === 0) return;

    if (!employeeCode.trim()) {
      raiseError("Please enter or select an Employee Code first!");
      return;
    }
    if (!dated) {
      raiseError("Please enter a Date first!");
      return;
    }
    if (!scanBy.trim()) {
      raiseError("Please enter Scanner Name in Scan By first!");
      return;
    }
    // Defense in depth — the Scanner Input field is disabled while
    // isEmployeePresent isn't true, so this path shouldn't normally be
    // reachable while absent, but a cached `true` only counts for the
    // current employeeCode/dated pair (see the reset effect above).
    if (isEmployeePresent !== true && !(await verifyAttendance())) {
      return;
    }

    try {
      const result = await couponScanningService.scanCouponsBatch({
        barcodes: codes,
        employeeCode,
        scanBy,
        scanDate: dated,
      });

      if (!result.ok) {
        raiseError(result.error);
        return;
      }

      const byCode = new Map(result.scanned.map((item) => [item.CouponCode, item]));
      setRows((prev) =>
        prev.map((row) => {
          const item = row.barCode ? byCode.get(row.barCode) : undefined;
          if (!item) return row;
          return {
            ...row,
            ...couponItemToRow(item),
            scanned: true,
            scanDate: item.ScannedAt
              ? new Date(item.ScannedAt).toLocaleDateString()
              : dated || new Date().toLocaleDateString(),
          };
        }),
      );

      if (result.scanned.length > 0) {
        setAlreadyDailyScan((prev) => String((parseInt(prev) || 0) + result.scanned.length));
        setAlreadyMonthlyScan((prev) => String((parseInt(prev) || 0) + result.scanned.length));
      }

      if (result.failed.length > 0) {
        setScanError(describeFailedScans(result.failed));
        // Drop failed codes' rows back to empty so the slot isn't stuck
        // showing an unscanned "pending" row forever.
        const failedCodes = new Set(result.failed.map((f) => f.code));
        setRows((prev) =>
          prev.map((row) =>
            row.barCode && failedCodes.has(row.barCode)
              ? makeEmptyRow(row.index)
              : row,
          ),
        );
      } else {
        setScanError("");
      }
    } catch (err) {
      console.error("Batch scan error:", err);
      raiseError(getErrorMessage(err, "An unexpected error occurred while scanning."));
    }
  }, [employeeCode, scanBy, dated, isEmployeePresent, verifyAttendance]);

  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== "Tab") return;

    e.preventDefault();
    const code = e.currentTarget.value.trim();
    const input = e.currentTarget;
    if (!code) return;

    setScannerInput("");
    requestAnimationFrame(() => input.focus());

    // Skip coupons already present in the table (already fetched/scanned/pending).
    if (rows.some((row) => row.barCode === code)) {
      setScanError(`Coupon ${code} is already in the table.`);
      return;
    }
    setScanError("");

    setRows((prev) => {
      const updatedRows = [...prev];
      const targetIndex = updatedRows.findIndex((row) => !row.barCode);
      if (targetIndex !== -1) {
        updatedRows[targetIndex] = { ...updatedRows[targetIndex], barCode: code };
      } else {
        updatedRows.push({
          ...makeEmptyRow(updatedRows.length + 1),
          barCode: code,
        });
      }
      return updatedRows;
    });

    pendingCodesRef.current.push(code);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushPendingScans, FLUSH_DELAY_MS);
  };

  // Flush whatever's still queued if the component unmounts mid-burst
  // (e.g. navigating away right after the last scan of a shift).
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  // Remove also undoes the scan in the DB when the row being removed was
  // already scanned — one button instead of separate Remove/Unscan actions.
  const handleRemoveRow = async (rowIndex: number) => {
    const row = rows.find((r) => r.index === rowIndex);

    if (row?.scanned && row.barCode) {
      if (
        !window.confirm(
          `Coupon ${row.barCode} is already scanned. Remove and unscan it?`,
        )
      ) {
        return;
      }
      try {
        const result = await couponScanningService.unscanCoupon(row.barCode);
        if (!result.ok) {
          setScanError(result.error);
          return;
        }
        setAlreadyDailyScan((prev) =>
          String(Math.max(0, (parseInt(prev) || 0) - 1)),
        );
        setAlreadyMonthlyScan((prev) =>
          String(Math.max(0, (parseInt(prev) || 0) - 1)),
        );
      } catch (err) {
        console.error("Unscan error:", err);
        setScanError("An error occurred while unscanning the coupon.");
        return;
      }
    }

    setRows((prev) =>
      prev
        .filter((r) => r.index !== rowIndex)
        .map((r, i) => ({ ...r, index: i + 1 })),
    );
  };

  const handleSelectWorker = async (worker: Worker) => {
    const empCode = String(worker.EmployeeID);
    setEmployeeCode(empCode);
    setEmployeeName(worker.FirstName ? worker.FirstName.trim() : "");
    setDepartment(worker.ParentDepartment || worker.DepartmentName || "");
    setDesignation(worker.DesignationName || "");
    setSection(worker.DepartmentName || "");

    // Fetch dynamic scan stats
    try {
      const fullWorker = await couponScanningService.fetchWorkerByCode(empCode);
      if (fullWorker) {
        setAlreadyDailyScan(String(fullWorker.AlreadyDailyScan ?? 0));
        setAlreadyMonthlyScan(String(fullWorker.AlreadyMonthlyScan ?? 0));
      }
    } catch (err) {
      console.error("Failed to fetch worker scan stats:", err);
    }
  };

  // Direct fetch by code (on Enter or Tab press)
  const handleEmployeeCodeKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key !== "Enter" && e.key !== "Tab") return;
    const code = e.currentTarget.value.trim();
    if (!code) return;

    try {
      const worker = await couponScanningService.fetchWorkerByCode(code);
      if (worker) {
        handleSelectWorker(worker);
      } else {
        // Clear details if worker not found
        setEmployeeName("");
        setDepartment("");
        setDesignation("");
        setSection("");
      }
    } catch (err) {
      console.error("Employee fetch by code error:", err);
    }
  };

  // Direct scan lookup when Bar # is entered and Enter/Tab is pressed
  const handleBarcodeKeyDown = async (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key !== "Enter" && e.key !== "Tab") return;
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
      const result = await couponScanningService.scanCoupon({
        barcode: code,
        workOrder,
        employeeCode,
        scanBy,
        scanDate: dated,
      });

      if (!result.ok) {
        setScanError(result.error);
        return;
      }

      const item = result.item;
      setRows((prev) =>
        prev.map((row) =>
          row.index === index
            ? {
                ...row,
                ...couponItemToRow(item),
                barCode: code,
                scanDate: item.ScannedAt
                  ? new Date(item.ScannedAt).toLocaleDateString()
                  : dated || new Date().toLocaleDateString(),
              }
            : row,
        ),
      );
    } catch (err) {
      console.error("Coupon lookup error:", err);
      setScanError(
        getErrorMessage(err, "An unexpected error occurred while scanning."),
      );
    }
  };

  const handleCellChange = (
    index: number,
    field: keyof ScanningRow,
    val: string,
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.index !== index) return row;
        const updatedRow = { ...row, [field]: val };
        // If qty or rate changes, automatically calculate value
        if (field === "qty" || field === "rate") {
          const qtyNum = parseFloat(updatedRow.qty) || 0;
          const rateNum = parseFloat(updatedRow.rate) || 0;
          updatedRow.value = (qtyNum * rateNum).toFixed(2);
        }
        return updatedRow;
      }),
    );
  };

  // Totals
  const totalQty = rows.reduce((sum, row) => sum + (parseInt(row.qty) || 0), 0);
  const totalRecords = rows.filter(
    (row) => row.barCode.trim().length > 0,
  ).length;
  const totalValue = rows.reduce(
    (sum, row) => sum + (parseFloat(row.value) || 0),
    0,
  );
  const totalSam = rows.reduce(
    (sum, row) => sum + (parseFloat(row.smv) || 0) * (parseInt(row.qty) || 0),
    0,
  );

  return {
    // Information panel
    employeeCode,
    setEmployeeCode,
    department,
    designation,
    alreadyDailyScan,
    setAlreadyDailyScan,
    alreadyMonthlyScan,
    setAlreadyMonthlyScan,
    lineId,
    setLineId,
    scanBy,
    dated,
    setDated,
    employeeName,
    section,
    shift,
    setShift,
    isEmployeePresent,
    checkingAttendance,
    verifyAttendance,

    // Coupon verification headers
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
    scanCouponCode,
    setScanCouponCode,
    scannerInput,
    setScannerInput,
    scanError,

    // Scanning / modal state
    isScanning,
    showSuccessModal,
    setShowSuccessModal,
    successMessage,
    showErrorModal,
    setShowErrorModal,
    errorMessage,

    // Rows + totals
    rows,
    totalQty,
    totalRecords,
    totalValue,
    totalSam,

    // Suggestion fetchers (for Autocomplete)
    fetchWorkerSuggestions,
    fetchWorkOrderSuggestions,
    fetchBundleSuggestions,
    fetchOpSuggestions,
    fetchCutSuggestions,

    // Handlers
    handleFetchAndScan,
    clearForm,
    handleScannerKeyDown,
    handleRemoveRow,
    handleSelectWorker,
    handleEmployeeCodeKeyDown,
    handleBarcodeKeyDown,
    handleCellChange,
  };
}
