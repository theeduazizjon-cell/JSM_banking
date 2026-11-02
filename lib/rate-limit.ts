import "server-only";

import { headers } from "next/headers";

// Fixed-window counters kept in this server's memory. Appwrite does not rate
// limit requests made with an API key, so without this nothing would stop
// password guessing through signIn. Each server instance keeps its own
// counters, so on a multi-instance deployment move this to a shared store
// (for example Redis) to make the limits global.

type Bucket = { count: number; resetAt: number };

const MAX_KEYS = 10_000;

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  const current = (key: string, now: number) => {
    const bucket = buckets.get(key);

    if (bucket && bucket.resetAt <= now) {
      buckets.delete(key);
      return undefined;
    }

    return bucket;
  };

  // Drop expired windows first, then the oldest keys, so memory stays bounded
  const prune = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }

    for (const key of buckets.keys()) {
      if (buckets.size < MAX_KEYS) break;
      buckets.delete(key);
    }
  };

  return {
    // Whether `key` has used up its attempts, and for how long
    check(key: string) {
      const now = Date.now();
      const bucket = current(key, now);

      return bucket && bucket.count >= limit
        ? { limited: true as const, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
        : { limited: false as const };
    },

    hit(key: string) {
      const now = Date.now();
      const bucket = current(key, now);

      if (bucket) {
        bucket.count++;
        return;
      }

      if (buckets.size >= MAX_KEYS) prune(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    },

    reset(key: string) {
      buckets.delete(key);
    },

    clear() {
      buckets.clear();
    },
  };
}

export const tooManyAttempts = (retryAfterSeconds: number) =>
  `Too many attempts. Please try again in ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s).`;

// The caller's IP as reported by the hosting platform's proxy. Behind no
// proxy the header can be set by the client, which is why sign-in is also
// limited per email address.
export async function getClientIp() {
  const headerList = await headers();

  return headerList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headerList.get("x-real-ip")
    || "unknown";
}
