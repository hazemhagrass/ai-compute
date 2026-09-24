/** Tests for lib/provider-keys.ts (issue #156). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "amr-keys-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "keys.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const keys = await import("./provider-keys");
const repo = await import("./repo");

let providerId: number;

beforeAll(() => {
  const p = repo.createProvider({
    name: "Scratch OpenAI",
    baseUrl: "https://api.openai.com/v1",
    authType: "bearer",
  });
  providerId = p.id;
});

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true });
});

describe("provider keys", () => {
  it("adds a key with a preview and no plaintext leak", () => {
    const k = keys.addProviderKey(providerId, "sk-abcdef123456", "personal", false);
    expect(k.label).toBe("personal");
    expect(k.active).toBe(false);
    // preview shows only the first + last few chars of the key
    expect(k.keyPreview).not.toBe("sk-abcdef123456");
    expect(k.keyPreview).toContain("•");
    // full plaintext must never appear in the preview
    expect(k.keyPreview).not.toContain("abcdef");
  });

  it("activate deactivates every other key on the same provider", () => {
    const a = keys.addProviderKey(providerId, "sk-aaaaaaaaaaaa", "a", true);
    const b = keys.addProviderKey(providerId, "sk-bbbbbbbbbbbb", "b", false);
    keys.activateProviderKey(b.id);
    const list = keys.listProviderKeys(providerId);
    expect(list.find((k) => k.id === a.id)?.active).toBe(false);
    expect(list.find((k) => k.id === b.id)?.active).toBe(true);
    // exactly one active per provider
    expect(list.filter((k) => k.active)).toHaveLength(1);
  });

  it("activate rewrites providers.api_key_enc so the chat path sees it", () => {
    const c = keys.addProviderKey(providerId, "sk-ccccccccccccc", "c", true);
    // repo.getProviderSecret uses the mirror on providers.api_key_enc
    expect(repo.getProviderSecret(providerId)).toBe("sk-ccccccccccccc");
    expect(keys.revealProviderKey(c.id)).toBe("sk-ccccccccccccc");
  });

  it("deleting the active key promotes another and never leaves a stale mirror", () => {
    const list = keys.listProviderKeys(providerId);
    const active = list.find((k) => k.active)!;
    const other = list.find((k) => !k.active)!;
    keys.deleteProviderKey(active.id);
    const after = keys.listProviderKeys(providerId);
    expect(after.map((k) => k.id)).not.toContain(active.id);
    expect(after.find((k) => k.id === other.id)?.active).toBe(true);
    // mirror updated
    expect(repo.getProviderSecret(providerId)).toBe(keys.revealProviderKey(other.id));
  });

  it("deleting the last key clears providers.api_key_enc rather than reusing stale bytes", () => {
    for (const k of keys.listProviderKeys(providerId)) {
      keys.deleteProviderKey(k.id);
    }
    expect(keys.listProviderKeys(providerId)).toHaveLength(0);
    expect(repo.getProviderSecret(providerId)).toBe("");
  });

  it("verification records both success and error", () => {
    const k = keys.addProviderKey(providerId, "sk-dddddddddddd", "d", true);
    keys.recordKeyVerification(k.id, true, "");
    let got = keys.getProviderKey(k.id)!;
    expect(got.lastVerifyOk).toBe(true);
    expect(got.lastVerifiedAt).not.toBe("");

    keys.recordKeyVerification(k.id, false, "401 unauthorized");
    got = keys.getProviderKey(k.id)!;
    expect(got.lastVerifyOk).toBe(false);
    expect(got.lastVerifyError).toBe("401 unauthorized");
  });
});
