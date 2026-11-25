// Shared by proxy, server and browser code — must stay dependency-free (no
// node: imports) so it bundles everywhere.

export const REQUEST_ID_HEADER = "x-request-id";

// Accept a caller-supplied id (from the browser's fetch tracing or an
// upstream reverse proxy) only if it looks like an id. Anything else gets
// replaced, so a client can't inject newlines/huge strings into log lines.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

// `crypto.randomUUID` only exists in secure contexts (HTTPS/localhost). This
// app is commonly served over plain HTTP on the factory LAN, so build the id
// from `getRandomValues`, which is available everywhere.
export function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function resolveRequestId(incoming: string | null | undefined): string {
  return incoming && VALID_REQUEST_ID.test(incoming) ? incoming : generateRequestId();
}
