import type { LockedRange, WagePreview, WagesBatch } from "../types";

// Client-side calls to /api/wages. A wage is created from a TENURE alone —
// the server builds the rows, so nothing row-shaped is uploaded from here.

export interface WagePreviewResult extends WagePreview {
  from: string;
  to: string;
  // Set when the tenure collides with an existing wage — the modal warns
  // before the user commits instead of failing them at confirm.
  overlap: { wageId: number; title: string; from: string; to: string } | null;
}

export async function previewWages(params: {
  from: string;
  to: string;
}): Promise<{ ok: true; preview: WagePreviewResult } | { ok: false; error: string }> {
  const qp = new URLSearchParams({ from: params.from, to: params.to });
  const response = await fetch(`/api/wages/preview?${qp.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to preview this tenure." };
  }
  return { ok: true, preview: data };
}

export async function createWages(params: {
  title: string;
  from: string;
  to: string;
  createdBy?: string;
}): Promise<
  | { ok: true; wageId: number; totalRows: number; totalQty: number; totalAmount: number }
  | { ok: false; error: string }
> {
  const response = await fetch("/api/wages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to create wages." };
  }
  return {
    ok: true,
    wageId: data.wageId,
    totalRows: data.totalRows,
    totalQty: data.totalQty,
    totalAmount: data.totalAmount,
  };
}

export async function fetchWages(params: {
  wageId?: number;
  employeeCode?: string;
  title?: string;
  from?: string;
  to?: string;
}): Promise<{ ok: true; wages: WagesBatch[] } | { ok: false; error: string }> {
  const qp = new URLSearchParams();
  if (params.wageId) qp.set("wageId", String(params.wageId));
  if (params.employeeCode) qp.set("employeeCode", params.employeeCode);
  if (params.title) qp.set("title", params.title);
  if (params.from) qp.set("from", params.from);
  if (params.to) qp.set("to", params.to);

  const response = await fetch(`/api/wages?${qp.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch wages." };
  }
  return { ok: true, wages: data.wages ?? [] };
}

export async function deleteWages(params: {
  wageId: number;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const qp = new URLSearchParams({ wageId: String(params.wageId) });
  const response = await fetch(`/api/wages?${qp.toString()}`, {
    method: "DELETE",
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to delete wages." };
  }
  return { ok: true, message: data.message };
}

// Distinct wage titles matching the typed text, for the Wages page's title
// Autocomplete. Failure returns an empty list — worst case the field just
// behaves like a plain text input instead of blocking the search.
export async function fetchWageTitleSuggestions(
  query: string,
): Promise<string[]> {
  try {
    const response = await fetch(
      `/api/wages/suggestions?query=${encodeURIComponent(query)}`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Tenures that already have a wage — used to disable dates in the coupon
// scanning date picker. Failure returns an empty list: the server enforces
// the lock regardless, so a fetch error must not block scanning entirely.
export async function fetchLockedWageRanges(): Promise<LockedRange[]> {
  try {
    const response = await fetch("/api/wages/locked-ranges");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.ranges) ? data.ranges : [];
  } catch {
    return [];
  }
}
