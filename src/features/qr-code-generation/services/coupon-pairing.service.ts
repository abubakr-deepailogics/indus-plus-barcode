import type { BundleDetailRow, OperationsDetailRow } from "../types";

export interface CouponCard {
  bundle: BundleDetailRow;
  op: OperationsDetailRow;
}

/**
 * Builds one coupon card per bundle per operation (full cross product of
 * whatever bundles/operations are passed in — callers decide how many
 * operations belong in the run, e.g. rework-coupon can pass just one or
 * all of them). Cards are ordered
 * operation-major: all cards for op1 (across every bundle, cut-sorted)
 * come first, then all cards for op2, etc. Within an operation, bundles
 * are cut-major (grouped by `cutNo`, sorted ascending). Input order is
 * not relied upon — the DB query has no guaranteed ORDER BY on cut, but
 * operations are expected pre-sorted by Operation_Sequence (done at the
 * fetch layer).
 *
 * Example: cut1 has B1,B2 / cut2 has B3, operations op1,op2 →
 *   op1: B1-op1, B2-op1, B3-op1
 *   op2: B1-op2, B2-op2, B3-op2
 */
export function buildCouponCards(
  bundles: BundleDetailRow[],
  operations: OperationsDetailRow[],
): CouponCard[] {
  if (bundles.length === 0 || operations.length === 0) return [];

  const sortedBundles = bundles
    .slice()
    .sort((a, b) => a.cutNo.localeCompare(b.cutNo, undefined, { numeric: true }));

  return operations.flatMap((op) =>
    sortedBundles.map((bundle) => ({ bundle, op })),
  );
}

// ponytail self-check (not auto-run — this file is bundled into client code).
// Verify by pasting `demo()` into a scratch script, e.g.:
//   npx tsx -e "import('./coupon-pairing.service').then(m => m.demo())"
export function demo() {
  const bundle = (cutNo: string, bundleNo: string): BundleDetailRow => ({
    id: Number(bundleNo.slice(1)),
    cutNo,
    line: "1",
    bundleNo,
    inseam: "0",
    size: "M",
    pcs: 1,
    sel: true,
    code: "X",
  });
  const op = (id: number): OperationsDetailRow => ({
    id,
    section: "",
    seqNo: String(id),
    opNo: String(id),
    operationName: `OP${id}`,
    smv: "0",
    rate: "0",
    skills: "",
    lastOpSection: false,
  });

  // Bundles arrive out of cut order to prove the grouping sort works.
  const bundles = [
    bundle("cut2", "B3"),
    bundle("cut1", "B1"),
    bundle("cut1", "B2"),
  ];
  const operations = [op(1), op(2)];

  const cards = buildCouponCards(bundles, operations);
  const actual = cards.map((c) => `${c.bundle.bundleNo}:${c.op.operationName}`);
  const expected = [
    "B1:OP1", "B2:OP1", "B3:OP1",
    "B1:OP2", "B2:OP2", "B3:OP2",
  ];
  console.assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `buildCouponCards mismatch: got ${JSON.stringify(actual)}`,
  );
  console.assert(
    cards.length === bundles.length * operations.length,
    `expected full cross product (${bundles.length * operations.length}), got ${cards.length}`,
  );
  console.log("coupon-pairing demo OK:", actual);
}
