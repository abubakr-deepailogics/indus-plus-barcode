// Deterministic per-coupon ID: same work order + bundle + operation always
// produces the same code, so reprinting a coupon never changes its identity
// and re-generating a batch can dedupe against what's already in the DB.
//
// Work order digits are duplicated inside the bundle no (e.g. work order
// "W/O-003355" + bundle "33550001", where "3355" is just the work order's
// digits and "0001" is the real per-bundle sequence) — stripping that
// repeated prefix keeps the coupon code from embedding the same number
// twice.
// Strips the work order's digits from the front of a bundle number when
// they're duplicated there (see module comment) — shared with the coupon
// PDF card, which prints the bundle number on its own and needs it short
// without re-deriving the same regex.
export function trimBundleNo(workOrder: string, bundleNo: string): string {
  const workOrderDigits = workOrder.replace(/\D/g, "").replace(/^0+/, "");
  // Normal ERP bundle: "2653001" → strip "2653" → "001"
  if (workOrderDigits && bundleNo.startsWith(workOrderDigits)) {
    return bundleNo.slice(workOrderDigits.length);
  }
  // Rework bundle: "RW002653001" → strip "RW002653" → keep "RW" + "001" = "RW001"
  // Raw WO digits preserve leading zeros (e.g. "002653"), unlike workOrderDigits
  // which strips them. We check the raw-digit prefix embedded inside the bundle.
  const workOrderRawDigits = workOrder.replace(/\D/g, ""); // "002653"
  const rwPrefix = `RW${workOrderRawDigits}`;             // "RW002653"
  if (workOrderRawDigits && bundleNo.startsWith(rwPrefix)) {
    return `RW${bundleNo.slice(rwPrefix.length)}`;        // "RW001"
  }
  return bundleNo;
}

export function buildCouponCode(workOrder: string, bundleNo: string, opNo: string): string {
  const workOrderDigits = workOrder.replace(/\D/g, "").replace(/^0+/, "");
  const trimmedBundleNo = trimBundleNo(workOrder, bundleNo);
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
    // rework bundle: RW+rawWODigits+seq → strips to RW+seq in barcode
    [["W/O-002653", "RW002653001", "OP1"], "2653-RW001-OP1"],
    [["W/O-001935", "RW001935002", "OP1"], "1935-RW002-OP1"],
  ];
  for (const [args, expected] of cases) {
    const actual = buildCouponCode(...args);
    console.assert(actual === expected, `buildCouponCode(${args.join(", ")}) = ${actual}, expected ${expected}`);
  }
  console.log("coupon-code demo OK");
}
