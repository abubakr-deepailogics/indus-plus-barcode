import { emit } from "./logger";

/**
 * Records a business-significant action (who did what, to which record) in
 * the audit log: logs/audit-YYYY-MM-DD.log, kept LOG_AUDIT_RETENTION_DAYS
 * (default 365) and never filtered by LOG_LEVEL. The acting user and
 * requestId come from the request context automatically.
 *
 * Use a dotted `action` name ("coupon.delete", "user.create") and put the
 * affected identifiers in `details`. Never put passwords/tokens in details
 * (sensitive keys are redacted anyway).
 */
export function audit(action: string, details?: Record<string, unknown>): void {
  emit("info", `audit: ${action}`, { ...details, audit: true, action }, {}, "audit");
}
