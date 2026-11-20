// Pure (no DB/server imports) so the Cut Planning preview and the server's
// generateBundles assign the exact same numbers.

/** The `count` lowest positive numbers not in `used`, ascending. */
export function lowestFreeSequences(used: Iterable<number>, count: number): number[] {
  const taken = new Set(used);
  const free: number[] = [];
  for (let n = 1; free.length < count; n += 1) {
    if (!taken.has(n)) free.push(n);
  }
  return free;
}

export const formatBundleId = (sequence: number) => String(sequence).padStart(4, "0");
