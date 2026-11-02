import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));

const { createRateLimiter, getClientIp, tooManyAttempts } = await import("@/lib/rate-limit");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter", () => {
  it("allows up to the limit, then reports how long to wait", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      expect(limiter.check("a").limited).toBe(false);
      limiter.hit("a");
    }

    vi.advanceTimersByTime(15_000);
    expect(limiter.check("a")).toEqual({ limited: true, retryAfterSeconds: 45 });
  });

  it("keeps keys separate", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a");

    expect(limiter.check("a").limited).toBe(true);
    expect(limiter.check("b").limited).toBe(false);
  });

  it("starts a new window once the old one expires", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a");

    vi.setSystemTime(Date.now() + 60_000);
    expect(limiter.check("a").limited).toBe(false);
  });

  it("can reset a key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit("a");
    limiter.reset("a");

    expect(limiter.check("a").limited).toBe(false);
  });

  it("stays bounded under a flood of distinct keys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    for (let i = 0; i < 20_000; i++) limiter.hit(`key-${i}`);

    // The newest keys are still tracked
    expect(limiter.check("key-19999").limited).toBe(true);
  });
});

describe("tooManyAttempts", () => {
  it("rounds up to whole minutes", () => {
    expect(tooManyAttempts(899)).toBe("Too many attempts. Please try again in 15 minute(s).");
    expect(tooManyAttempts(5)).toBe("Too many attempts. Please try again in 1 minute(s).");
  });
});

describe("getClientIp", () => {
  it("uses the first address in X-Forwarded-For", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    await expect(getClientIp()).resolves.toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP, then a shared bucket", async () => {
    requestHeaders.current = new Headers({ "x-real-ip": "203.0.113.8" });
    await expect(getClientIp()).resolves.toBe("203.0.113.8");

    requestHeaders.current = new Headers();
    await expect(getClientIp()).resolves.toBe("unknown");
  });
});
