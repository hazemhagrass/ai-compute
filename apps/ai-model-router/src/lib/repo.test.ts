import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A scratch data dir per run, set before the repo module resolves its paths,
// so tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const repo = await import("./repo");

let providerId: number;

beforeAll(() => {
  const p = repo.createProvider({
    name: "Scratch Provider",
    baseUrl: "http://localhost:9999/v1",
    kind: "local",
    authType: "none",
  });
  providerId = p.id;

  for (let i = 0; i < 120; i++) {
    repo.createModel({
      providerId,
      modelId: `scratch-${String(i).padStart(3, "0")}`,
      label: i % 2 === 0 ? `Even Model ${i}` : `Odd Model ${i}`,
      enabled: i % 10 !== 0,
    });
  }
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("queryModels", () => {
  it("caps a page at the requested limit", () => {
    const { models, total } = repo.queryModels({ limit: 25 });

    expect(models).toHaveLength(25);
    expect(total).toBeGreaterThanOrEqual(120);
  });

  it("reports the unpaginated total, not the page length", () => {
    const page = repo.queryModels({ limit: 10 });

    expect(page.models.length).toBe(10);
    expect(page.total).toBeGreaterThan(page.models.length);
  });

  it("walks pages without repeating or skipping a row", () => {
    const a = repo.queryModels({ providerId, limit: 50, offset: 0 });
    const b = repo.queryModels({ providerId, limit: 50, offset: 50 });
    const ids = new Set([...a.models, ...b.models].map((m) => m.id));

    expect(ids.size).toBe(a.models.length + b.models.length);
  });

  it("filters by provider", () => {
    const { models, total } = repo.queryModels({ providerId, limit: 500 });

    expect(models.every((m) => m.providerId === providerId)).toBe(true);
    expect(total).toBe(120);
  });

  it("searches across label, model id, and provider name", () => {
    expect(repo.queryModels({ search: "Odd Model", limit: 500 }).total).toBe(60);
    expect(repo.queryModels({ search: "scratch-001", limit: 500 }).total).toBe(1);
    // Provider name is searchable, which is how a user finds "everything on
    // my Ollama box" without knowing any individual model id.
    expect(repo.queryModels({ search: "Scratch Provider", limit: 500 }).total).toBe(120);
  });

  it("applies the enabled filter to the total as well as the page", () => {
    // Scoped to this suite's provider: opening the database seeds a starter
    // catalogue, so a global count here would silently include those rows.
    // A total that ignores the filter produces a pager with empty trailing
    // pages, which reads as data loss.
    const { models, total } = repo.queryModels({
      providerId,
      enabledOnly: true,
      limit: 500,
    });

    expect(models.every((m) => m.enabled)).toBe(true);
    expect(total).toBe(models.length);
    expect(total).toBe(108); // 120 created, every 10th disabled
  });

  it("clamps an absurd limit rather than returning everything", () => {
    const { models } = repo.queryModels({ limit: 100_000 });

    expect(models.length).toBeLessThanOrEqual(500);
  });

  it("returns an empty page past the end without throwing", () => {
    const { models, total } = repo.queryModels({ limit: 25, offset: 10_000 });

    expect(models).toEqual([]);
    expect(total).toBeGreaterThan(0);
  });
});

describe("listModels", () => {
  it("returns every row, since the router must score every candidate", () => {
    expect(repo.listModels().length).toBeGreaterThanOrEqual(120);
  });
});

describe("provider secrets", () => {
  it("never returns the plaintext key on the provider object", () => {
    const p = repo.createProvider({
      name: "Keyed",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-plaintext-value-1234567890",
    });

    expect(JSON.stringify(p)).not.toContain("plaintext-value");
    expect(p.hasKey).toBe(true);
    expect(p.keyPreview).toContain("•");
  });

  it("round-trips the key through encryption", () => {
    const p = repo.createProvider({
      name: "Roundtrip",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-roundtrip-abcdef",
    });

    expect(repo.getProviderSecret(p.id)).toBe("sk-roundtrip-abcdef");
  });

  it("treats an absent apiKey as keep and an empty string as clear", () => {
    // The tri-state rule. Collapsing these two silently wipes stored keys.
    const p = repo.createProvider({
      name: "Tristate",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-original",
    });

    repo.updateProvider(p.id, { name: "Renamed" });
    expect(repo.getProviderSecret(p.id)).toBe("sk-original");

    repo.updateProvider(p.id, { apiKey: "sk-replaced" });
    expect(repo.getProviderSecret(p.id)).toBe("sk-replaced");

    repo.updateProvider(p.id, { apiKey: "" });
    expect(repo.getProviderSecret(p.id)).toBe("");
  });
});
