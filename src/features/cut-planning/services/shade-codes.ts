// Pure (no DB/server imports) so the Cut Planning page and the server's
// generateBundles split shades identically.

export const SHADE_DELIMITER = "-";

/** "A1-B1-C1" → ["A1", "B1", "C1"]; blanks/duplicates dropped; empty → ["UNSHADED"]. */
export function splitShadeCodes(value: unknown): string[] {
  const shades = String(value ?? "")
    .toUpperCase()
    .split(SHADE_DELIMITER)
    .map((shade) => shade.trim())
    .filter(Boolean);
  return shades.length ? [...new Set(shades)] : ["UNSHADED"];
}
