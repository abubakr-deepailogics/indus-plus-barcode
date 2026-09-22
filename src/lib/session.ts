import { createHmac, timingSafeEqual } from "crypto";
import type { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "pits_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export type SessionPayload = {
  userId: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  mustResetPassword: boolean;
  exp: number; // epoch ms
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET env var");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

// Sets the session cookie consistently across every route that issues one
// (login, change-password). `secure` must reflect the actual request
// protocol, not NODE_ENV — browsers silently drop `Secure` cookies set over
// plain HTTP, which breaks login entirely on a production deployment that
// isn't served over TLS (e.g. an on-prem/internal-network deployment).
export async function setSessionCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  token: string,
  requestUrl: string,
): Promise<void> {
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(requestUrl).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}
