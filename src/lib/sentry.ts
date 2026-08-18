import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** No-ops safely if VITE_SENTRY_DSN isn't set (local dev, PR previews without a DSN configured). */
export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
    // Session replay is intentionally omitted — this app renders machine
    // photos, fault reports, and other tenant-sensitive content, and
    // replay would capture that. Revisit with masking config if replay
    // is wanted later.
    ignoreErrors: [
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
  });
}

/** Call once auth resolves so errors are attributable to a user/org without logging PII beyond id + org. */
export function setSentryUser(user: { id: string; email?: string | null } | null, organisationId?: string | null) {
  if (!dsn) return;
  if (!user) {
    Sentry.setUser(null);
    Sentry.setTag("organisation_id", null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  if (organisationId) Sentry.setTag("organisation_id", organisationId);
}

export function captureReactError(error: Error, componentStack?: string | null) {
  if (!dsn) return;
  Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
}
