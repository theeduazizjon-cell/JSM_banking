// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample every trace locally, 10% in production to stay within quota
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // This is a banking app: request bodies carry passwords and SSNs, outgoing
  // Plaid/Dwolla calls carry API secrets and access tokens, and cookies hold
  // the session. None of it may leave the server.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
  dataCollection: {
    userInfo: false,
    httpBodies: [],
    cookies: false,
    httpHeaders: { deny: ["authorization", "cookie", "set-cookie", "plaid-secret", "plaid-client-id"] },
  },
});
