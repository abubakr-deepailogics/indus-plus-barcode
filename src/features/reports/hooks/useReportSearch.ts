"use client";

import { useCallback, useState } from "react";
import {
  fetchAllReportSummary,
  fetchReportSummary,
} from "../services/reports.service";
import {
  getErrorMessage,
  type ReportDateRange,
  type ReportSearchMode,
  type ReportSummary,
} from "../types";

export function useReportSearch() {
  const [mode, setMode] = useState<ReportSearchMode>("employee");
  const [searchValue, setSearchValue] = useState("");
  const [dateRange, setDateRange] = useState<ReportDateRange>({});
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tracks whether the current summary came from the "All" action rather
  // than a specific search value, so a date-range change knows which of the
  // two to re-run.
  const [isAllMode, setIsAllMode] = useState(false);

  // `valueOverride`/`rangeOverride`/`modeOverride` exist for the same reason:
  // callers that just changed searchValue/dateRange/mode via setState
  // (selecting a suggestion, picking a preset or calendar range, switching
  // the search mode) want to search immediately with the new value, but
  // React state isn't readable until the next render — so the fresh value is
  // passed straight through instead of being read back off state.
  const search = useCallback(
    async (
      valueOverride?: string,
      rangeOverride?: ReportDateRange,
      modeOverride?: ReportSearchMode,
    ) => {
      const activeMode = modeOverride ?? mode;
      const value = (valueOverride ?? searchValue).trim();
      if (!value) {
        setError("Enter a value to search.");
        setSummary(null);
        return;
      }

      const range = rangeOverride ?? dateRange;
      setIsAllMode(false);
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchReportSummary(activeMode, value, range);
        if (!result.ok) {
          setSummary(null);
          setError(result.error);
          return;
        }
        setSummary(result.data);
      } catch (err) {
        setSummary(null);
        setError(getErrorMessage(err, "Failed to fetch report."));
      } finally {
        setIsLoading(false);
      }
    },
    [mode, searchValue, dateRange],
  );

  // Same flow as `search`, but aggregates every employee/work order/
  // operation (whichever the current mode is) instead of one — triggered
  // only by the "All" action beside the search field.
  const searchAll = useCallback(
    async (rangeOverride?: ReportDateRange) => {
      const range = rangeOverride ?? dateRange;
      setSearchValue("");
      setIsAllMode(true);
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchAllReportSummary(mode, range);
        if (!result.ok) {
          setSummary(null);
          setError(result.error);
          return;
        }
        setSummary(result.data);
      } catch (err) {
        setSummary(null);
        setError(getErrorMessage(err, "Failed to fetch report."));
      } finally {
        setIsLoading(false);
      }
    },
    [mode, dateRange],
  );

  // Switching what's being searched by (employee/work order/operation)
  // starts clean — a leftover value or result from the previous mode isn't
  // meaningful in the new one.
  const changeMode = useCallback((next: ReportSearchMode) => {
    setMode(next);
    setSearchValue("");
    setSummary(null);
    setError(null);
    setIsAllMode(false);
  }, []);

  const applyDateRange = useCallback(
    (range: ReportDateRange) => {
      setDateRange(range);
      if (isAllMode) {
        searchAll(range);
      } else if (searchValue.trim()) {
        search(undefined, range);
      }
    },
    [searchValue, search, isAllMode, searchAll],
  );

  return {
    mode,
    changeMode,
    searchValue,
    setSearchValue,
    dateRange,
    applyDateRange,
    summary,
    isLoading,
    error,
    search,
    searchAll,
    isAllMode,
  };
}
