// Classifies a style-bulletin operation row into one of the four production
// departments shown in the style bulletin / cut report UIs.
//
// The department comes ONLY from S_OperationsCatalog.Department, looked up
// by Operation Code (see OPERATIONS_CATALOG_TABLE / styleBulletinByFilter in
// src/lib/db.ts, which LEFT JOINs and selects it as `Department`). Verified
// against the live catalog: OperationCode is unique there and every code
// maps to exactly one Department value ("Sewing" / "Washing" / "Cutting" /
// "Finishing"), so this is a reliable 1:1 lookup, not a heuristic.
//
// Do NOT derive department from StyleBullettinInt's own `Section` column
// (a floor-layout subdivision, e.g. "Before Spray"/"Small Part" — not a
// department) or from keyword-matching Operation Name text (e.g. a Sewing
// operation named "Rivet Washer Attach" would false-match "washing" on a
// bare substring check).

// Lowercase, to match the filter values the pages already use
// (selectedDeptFilter: "all" | "cutting" | "washing" | "sewing" | "finishing").
// The catalog itself stores these capitalized ("Sewing", "Washing", "Cutting",
// "Finishing") — normalize to lowercase here, once, rather than each caller
// needing to know the DB's raw casing.
export type Department = "cutting" | "washing" | "sewing" | "finishing";

const KNOWN_DEPARTMENTS: ReadonlySet<Department> = new Set([
  "cutting",
  "washing",
  "sewing",
  "finishing",
]);

interface DepartmentSource {
  Department?: string | null;
}

// Some Operation Codes on the style bulletin have no matching catalog row
// (~9% in production, e.g. ad-hoc/legacy packing codes) — Department comes
// back null for those. Return null rather than guessing; callers should
// treat that as "unknown department", not silently bucket it as Sewing.
export function classifyDepartment(row: DepartmentSource): Department | null {
  const dept = (row.Department || "").toLowerCase().trim();
  return KNOWN_DEPARTMENTS.has(dept as Department) ? (dept as Department) : null;
}
