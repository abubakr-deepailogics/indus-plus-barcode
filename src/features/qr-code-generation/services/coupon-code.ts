// Deterministic per-coupon ID: same work order + bundle + operation always
// produces the same code, so reprinting a coupon never changes its identity
// and re-generating a batch can dedupe against what's already in the DB.
//
// Work order digits are duplicated inside the bundle no (e.g. work order
// "W/O-003355" + bundle "33550001", where "3355" is just the work order's
// digits and "0001" is the real per-bundle sequence) — stripping that
// repeated prefix keeps the coupon code from embedding the same number
// twice.
export function buildCouponCode(workOrder: string, bundleNo: string, opNo: string): string {
  const workOrderDigits = workOrder.replace(/\D/g, "").replace(/^0+/, "");
  const trimmedBundleNo =
    workOrderDigits && bundleNo.startsWith(workOrderDigits)
      ? bundleNo.slice(workOrderDigits.length)
      : bundleNo;
  return `${workOrderDigits || workOrder}-${trimmedBundleNo}-${opNo}`;
}

// ponytail self-check (not auto-run). Verify with:
//   npx tsx -e "import('./coupon-code').then(m => m.demo())"
export function demo() {
  const cases: [[string, string, string], string][] = [
    // repeated work-order digits get stripped from the bundle
    [["W/O-003355", "33550001", "OP1"], "3355-0001-OP1"],
    // no repetition present — bundle passes through untouched
    [["W/O-003355", "0001", "OP1"], "3355-0001-OP1"],
    // no digits in work order at all — falls back to the raw string
    [["WO-ABC", "ABC0001", "OP1"], "WO-ABC-ABC0001-OP1"],
  ];
  for (const [args, expected] of cases) {
    const actual = buildCouponCode(...args);
    console.assert(actual === expected, `buildCouponCode(${args.join(", ")}) = ${actual}, expected ${expected}`);
  }
  console.log("coupon-code demo OK");
}
