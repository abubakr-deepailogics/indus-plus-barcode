import type { BundleDetailRow } from "../types";

// Display-only: renumbers bundles 1, 2, 3... within each cut, in the order
// given (bundles are already sorted cut-major/bundle-minor before this is
// called — see useQrCodeGenerationFacade). The real bundleNo is untouched
// everywhere else (coupon code, DB, PDF payload) — this is purely what's
// shown to a user instead of the raw Bundle_Id.
export function getBundleDisplayNos(bundles: BundleDetailRow[]): Map<number, number> {
  const counters = new Map<string, number>();
  const displayNos = new Map<number, number>();
  for (const b of bundles) {
    const next = (counters.get(b.cutNo) || 0) + 1;
    counters.set(b.cutNo, next);
    displayNos.set(b.id, next);
  }
  return displayNos;
}

// ponytail self-check (not auto-run). Verify with:
//   npx tsx -e "import('./bundle-display').then(m => m.demo())"
export function demo() {
  const rows = [
    { id: 1, cutNo: "1", bundleNo: "3330001" },
    { id: 2, cutNo: "1", bundleNo: "3330002" },
    { id: 3, cutNo: "1", bundleNo: "3330003" },
    { id: 4, cutNo: "2", bundleNo: "3330007" },
    { id: 5, cutNo: "2", bundleNo: "3330008" },
  ] as BundleDetailRow[];
  const result = getBundleDisplayNos(rows);
  const expected = [1, 2, 3, 1, 2];
  rows.forEach((r, i) => {
    console.assert(
      result.get(r.id) === expected[i],
      `bundle id ${r.id} = ${result.get(r.id)}, expected ${expected[i]}`,
    );
  });
  console.log("bundle-display demo OK");
}
