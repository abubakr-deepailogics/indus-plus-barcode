// The print header's GROUP table: one line per shade used on the marker rows,
// all calculated from the plan (nothing typed in).
//   FABRIC = metres used by the group's rows (MK length x plys)
//   PCS    = pieces in the group's rows (ratio x plys)
// A row belongs to a group when its Shade matches exactly (trimmed, case-
// insensitive): shade "AD" is group "AD", not "A" or "D". Rows without a
// shade are grouped under "-" so they still reach the totals.

export type ShadeGroupSummary = {
  shadeGroup: string;
  fabricMetres: number;
  pcs: number;
};

export type ShadeGroupTable = {
  rows: ShadeGroupSummary[];
  totals: { fabricMetres: number; pcs: number };
};

/** Canonical group key: trimmed, single-spaced, upper-case. "" = no shade. */
export function shadeGroupKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function summarizeShadeGroups(
  markerRows: Array<{ shade: string; fabricMetres: number | null; pcs: number }>,
): ShadeGroupTable {
  const groups = new Map<string, ShadeGroupSummary>();
  for (const row of markerRows) {
    const shadeGroup = shadeGroupKey(row.shade) || "-";
    const group = groups.get(shadeGroup) ?? { shadeGroup, fabricMetres: 0, pcs: 0 };
    group.fabricMetres += row.fabricMetres ?? 0;
    group.pcs += row.pcs;
    groups.set(shadeGroup, group);
  }
  const rows = [...groups.values()].sort((a, b) =>
    a.shadeGroup === "-" ? 1 : b.shadeGroup === "-" ? -1
      : a.shadeGroup.localeCompare(b.shadeGroup, undefined, { numeric: true }),
  );
  return {
    rows,
    totals: {
      fabricMetres: rows.reduce((sum, row) => sum + row.fabricMetres, 0),
      pcs: rows.reduce((sum, row) => sum + row.pcs, 0),
    },
  };
}
