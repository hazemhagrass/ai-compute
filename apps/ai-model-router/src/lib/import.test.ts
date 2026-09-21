import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// A scratch data dir per run, set before any module resolves its paths, so
// tests never read or write the developer's real router.db.
const DIR = mkdtempSync(join(tmpdir(), "amr-import-test-"));
process.env.AMR_DATA_DIR = DIR;
process.env.AMR_DB_PATH = join(DIR, "test.db");
process.env.AMR_SECRET = "test-secret-not-a-real-key-000000";

const repo = await import("./repo");
const { getDb } = await import("./db");
const {
  ImportValidationError,
  importConfig,
  isMaskedSecret,
  parseConfigImport,
} = await import("./import");

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

/* ------------------------------------------------------------- helpers */

/** Same shape as `GET /api/export`, built straight from the live database. */
function exportConfig(): unknown {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    providers: repo.listProviders().map((p) => ({ ...p, keyPreview: undefined })),
    models: repo.listModels(),
    tasks: repo.listTasks(),
  };
}

const VALID_KEY = "amr-import-test-key-aaaaaaaaaaaa";
const REPLACEMENT_KEY = "amr-import-test-key-bbbbbbbbbbbb";

function providerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Imported Provider",
    slug: "imported-provider",
    kind: "custom",
    baseUrl: "https://api.imported.example/v1",
    ...overrides,
  };
}

function modelRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    providerSlug: "imported-provider",
    modelId: "imported-model-1",
    label: "Imported Model 1",
    quality: 80,
    ...overrides,
  };
}

function taskRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    label: "Imported Task",
    slug: "imported-task",
    weights: { coding: 3 },
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 1, providers: [], models: [], tasks: [], ...overrides };
}

/** Wipe the config tables so each scenario starts from a clean slate. */
function resetTables(): void {
  const db = getDb();
  db.exec("DELETE FROM tasks; DELETE FROM models; DELETE FROM providers;");
}

function providerBySlug(slug: string) {
  return repo.listProviders().find((p) => p.slug === slug);
}

/* --------------------------------------------------------- secret guard */

describe("isMaskedSecret", () => {
  it("recognises masked placeholders", () => {
    expect(isMaskedSecret("sk-ab••••••••wxyz")).toBe(true);
    expect(isMaskedSecret("sk-****")).toBe(true);
    expect(isMaskedSecret("sk-abc…wxyz")).toBe(true);
    expect(isMaskedSecret("xxxxxxxx")).toBe(true);
    expect(isMaskedSecret("REDACTED")).toBe(true);
  });

  it("leaves plausible plaintext keys alone", () => {
    expect(isMaskedSecret(VALID_KEY)).toBe(false);
    expect(isMaskedSecret("")).toBe(false);
  });
});

/* ------------------------------------------------------------ validation */

describe("parseConfigImport", () => {
  it("accepts an empty config", () => {
    expect(parseConfigImport(payload())).toEqual({ providers: [], models: [], tasks: [] });
  });

  it("rejects an unsupported version", () => {
    expect(() => parseConfigImport(payload({ version: 2 }))).toThrow(ImportValidationError);
  });

  it("collects row-level errors for every malformed row", () => {
    try {
      parseConfigImport(
        payload({
          providers: [providerRow({ baseUrl: "" }), { name: 42 }],
          models: [modelRow({ modelId: "" })],
          tasks: [taskRow({ label: "" })],
        }),
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ImportValidationError);
      const issues = (err as InstanceType<typeof ImportValidationError>).issues;
      expect(issues).toHaveLength(4);
      expect(issues[0]).toMatchObject({ section: "providers", index: 0 });
      expect(issues[1]).toMatchObject({ section: "providers", index: 1 });
      expect(issues[2]).toMatchObject({ section: "models", index: 0 });
      expect(issues[3]).toMatchObject({ section: "tasks", index: 0 });
      expect(issues[0].issues.join(" ")).toContain("baseUrl");
    }
  });
});

/* ---------------------------------------------------------------- import */

