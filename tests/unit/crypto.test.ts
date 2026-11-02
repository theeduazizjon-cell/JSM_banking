import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/crypto";

// Deliberately not shaped like a real Plaid token, so secret scanners stay quiet
const TOKEN = "fake-plaid-access-token-for-tests";

describe("token encryption", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  });

  it("round-trips a token", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it("never stores the plaintext", () => {
    const encrypted = encryptSecret(TOKEN);

    expect(encrypted.startsWith("enc:v1:")).toBe(true);
    expect(encrypted).not.toContain(TOKEN);
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret(TOKEN)).not.toBe(encryptSecret(TOKEN));
  });

  it("detects tampering", () => {
    const encrypted = encryptSecret(TOKEN);
    const data = Buffer.from(encrypted.slice("enc:v1:".length), "base64");
    data[data.length - 1] ^= 1;

    expect(() => decryptSecret(`enc:v1:${data.toString("base64")}`)).toThrow();
  });

  it("refuses to decrypt with a different key", () => {
    const encrypted = encryptSecret(TOKEN);
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("passes through tokens saved before encryption existed", () => {
    expect(decryptSecret(TOKEN)).toBe(TOKEN);
  });

  it.each(["", "too-short", randomBytes(16).toString("base64")])("rejects the key %j", (key) => {
    vi.stubEnv("ENCRYPTION_KEY", key);

    expect(() => encryptSecret(TOKEN)).toThrow(/ENCRYPTION_KEY must be a base64-encoded 32-byte key/);
  });
});
