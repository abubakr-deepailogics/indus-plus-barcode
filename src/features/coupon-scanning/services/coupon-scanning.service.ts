import type { CouponApiItem, Worker, OperationSuggestion } from "../types";

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

export function fetchWorkerSuggestions(query: string): Promise<Worker[]> {
  return getJson<Worker[]>(
    `/api/workers?query=${encodeURIComponent(query)}`,
  ).then((data) => data ?? []);
}

export function fetchWorkerByCode(code: string): Promise<Worker | null> {
  return getJson<Worker>(`/api/workers?code=${encodeURIComponent(code)}`);
}

export function fetchWorkOrderSuggestions(query: string): Promise<string[]> {
  return getJson<string[]>(
    `/api/open-order/suggestions?query=${encodeURIComponent(query)}&only_generated=true`,
  ).then((data) => data ?? []);
}

function fetchCouponSuggestions(
  workOrder: string,
  type: "bundle" | "operation" | "cut",
  query: string,
  onlyGenerated: boolean,
) {
  const suffix = onlyGenerated ? "&only_generated=true" : "";
  return getJson<unknown[]>(
    `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=${type}&query=${encodeURIComponent(query)}${suffix}`,
  ).then((data) => data ?? []);
}

export function fetchBundleSuggestions(workOrder: string, query: string) {
  return fetchCouponSuggestions(workOrder, "bundle", query, true);
}

export function fetchOpSuggestions(
  workOrder: string,
  query: string,
): Promise<OperationSuggestion[]> {
  return fetchCouponSuggestions(
    workOrder,
    "operation",
    query,
    true,
  ) as Promise<OperationSuggestion[]>;
}

export function fetchCutSuggestions(workOrder: string, query: string) {
  return fetchCouponSuggestions(
    workOrder,
    "cut",
    query,
    false,
  ) as Promise<string[]>;
}

// Step 1: "Fetch Info" — looks up matching coupons without marking them
// scanned. Either a raw coupon code or a work order + filters combo.
export async function fetchCouponInfo(params: {
  couponCode?: string;
  workOrder?: string;
  opNo?: string;
  fromCut?: string;
  toCut?: string;
}): Promise<{ ok: true; items: CouponApiItem[] } | { ok: false; error: string }> {
  const { couponCode, workOrder, opNo, fromCut, toCut } = params;
  const url = couponCode?.trim()
    ? `/api/coupons/scan?mode=fetch&barcode=${encodeURIComponent(couponCode.trim())}`
    : `/api/coupons/scan?mode=fetch&wo=${encodeURIComponent(workOrder ?? "")}&op=${encodeURIComponent(opNo ?? "")}&fromCut=${encodeURIComponent(fromCut ?? "")}&toCut=${encodeURIComponent(toCut ?? "")}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch coupon info." };
  }
  return { ok: true, items: Array.isArray(data) ? data : [data] };
}

// Step 2: marks a single coupon as scanned in the database.
export async function scanCoupon(params: {
  barcode: string;
  workOrder?: string;
  employeeCode: string;
  scanBy: string;
  scanDate: string;
}): Promise<{ ok: true; item: CouponApiItem } | { ok: false; error: string }> {
  const { barcode, workOrder, employeeCode, scanBy, scanDate } = params;
  const woParam = workOrder ? `&wo=${encodeURIComponent(workOrder)}` : "";
  const response = await fetch(
    `/api/coupons/scan?barcode=${encodeURIComponent(barcode)}${woParam}&employeeCode=${encodeURIComponent(employeeCode)}&scanBy=${encodeURIComponent(scanBy)}&scanDate=${encodeURIComponent(scanDate)}`,
  );
  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to scan coupon." };
  }
  const items = Array.isArray(data) ? data : [data];
  return { ok: true, item: items[0] || {} };
}

// Batch version of scanCoupon — one request for a whole burst of scanner-gun
// codes instead of one request per code. Returns full row detail for every
// code that was actually flipped to scanned, plus the codes that weren't
// (already scanned / not found) so the caller can flag them without a
// second round trip.
export async function scanCouponsBatch(params: {
  barcodes: string[];
  employeeCode: string;
  scanBy: string;
  scanDate: string;
}): Promise<
  | { ok: true; scanned: CouponApiItem[]; failed: string[] }
  | { ok: false; error: string }
> {
  const response = await fetch("/api/coupons/scan/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to scan coupons." };
  }
  return { ok: true, scanned: data.scanned ?? [], failed: data.failed ?? [] };
}

export async function unscanCoupon(
  couponCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch("/api/coupons/unscan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ couponCode }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to unscan coupon." };
  }
  return { ok: true };
}
