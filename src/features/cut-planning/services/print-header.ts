import type { CutPlanningBomItem } from "../types";

// Pure helpers for the "SIZE DETAIL & CHECK LIST" print header. Kept free of
// DB/React imports so both the server (building metadata) and the client
// (re-picking the fabric when the user switches it) can use them.

const POCKETING_GROUP = "POCKET LINING";

const normalize = (value: string) => value.trim().toUpperCase();

/**
 * The main-body fabric: the highest-consumption FABRIC item that isn't
 * pocket lining. Falls back to the first fabric item when every item is
 * pocket lining or consumption is missing.
 */
export function pickMainFabric(fabricItems: CutPlanningBomItem[]): CutPlanningBomItem | null {
  if (fabricItems.length === 0) return null;
  const bodyItems = fabricItems.filter((item) => normalize(item.groupName) !== POCKETING_GROUP);
  const candidates = bodyItems.length > 0 ? bodyItems : fabricItems;
  return candidates.reduce((best, item) =>
    (item.consumption ?? -1) > (best.consumption ?? -1) ? item : best,
  );
}

/** Fabric items other than the main fabric: pocketing, piping, linings. */
export function pickPocketingFabrics(
  fabricItems: CutPlanningBomItem[],
  mainFabricName: string,
): string[] {
  const main = normalize(mainFabricName);
  return [...new Set(
    fabricItems
      .filter((item) => normalize(item.itemName) !== main)
      .map((item) => item.itemName),
  )];
}

/**
 * Most size columns one landscape print page holds with 3-digit quantities
 * still readable (about 4 inseams of ~11 sizes).
 */
export const PRINT_MAX_SIZE_COLUMNS_PER_PAGE = 44;

/**
 * Splits inseam groups into print pages, in their original order. A group is
 * never split across pages, so every size of one inseam stays together; a
 * single group wider than the limit still gets its own page rather than
 * being dropped. Every input group lands on exactly one page.
 */
export function chunkInseamGroupsForPrint<T extends { sizeColumns: string[] }>(
  groups: T[],
  maxSizeColumns = PRINT_MAX_SIZE_COLUMNS_PER_PAGE,
): T[][] {
  const pages: T[][] = [];
  let current: T[] = [];
  let currentColumns = 0;
  for (const group of groups) {
    const columns = group.sizeColumns.length;
    if (current.length > 0 && currentColumns + columns > maxSizeColumns) {
      pages.push(current);
      current = [];
      currentColumns = 0;
    }
    current.push(group);
    currentColumns += columns;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/** "0.25 YDS" style text for BOM averages; distinct values joined by " / ". */
export function formatBomAverage(items: CutPlanningBomItem[]): string {
  return [...new Set(
    items
      .filter((item) => item.consumption != null)
      .map((item) => `${item.consumption}${item.uom ? ` ${item.uom}` : ""}`),
  )].join(" / ");
}

