
import type { HermesConfig } from "./config-schema";
import { readHermesConfig, writeHermesConfig } from "./config-io";

export interface ValidationError {
  tier: string;
  index: number;
  field: string;
  message: string;
}

export function validatePoolEntries(
  tier: string,
  entries: { provider: string; model: string }[],
  providers: Record<string, unknown>,
  errors: ValidationError[],
): void {
  entries.forEach((entry, index) => {
    if (!(entry.provider in providers)) {
      errors.push({
        tier,
        index,
        field: "provider",
        message: `provider "${entry.provider}" is not configured for this profile`,
      });
    }
    if (!entry.model || !entry.model.trim()) {
      errors.push({
        tier,
        index,
        field: "model",
        message: `model is required`,
      });
    }
  });
}

export function validateTierConfig(cfg: HermesConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const providers = cfg.providers ?? {};
  const tr = cfg.tier_router;
  if (!tr) return errors;
  for (const ref of tr.classifier?.pool ?? []) {
    validatePoolEntries("classifier", [ref], providers, errors);
  }
  for (const [tierName, tier] of Object.entries(tr.tiers ?? {})) {
    validatePoolEntries(tierName, tier.pool ?? [], providers, errors);
    validatePoolEntries(tierName, tier.fallback ?? [], providers, errors);
  }
  return errors;
}

export function unifiedDiff(a: string, b: string): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const out: string[] = [];
  out.push("--- on-disk");
  out.push("+++ would-be");
  // simple line diff
  let i = 0;
  const max = Math.max(aLines.length, bLines.length);
  while (i < max) {
    const la = aLines[i];
    const lb = bLines[i];
    if (la === lb) {
      out.push(` ${la ?? ""}`);
    } else {
      if (la !== undefined) out.push(`-${la}`);
      if (lb !== undefined) out.push(`+${lb}`);
    }
    i++;
  }
  return out.join("\n");
}

export function buildWouldBeConfig(profileId: string, mutate: (c: HermesConfig) => void): HermesConfig {
  const cfg = readHermesConfig(profileId);
  if (!cfg.tier_router) {
    // ensure
  }
  mutate(cfg);
  return cfg;
}

export { readHermesConfig, writeHermesConfig };
