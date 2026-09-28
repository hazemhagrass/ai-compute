/** Tests for lib/provider-keys.ts (issue #156). */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";

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
    // first key of a provider is auto-activated (see addProviderKey)
    expect(k.active).toBe(true);
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

  it("first key for a provider auto-activates even when activate=false", () => {
    const p = repo.createProvider({
      name: "Auto activate",
      baseUrl: "https://example.invalid/v1",
      authType: "bearer",
    });
    const k1 = keys.addProviderKey(p.id, "sk-first-000001", "first", false);
    expect(k1.active).toBe(true);
    // the provider row now has a usable key too
    expect(repo.getProviderSecret(p.id)).toBe("sk-first-000001");
    // a second key stays inactive unless asked
    const k2 = keys.addProviderKey(p.id, "sk-second-00002", "second", false);
    expect(k2.active).toBe(false);
    expect(keys.listProviderKeys(p.id).filter((x) => x.active)).toHaveLength(1);
  });
});

describe("verifyProviderKey (#162)", () => {
  let pid2: number;
  let keyIds: number[] = [];

  beforeAll(() => {
    const p = repo.createProvider({
      name: "Verify Probe",
      baseUrl: "https://verify.example/v1",
      authType: "bearer",
    });
    pid2 = p.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    keyIds = [];
  });

  function addKey(key = "sk-verify-abcdefgh123456"): number {
    const k = keys.addProviderKey(pid2, key, "probe", true);
    keyIds.push(k.id);
    return k.id;
  }

  it("200 classifies definitive success and records it", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));

    const out = await keys.verifyProviderKey(id);

    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
    expect(out.certainty).toBe("definitive");
    expect(out.error).toBeNull();
  });

  it("401 classifies definitive failure with the body text", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid api key", { status: 401 })));

    const out = await keys.verifyProviderKey(id);

    expect(out.ok).toBe(false);
    expect(out.status).toBe(401);
    expect(out.certainty).toBe("definitive");
    expect(out.error).toContain("invalid api key");
  });

  it("500 classifies unknown, not definitive", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream exploded", { status: 500 })));

    const out = await keys.verifyProviderKey(id);

    expect(out.ok).toBe(false);
    expect(out.status).toBe(500);
    expect(out.certainty).toBe("unknown");
  });

  it("timeout/network error classifies unknown with status 0", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));

    const out = await keys.verifyProviderKey(id);

    expect(out.ok).toBe(false);
    expect(out.status).toBe(0);
    expect(out.certainty).toBe("unknown");
    expect(out.error).toContain("network down");
  });

  it("the plaintext key never appears in a recorded error", async () => {
    const secret = "sk-verify-abcdefgh123456";
    const id = addKey(secret);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`bad key ${secret} for user`, { status: 401 })));

    const out = await keys.verifyProviderKey(id);

    expect(out.error).not.toContain(secret);
    expect(out.error).toContain("[REDACTED]");
  });

  it("verifyAndRecordKey persists a definitive failure", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));

    const out = await keys.verifyAndRecordKey(id);
    const after = keys.getProviderKey(id)!;

    expect(out.certainty).toBe("definitive");
    expect(after.lastVerifyOk).toBe(false);
    expect(after.lastVerifiedAt).not.toBe("");
    expect(after.lastVerifyError).toBe("nope");
  });

  it("verifyAndRecordKey persists a definitive success", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));

    await keys.verifyAndRecordKey(id);
    const after = keys.getProviderKey(id)!;

    expect(after.lastVerifyOk).toBe(true);
  });

  it("a transient error does not overwrite a previous ok verdict", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    await keys.verifyAndRecordKey(id);
    expect(keys.getProviderKey(id)!.lastVerifyOk).toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("gateway timeout", { status: 504 })));
    await keys.verifyAndRecordKey(id);

    const after = keys.getProviderKey(id)!;
    expect(after.lastVerifyOk).toBe(true); // verdict preserved
    expect(after.lastVerifyError).toContain("gateway timeout"); // audit kept
  });

  it("a transient error does not invent a verdict for a never-verified key", async () => {
    const id = addKey();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    await keys.verifyAndRecordKey(id);

    const after = keys.getProviderKey(id)!;
    // "never verified" is lastVerifiedAt === "" (the column is NOT NULL, so
    // the empty timestamp is the never-judged marker, not a null verdict).
    expect(after.lastVerifiedAt).toBe("");
    expect(after.lastVerifyOk).toBe(false); // column default, not a verdict
    expect(after.lastVerifyError).toContain("boom");
  });

  it("throws for a key id that does not exist", async () => {
    await expect(keys.verifyProviderKey(999_999)).rejects.toThrow("key not found");
  });
});
