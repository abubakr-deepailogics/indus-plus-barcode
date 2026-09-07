"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";

type CsvExportButtonProps = {
  label?: string;
  disabled?: boolean;
  className?: string;
} & (
  | {
      filename: string;
      headers: string[];
      rows: (string | number | null | undefined)[][];
      onExport?: undefined;
    }
  | {
      // For data that isn't already fully loaded in memory (e.g. a
      // server-paginated table) — fetches everything matching the current
      // filters and downloads it, instead of exporting only the current page.
      onExport: () => Promise<void>;
      filename?: undefined;
      headers?: undefined;
      rows?: undefined;
    }
);

export function CsvExportButton(props: CsvExportButtonProps) {
  const { label = "Export", disabled, className } = props;
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    if (props.onExport) {
      setIsExporting(true);
      try {
        await props.onExport();
      } finally {
        setIsExporting(false);
      }
      return;
    }
    downloadCsv(props.filename, props.headers, props.rows);
  };

  const isDisabled =
    disabled ?? (props.onExport ? false : props.rows.length === 0);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled || isExporting}
      title="Export this table to Excel (.csv)"
      className={
        className ??
        "shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-3.5 h-3.5" />
      )}
      {isExporting ? "Exporting…" : label}
    </button>
  );
}
