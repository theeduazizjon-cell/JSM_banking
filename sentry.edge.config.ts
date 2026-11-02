// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
