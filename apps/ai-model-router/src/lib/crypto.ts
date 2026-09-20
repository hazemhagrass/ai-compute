import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./paths";

const ALGO = "aes-256-gcm";
let cachedKey: Buffer | null = null;

/**
 * Master key resolution order:
 *  1. AMR_SECRET env var (recommended for hosted deployments)
 *  2. <DATA_DIR>/.secret  (auto-generated, chmod 600)
 */
function masterSecret(): string {
  const fromEnv = process.env.AMR_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const file = path.join(DATA_DIR, ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(48).toString("base64url");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort on non-posix */
  }
  return generated;
}

function key(): Buffer {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(masterSecret(), "ai-model-router.v1", 32);
  }
  return cachedKey;
}

/** Encrypt a secret to a self-describing `v1.<iv>.<tag>.<ct>` string. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Decrypt a value produced by `encryptSecret`. Returns "" on any failure. */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ct = Buffer.from(parts[3], "base64url");
    const decipher = crypto.createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** `sk-abcd…wxyz` style preview that never reveals a usable secret. */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 10) return `${plain.slice(0, 2)}${"•".repeat(6)}`;
  return `${plain.slice(0, 5)}${"•".repeat(8)}${plain.slice(-4)}`;
}
