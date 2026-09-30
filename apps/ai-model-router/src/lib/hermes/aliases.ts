import { z } from "zod";

import { modelRefSchema, type ModelRef } from "./config-schema";
import { readHermesConfig, updateHermesConfig } from "./config-io";

const ALIAS_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

export function isValidAliasName(name: string): boolean {
  return ALIAS_NAME_RE.test(name);
}

/**
 * `model_aliases`: friendly name -> real provider/model, resolvable by the
 * Hermes CLI/gateway (`/model <alias>`) and by `model.default`/tier pools
 * referencing the alias instead of a raw provider+model pair. Stored as
 * `z.record(z.string(), z.unknown())` in the schema (untyped passthrough)
 * because Hermes itself accepts either a `ModelRef`-shaped object or, in
 * older configs, a bare string "provider/model" — this module normalizes
 * reads to `ModelRef` and always writes the object form.
 */
export function listAliases(profileId: string): Record<string, ModelRef> {
  const raw = readHermesConfig(profileId).model_aliases ?? {};
  const out: Record<string, ModelRef> = {};
  for (const [name, value] of Object.entries(raw)) {
    const parsed = modelRefSchema.safeParse(value);
    if (parsed.success) {
      out[name] = parsed.data;
    } else if (typeof value === "string" && value.includes("/")) {
      const [provider, ...rest] = value.split("/");
      out[name] = { provider, model: rest.join("/") };
    }
  }
  return out;
}

export function setAlias(profileId: string, name: string, ref: ModelRef): Record<string, ModelRef> {
  if (!isValidAliasName(name)) throw new Error("alias name must look like an identifier");
  const parsedRef = modelRefSchema.parse(ref);
  const next = updateHermesConfig(profileId, (cfg) => {
    cfg.model_aliases = { ...(cfg.model_aliases ?? {}), [name]: parsedRef };
    return cfg;
  });
  return listAliasesFrom(next.model_aliases);
}

export function removeAlias(profileId: string, name: string): Record<string, ModelRef> {
  const next = updateHermesConfig(profileId, (cfg) => {
    if (cfg.model_aliases) delete cfg.model_aliases[name];
    return cfg;
  });
  return listAliasesFrom(next.model_aliases);
}

function listAliasesFrom(raw: Record<string, unknown> | undefined): Record<string, ModelRef> {
  const out: Record<string, ModelRef> = {};
  for (const [name, value] of Object.entries(raw ?? {})) {
    const parsed = modelRefSchema.safeParse(value);
    if (parsed.success) out[name] = parsed.data;
  }
  return out;
}

export const aliasNameSchema = z
  .string()
  .trim()
  .min(1, "alias name is required")
  .regex(ALIAS_NAME_RE, "alias name must look like an identifier");
