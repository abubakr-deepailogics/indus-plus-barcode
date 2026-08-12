// Deterministic per-coupon ID: same work order + bundle + operation always
// produces the same code, so reprinting a coupon never changes its identity
// and re-generating a batch can dedupe against what's already in the DB.
export function buildCouponCode(workOrder: string, bundleNo: string, opNo: string): string {
  return `${workOrder}-${bundleNo}-${opNo}`;
}
