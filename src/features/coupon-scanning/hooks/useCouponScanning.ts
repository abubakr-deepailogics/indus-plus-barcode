"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/features/auth/context/auth-context";
import {
  ScanningRow,
  Worker,
  makeEmptyRow,
  getErrorMessage,
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
  const [scanBy, setScanBy] = useState("");

  useEffect(() => {
    if (user) {
      const name = user.displayName || user.email?.split("@")[0] || "";
      setScanBy(name);
    }
  }, [user]);

  const [dated, setDated] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [section, setSection] = useState("");
  const [shift, setShift] = useState("");
  const [aniNo, setAniNo] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  // Coupon verification headers
  const [workOrder, setWorkOrder] = useState("");
  const [fromCut, setFromCut] = useState("");
  const [toCut, setToCut] = useState("");
  const [opNo, setOpNo] = useState("");
  const [scanCouponCode, setScanCouponCode] = useState("");
  const [scannerInput, setScannerInput] = useState("");
  const [scanError, setScanError] = useState("");

  // Scanning state and modals
  const [isScanning, setIsScanning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [rows, setRows] = useState<ScanningRow[]>(makeEmptyRows);

  const raiseError = (message: string) => {
    setScanError(message);
    setErrorMessage(message);
    setShowErrorModal(true);
  };

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

  // Step 1: "Fetch Info" — looks up matching coupons and lists them in the
  // table below. Does NOT mark anything as scanned in the database yet.
  // `codeOverride` lets the scanner-gun field trigger a fetch without first
  // round-tripping through the scanCouponCode state.
  const handleFetchInfo = async (codeOverride?: string) => {
    setScanError("");
    const couponCode = codeOverride ?? scanCouponCode;

    if (!couponCode.trim() && !workOrder) {
      raiseError("Please select a Work Order or enter a Coupon Code first!");
      return;
    }

    setIsScanning(true);

    try {
      const result = await couponScanningService.fetchCouponInfo({
        couponCode,
        workOrder,
        opNo,
        fromCut,
        toCut,
      });

      if (!result.ok) {
        setIsScanning(false);
        setErrorMessage(result.error);
        setShowErrorModal(true);
        return;
      }

      const existingCodes = new Set(
        rows.filter((row) => row.barCode).map((row) => row.barCode),
      );
      const duplicates = result.items.filter(
        (item) => item.CouponCode && existingCodes.has(item.CouponCode),
      ).length;

      setRows((prev) => {
        const updatedRows = [...prev];
        result.items.forEach((item) => {
          const code = item.CouponCode || "";
          // Skip coupons already present in the table (already fetched/scanned).
          if (code && updatedRows.some((row) => row.barCode === code)) {
            return;
          }
          // Find the first empty row in our table grid (where row.barCode is empty)
          const targetIndex = updatedRows.findIndex((row) => !row.barCode);
          const newRowData = { ...couponItemToRow(item), scanned: false };

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
      setScanCouponCode("");
      if (duplicates > 0) {
        setScanError(
          `${duplicates} coupon(s) already in the table were skipped as duplicates.`,
        );
      }
    } catch (err) {
      console.error("Coupon lookup error:", err);
      setIsScanning(false);
      setErrorMessage(
        getErrorMessage(err, "An unexpected error occurred while fetching."),
      );
      setShowErrorModal(true);
    }
  };

  // Step 2: "Scan" — takes every fetched-but-unscanned coupon currently in
  // the table and marks it as scanned in the database.
  const handleScanCoupon = () => {
    setScanError("");

    if (!employeeCode.trim()) {
      raiseError("Please enter or select an Employee Code first!");
      return;
    }
    if (!scanBy.trim()) {
      raiseError("Please enter Scanner Name in Scan By first!");
      return;
    }
    if (!rows.some((row) => row.barCode && !row.scanned)) {
      raiseError("Please fetch coupon info first before scanning!");
      return;
    }

    setShowConfirmModal(true);
  };

  const executeScanCoupon = async () => {
    setShowConfirmModal(false);
    setIsScanning(true);
    setScanError("");

    const pending = rows.filter((row) => row.barCode && !row.scanned);

    try {
      let scannedCount = 0;
      for (const row of pending) {
        const result = await couponScanningService.scanCoupon({
          barcode: row.barCode,
          employeeCode,
          scanBy,
          scanDate: dated,
        });

        if (!result.ok) {
          console.error(`Failed to scan ${row.barCode}:`, result.error);
          continue;
        }

        scannedCount += 1;
        const item = result.item;
        setRows((prev) =>
          prev.map((r) =>
            r.index === row.index
              ? {
                  ...r,
                  scanned: true,
                  scanDate: item.ScannedAt
                    ? new Date(item.ScannedAt).toLocaleDateString()
                    : dated || new Date().toLocaleDateString(),
                }
              : r,
          ),
        );
      }

      setAlreadyDailyScan((prev) =>
        String((parseInt(prev) || 0) + scannedCount),
      );
      setAlreadyMonthlyScan((prev) =>
        String((parseInt(prev) || 0) + scannedCount),
      );

      setIsScanning(false);
      setSuccessMessage(
        `Coupon(s) scanned successfully! Matched ${scannedCount} operation(s).`,
      );
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Coupon scan error:", err);
      setIsScanning(false);
      setErrorMessage(
        getErrorMessage(err, "An unexpected error occurred while scanning."),
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
    setAniNo("");
    setSortOrder("");

    // Clear Coupon verification headers
    setWorkOrder("");
    setFromCut("");
    setToCut("");
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
    if (!scanBy.trim()) {
      raiseError("Please enter Scanner Name in Scan By first!");
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
        setScanError(
          `${result.failed.length} coupon(s) could not be scanned (already scanned or not found): ${result.failed.join(", ")}`,
        );
        // Drop failed codes' rows back to empty so the slot isn't stuck
        // showing an unscanned "pending" row forever.
        setRows((prev) =>
          prev.map((row) =>
            row.barCode && result.failed.includes(row.barCode)
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
  }, [employeeCode, scanBy, dated]);

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
    aniNo,
    setAniNo,
    sortOrder,
    setSortOrder,

    // Coupon verification headers
    workOrder,
    setWorkOrder,
    fromCut,
    setFromCut,
    toCut,
    setToCut,
    opNo,
    setOpNo,
    scanCouponCode,
    setScanCouponCode,
    scannerInput,
    setScannerInput,
    scanError,

    // Scanning / modal state
    isScanning,
    showConfirmModal,
    setShowConfirmModal,
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
    handleFetchInfo,
    handleScanCoupon,
    executeScanCoupon,
    clearForm,
    handleScannerKeyDown,
    handleRemoveRow,
    handleSelectWorker,
    handleEmployeeCodeKeyDown,
    handleBarcodeKeyDown,
    handleCellChange,
  };
}
