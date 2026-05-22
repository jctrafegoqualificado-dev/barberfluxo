import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? "";
    if (msg.includes("UNAUTHORIZED") || msg.includes("FORBIDDEN")) return null;
    return event;
  },
});