describe("importConfig", () => {
  it("recreates providers, models and tasks on a fresh database", () => {
    resetTables();
    const summary = importConfig(
      payload({
        providers: [providerRow()],
        models: [modelRow(), modelRow({ modelId: "imported-model-2", label: "Second" })],
        tasks: [taskRow()],
      }),
    );

    expect(summary).toMatchObject({
      providers: { inserted: 1, skipped: 0, updated: 0 },
      models: { inserted: 2, skipped: 0, updated: 0 },
      tasks: { inserted: 1, skipped: 0, updated: 0 },
      maskedKeys: [],
    });

    const p = providerBySlug("imported-provider");
    expect(p).toBeDefined();
    expect(p?.baseUrl).toBe("https://api.imported.example/v1");
    expect(p?.hasKey).toBe(false);
    expect(repo.listModels().filter((m) => m.providerSlug === "imported-provider")).toHaveLength(2);
    expect(repo.getTaskBySlug("imported-task")?.weights).toEqual({ coding: 3 });
  });

  it("skips existing rows by default and upserts them on request", () => {
    resetTables();
    importConfig(payload({ providers: [providerRow()], tasks: [taskRow()] }));

    // Default mode: explicit skip, never a silent duplicate.
    const skipped = importConfig(
      payload({
        providers: [providerRow({ name: "Renamed Provider" })],
        models: [modelRow()],
        tasks: [taskRow({ description: "changed" })],
      }),
    );
    expect(skipped.providers).toMatchObject({ inserted: 0, skipped: 1, updated: 0 });
    expect(skipped.models).toMatchObject({ inserted: 1, skipped: 0, updated: 0 });
    expect(skipped.tasks).toMatchObject({ inserted: 0, skipped: 1, updated: 0 });
    expect(providerBySlug("imported-provider")?.name).toBe("Imported Provider");
    expect(repo.listProviders().filter((p) => p.slug === "imported-provider")).toHaveLength(1);
    expect(repo.getTaskBySlug("imported-task")?.description).toBe("");

    // Upsert mode: existing rows are updated in place, still no duplicates.
    const upserted = importConfig(
      payload({
        providers: [providerRow({ name: "Renamed Provider" })],
        models: [modelRow({ quality: 99 })],
        tasks: [taskRow({ description: "changed" })],
      }),
      { conflict: "upsert" },
    );
    expect(upserted.providers).toMatchObject({ inserted: 0, skipped: 0, updated: 1 });
    expect(upserted.models).toMatchObject({ inserted: 0, skipped: 0, updated: 1 });
    expect(upserted.tasks).toMatchObject({ inserted: 0, skipped: 0, updated: 1 });
    expect(providerBySlug("imported-provider")?.name).toBe("Renamed Provider");
    expect(repo.listProviders().filter((p) => p.slug === "imported-provider")).toHaveLength(1);
    const models = repo.listModels().filter((m) => m.providerSlug === "imported-provider");
    expect(models).toHaveLength(1);
    expect(models[0].quality).toBe(99);
    expect(repo.getTaskBySlug("imported-task")?.description).toBe("changed");
  });

  it("rejects a malformed file without writing anything", () => {
    resetTables();
    const before = repo.listProviders().length;

    expect(() =>
      importConfig(
        payload({
          providers: [providerRow(), providerRow({ slug: "broken", name: "", baseUrl: "x" })],
          tasks: [taskRow()],
        }),
      ),
    ).toThrow(ImportValidationError);

    expect(repo.listProviders()).toHaveLength(before);
    expect(repo.listTasks()).toHaveLength(0);
  });

  it("rolls back the whole import when a mid-file row fails at write time", () => {
    resetTables();
    // The first provider and model are valid; the second model references a
    // provider slug that exists nowhere, which only fails once writes start.
    const bad = payload({
      providers: [providerRow()],
      models: [modelRow(), modelRow({ providerSlug: "does-not-exist", modelId: "ghost" })],
      tasks: [taskRow()],
    });

    expect(() => importConfig(bad)).toThrow(/does-not-exist/);

    expect(repo.listProviders()).toHaveLength(0);
    expect(repo.listModels()).toHaveLength(0);
    expect(repo.listTasks()).toHaveLength(0);
  });

  it("encrypts a plaintext key from the clearly marked field", () => {
    resetTables();
    const summary = importConfig(
      payload({ providers: [providerRow({ plaintextApiKey: VALID_KEY })] }),
    );

    expect(summary.maskedKeys).toEqual([]);
    const p = providerBySlug("imported-provider");
    expect(p?.hasKey).toBe(true);
    expect(JSON.stringify(p)).not.toContain(VALID_KEY);
    expect(repo.getProviderSecret(p!.id)).toBe(VALID_KEY);
  });

  it("never stores a masked placeholder as a real key", () => {
    resetTables();
    const summary = importConfig(
      payload({ providers: [providerRow({ plaintextApiKey: "sk-ab••••••••wxyz" })] }),
    );

    expect(summary.maskedKeys).toEqual(["imported-provider"]);
    const p = providerBySlug("imported-provider");
    expect(p?.hasKey).toBe(false);
    expect(repo.getProviderSecret(p!.id)).toBe("");
  });

  it("keeps the stored key when an upsert carries a masked placeholder", () => {
    resetTables();
    importConfig(payload({ providers: [providerRow({ plaintextApiKey: VALID_KEY })] }));
    const id = providerBySlug("imported-provider")!.id;

    const summary = importConfig(
      payload({
        providers: [providerRow({ name: "Renamed", plaintextApiKey: "amr-i••••••••aaaa" })],
      }),
      { conflict: "upsert" },
    );

    expect(summary.maskedKeys).toEqual(["imported-provider"]);
    expect(providerBySlug("imported-provider")?.name).toBe("Renamed");
    expect(repo.getProviderSecret(id)).toBe(VALID_KEY);
  });

  it("replaces the stored key when an upsert carries a new plaintext key", () => {
    resetTables();
    importConfig(payload({ providers: [providerRow({ plaintextApiKey: VALID_KEY })] }));
    const id = providerBySlug("imported-provider")!.id;

    importConfig(payload({ providers: [providerRow({ plaintextApiKey: REPLACEMENT_KEY })] }), {
      conflict: "upsert",
    });

    expect(repo.getProviderSecret(id)).toBe(REPLACEMENT_KEY);
  });

  it("round-trips a live export through a wiped database", () => {
    resetTables();
    repo.createProvider({ name: "RT Provider", baseUrl: "https://rt.example/v1" });
    const rt = providerBySlug("rt-provider")!;
    repo.createModel({
      providerId: rt.id,
      modelId: "rt-model",
      label: "RT Model",
      quality: 71,
      tags: ["roundtrip"],
    });
    repo.createTask({ label: "RT Task", slug: "rt-task", weights: { reasoning: 5 } });

    const snapshot = JSON.parse(JSON.stringify(exportConfig()));
    const counts = {
      providers: repo.listProviders().length,
      models: repo.listModels().length,
      tasks: repo.listTasks().length,
    };

    resetTables();
    const summary = importConfig(snapshot);

    expect(summary.providers.inserted).toBe(counts.providers);
    expect(summary.models.inserted).toBe(counts.models);
    expect(summary.tasks.inserted).toBe(counts.tasks);
    expect(summary.maskedKeys).toEqual([]);

    const p = providerBySlug("rt-provider");
    expect(p?.baseUrl).toBe("https://rt.example/v1");
    const m = repo.listModels().find((x) => x.providerSlug === "rt-provider");
    expect(m).toMatchObject({ modelId: "rt-model", label: "RT Model", quality: 71, tags: ["roundtrip"] });
    expect(repo.getTaskBySlug("rt-task")?.weights).toEqual({ reasoning: 5 });

    // Importing the same file twice skips every row instead of duplicating it.
    const again = importConfig(snapshot);
    expect(again.providers).toMatchObject({ inserted: 0, skipped: counts.providers, updated: 0 });
    expect(again.models).toMatchObject({ inserted: 0, skipped: counts.models, updated: 0 });
    expect(again.tasks).toMatchObject({ inserted: 0, skipped: counts.tasks, updated: 0 });
    expect(repo.listProviders()).toHaveLength(counts.providers);
    expect(repo.listModels()).toHaveLength(counts.models);
    expect(repo.listTasks()).toHaveLength(counts.tasks);
  });
});
