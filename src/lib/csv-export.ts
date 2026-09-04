// Generic client-side "export to Excel" helper — Excel opens .csv natively,
// so this avoids pulling in a spreadsheet-writing dependency (the one
// available on npm, `xlsx`, carries unpatched high-severity CVEs) for what
// is otherwise a plain flat-table export.
function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

const BOM = String.fromCharCode(0xfeff);

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines = [headers, ...rows].map((row) =>
    row.map(csvEscape).join(","),
  );
  // Leading BOM so Excel detects UTF-8 and renders non-ASCII characters
  // (é, —, etc.) correctly instead of mangling them.
  const csvContent = BOM + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  // Callers build filenames from real-world values (work order numbers like
  // "W/O-001939") that aren't filesystem-safe as-is — strip anything but
  // alphanumerics/dot/dash/underscore so the browser never interprets a "/"
  // as a path separator.
  const safeName = filename.replace(/[^A-Za-z0-9._-]+/g, "-");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName.endsWith(".csv") ? safeName : `${safeName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
