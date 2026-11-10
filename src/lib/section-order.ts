// Fixed section display/sort order used across reports, wages, and cut
// planning: Small Parts, then Back, then Front, then Assembly. No other
// ordering (alphabetical, by amount, etc.) should be applied to sections.
//
// Matched by substring, not exact equality — real section names vary
// ("Small Part", "Back Section", "Front Section", "Assembly", etc.), so an
// exact-match lookup silently fails and falls through to the alphabetical
// fallback below.
const SECTION_ORDER = ["small part", "back", "front", "assembly"] as const;

function sectionRank(section: string | null | undefined): number {
  const normalized = (section ?? "").trim().toLowerCase();
  const index = SECTION_ORDER.findIndex((name) => normalized.includes(name));
  return index === -1 ? SECTION_ORDER.length : index;
}

// Comparator for Array.prototype.sort — unrecognized section names sort
// after the fixed four, alphabetically among themselves.
export function compareSectionOrder(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const rankDiff = sectionRank(a) - sectionRank(b);
  if (rankDiff !== 0) return rankDiff;
  return (a ?? "").localeCompare(b ?? "");
}
