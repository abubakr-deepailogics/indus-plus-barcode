// Cut # is free text typed by people ("1 F1", "1F1", "1f1" all mean the same
// cut), so every comparison goes through one canonical form: all whitespace
// stripped, upper-cased. Kept in JS and SQL flavours so lookups and WHERE
// clauses agree exactly.

export function normalizeCutNo(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

// SQL equivalent of normalizeCutNo for a column/expression. Strips spaces,
// tabs and non-breaking spaces (the whitespace that realistically ends up in
// typed/pasted cut numbers). Compare it against a normalizeCutNo()'d param.
export function normalizedCutSql(expr: string): string {
  return `UPPER(REPLACE(REPLACE(REPLACE(${expr}, N' ', N''), NCHAR(9), N''), NCHAR(160), N''))`;
}

// WHERE fragment for "column is on the `bound` side of @param" using the same
// alphanumeric order cut ranges have always used: by length, then
// lexically ("9" < "10", "T0002451" < "T0002460"). Bind the parameter value through
// normalizeCutNo too.
export function cutBoundSql(
  column: string,
  param: string,
  bound: "from" | "to",
): string {
  const col = normalizedCutSql(column);
  const p = `@${param}`;
  return bound === "from"
    ? `(LEN(${col}) > LEN(${p}) OR (LEN(${col}) = LEN(${p}) AND ${col} >= ${p}))`
    : `(LEN(${col}) < LEN(${p}) OR (LEN(${col}) = LEN(${p}) AND ${col} <= ${p}))`;
}
