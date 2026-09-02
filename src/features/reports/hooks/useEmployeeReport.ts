"use client";

import { useCallback, useState } from "react";
import { fetchEmployeeReport, fetchWorkerSuggestions, type Worker } from "../services/reports.service";
import { getErrorMessage, type EmployeeReportSummary, type ReportDateRange } from "../types";

export function useEmployeeReport() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [dateRange, setDateRange] = useState<ReportDateRange>({});
  const [summary, setSummary] = useState<EmployeeReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectWorker = useCallback((worker: Worker) => {
    setEmployeeCode(String(worker.EmployeeID));
  }, []);

  // Both `codeOverride`/`rangeOverride` exist for the same reason: callers
  // that just changed employeeCode/dateRange via setState (selecting a
  // worker, picking a preset or a calendar range) want to search
  // immediately with the new value, but React state isn't readable until
  // the next render — so the fresh value is passed straight through
  // instead of being read back off state.
  const search = useCallback(
    async (codeOverride?: string, rangeOverride?: ReportDateRange) => {
      const code = (codeOverride ?? employeeCode).trim();
      if (!code) {
        setError("Enter an employee code to search.");
        setSummary(null);
        return;
      }

      const range = rangeOverride ?? dateRange;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchEmployeeReport(code, range);
        if (!result.ok) {
          setSummary(null);
          setError(result.error);
          return;
        }
        setSummary(result.data);
      } catch (err) {
        setSummary(null);
        setError(getErrorMessage(err, "Failed to fetch employee report."));
      } finally {
        setIsLoading(false);
      }
    },
    [employeeCode, dateRange],
  );

  const applyDateRange = useCallback(
    (range: ReportDateRange) => {
      setDateRange(range);
      if (employeeCode.trim()) search(undefined, range);
    },
    [employeeCode, search],
  );

  const reset = useCallback(() => {
    setEmployeeCode("");
    setDateRange({});
    setSummary(null);
    setError(null);
  }, []);

  return {
    employeeCode,
    setEmployeeCode,
    dateRange,
    applyDateRange,
    summary,
    isLoading,
    error,
    handleSelectWorker,
    fetchWorkerSuggestions,
    search,
    reset,
  };
}
