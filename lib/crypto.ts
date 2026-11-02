import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Plaid access tokens grant ongoing access to a user's bank data, so they are
// encrypted with AES-256-GCM before being written to Appwrite.
const PREFIX = "enc:v1:";

const getKey = () => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");

  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a base64-encoded 32-byte key. Generate one with `openssl rand -base64 32`."
    );
  }

  return key;
};

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSecret(value: string) {
  // Tokens saved before encryption was introduced are stored as plaintext
  if (!value.startsWith(PREFIX)) return value;

  const data = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));

  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}
