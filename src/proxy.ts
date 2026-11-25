import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/logger/request-id";

// Gives every request (pages, RSC payloads, API) a correlation id before it
// reaches the app: reused from the browser's fetch tracing / an upstream
// proxy when valid, generated otherwise. Forwarded to the handler as a
// request header (read by withRoute and onRequestError) and echoed on the
// response so a failing call can be matched to its server log lines.
// Keep this tiny — it runs on every request.
export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  // Skip static assets — nothing to trace there.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpe?g|gif|svg|webp|ico|mp3|wav|ttf|otf|woff2?|css|js|map)$).*)",
  ],
};
