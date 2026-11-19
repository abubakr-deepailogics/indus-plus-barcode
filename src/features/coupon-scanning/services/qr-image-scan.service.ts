// Server-only. Forwards a coupon-sheet photo to the Python qr-scanner-backend
// (QR_SCANNER_URL), which returns every QR code text on it in reading order,
// plus where each one is (and where unreadable ones are) in the photo.

import type { PhotoScan } from "../types";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // matches the backend's MAX_IMAGE_SIZE_MB default

// MIME → extension; the backend validates uploads by file extension.
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

const SCANNER_TIMEOUT_MS = 60_000;

export async function readQrCodesFromImage(
  file: File,
): Promise<({ ok: true } & PhotoScan) | { ok: false; status: number; error: string }> {
  const baseUrl = process.env.QR_SCANNER_URL;
  if (!baseUrl) {
    return { ok: false, status: 500, error: "QR scanner service is not configured (QR_SCANNER_URL)." };
  }

  const body = new FormData();
  body.append("file", file, `scan.${IMAGE_EXTENSIONS[file.type]}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/scan`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SCANNER_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut ? "QR scanner service timed out." : "QR scanner service is unavailable.",
    };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 4xx = bad image (backend's message is user-facing); 5xx = backend fault.
    return response.status < 500
      ? { ok: false, status: 400, error: typeof data.detail === "string" ? data.detail : "Unable to read the image." }
      : { ok: false, status: 502, error: "QR scanner service failed to process the image." };
  }
  const found: PhotoScan["found"] = Array.isArray(data.found) ? data.found : [];
  return {
    ok: true,
    codes: Array.isArray(data.qr_codes) ? data.qr_codes.map(String) : found.map((f) => String(f.text)),
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    found,
    missed: Array.isArray(data.missed) ? data.missed : [],
  };
}
