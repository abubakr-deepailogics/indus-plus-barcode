// The pay cycle runs 24th → 23rd, not the calendar month — same boundary the
// "This Month" date-range preset and the Order Wise/Operator Wise finance
// reports use. Client-safe mirror of db.ts's currentPayCycleStart (that one
// lives beside the server-only DB pool and can't be imported client-side).
export function currentPayCycleStart(): Date {
  const now = new Date();
  const day = now.getDate();
  const cycleMonth = day >= 24 ? now.getMonth() : now.getMonth() - 1;
  return new Date(now.getFullYear(), cycleMonth, 24);
}
