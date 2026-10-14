import { getDb } from "./db";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { buildRequest } from "./client";
import { getProvider } from "./repo";

export interface ProviderKey {
  id: number;
  providerId: number;
  label: string;
  keyPreview: string;
  active: boolean;
  lastVerifiedAt: string;
  lastVerifyOk: boolean;
  lastVerifyError: string;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: number;
  provider_id: number;
  label: string;
  key_enc: string;
  key_preview: string;
  active: number;
  last_verified_at: string;
  last_verify_ok: number;
  last_verify_error: string;
  created_at: string;
  updated_at: string;
}

function rowToKey(r: Row): ProviderKey {
  return {
    id: r.id,
    providerId: r.provider_id,
    label: r.label,
    keyPreview: r.key_preview,
    active: r.active === 1,
    lastVerifiedAt: r.last_verified_at,
    lastVerifyOk: r.last_verify_ok === 1,
    lastVerifyError: r.last_verify_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listProviderKeys(providerId: number): ProviderKey[] {
  return getDb()
    .prepare(
      "SELECT * FROM provider_keys WHERE provider_id = ? ORDER BY active DESC, created_at DESC",
    )
    .all(providerId)
    .map((r) => rowToKey(r as Row));
}

export function getProviderKey(id: number): ProviderKey | null {
  const r = getDb()
    .prepare("SELECT * FROM provider_keys WHERE id = ?")
    .get(id) as Row | undefined;
  return r ? rowToKey(r) : null;
}

export function addProviderKey(
  providerId: number,
  key: string,
  label: string,
  activate: boolean,
): ProviderKey {
  if (!key) throw new Error("key is required");
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO provider_keys (provider_id, label, key_enc, key_preview, active) VALUES (?, ?, ?, ?, 0)",
    )
    .run(providerId, label, encryptSecret(key), maskSecret(key));
  const id = Number(info.lastInsertRowid);
  const hasActive = db
    .prepare("SELECT 1 FROM provider_keys WHERE provider_id = ? AND active = 1 AND id != ?")
    .get(providerId, id);
  if (activate || !hasActive) activateProviderKey(id);
  return getProviderKey(id)!;
}

export function activateProviderKey(id: number): ProviderKey | null {
  const db = getDb();
  const key = getProviderKey(id);
  if (!key) return null;
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE provider_keys SET active = 0, updated_at = datetime('now') WHERE provider_id = ? AND id != ?",
    ).run(key.providerId, id);
    db.prepare(
      "UPDATE provider_keys SET active = 1, updated_at = datetime('now') WHERE id = ?",
    ).run(id);
    const row = db
      .prepare("SELECT key_enc FROM provider_keys WHERE id = ?")
      .get(id) as { key_enc: string };
    db.prepare(
      "UPDATE providers SET api_key_enc = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(row.key_enc, key.providerId);
  });
  tx();
  return getProviderKey(id);
}

export function deleteProviderKey(id: number): boolean {
  const db = getDb();
  const key = getProviderKey(id);
  if (!key) return false;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM provider_keys WHERE id = ?").run(id);
    if (key.active) {
      const other = db
        .prepare(
          "SELECT id FROM provider_keys WHERE provider_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(key.providerId) as { id: number } | undefined;
      if (other) {
        activateProviderKeyInner(db, other.id, key.providerId);
      } else {
        db.prepare(
          "UPDATE providers SET api_key_enc = '', updated_at = datetime('now') WHERE id = ?",
        ).run(key.providerId);
      }
    }
  });
  tx();
  return true;
}

function activateProviderKeyInner(
  db: ReturnType<typeof getDb>,
  id: number,
  providerId: number,
): void {
  db.prepare(
    "UPDATE provider_keys SET active = 0 WHERE provider_id = ? AND id != ?",
  ).run(providerId, id);
  db.prepare("UPDATE provider_keys SET active = 1 WHERE id = ?").run(id);
  const row = db
    .prepare("SELECT key_enc FROM provider_keys WHERE id = ?")
    .get(id) as { key_enc: string };
  db.prepare("UPDATE providers SET api_key_enc = ? WHERE id = ?").run(
    row.key_enc,
    providerId,
  );
}

export function revealProviderKey(id: number): string {
  const r = getDb()
    .prepare("SELECT key_enc FROM provider_keys WHERE id = ?")
    .get(id) as { key_enc: string } | undefined;
  if (!r) throw new Error("key not found");
  return decryptSecret(r.key_enc);
}

export function recordKeyVerification(
  id: number,
  ok: boolean | null,
  error: string,
): void {
  const db = getDb();
  if (ok === null) {
    db.prepare(
      "UPDATE provider_keys SET last_verify_error = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(error, id);
    return;
  }
  db.prepare(
    "UPDATE provider_keys SET last_verified_at = datetime('now'), last_verify_ok = ?, last_verify_error = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(ok ? 1 : 0, error, id);
}

export interface KeyVerificationOutcome {
  ok: boolean;
  status: number;
  latencyMs: number;
  certainty: "definitive" | "unknown";
  error: string | null;
}

export async function verifyProviderKey(
  id: number,
  timeoutMs = 10_000,
): Promise<KeyVerificationOutcome> {
  const key = getProviderKey(id);
  if (!key) throw new Error("key not found");

  const provider = getProvider(key.providerId);
  if (!provider) throw new Error("provider not found");

  const plaintext = revealProviderKey(id);
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let status = 0;
  let error: string | null = null;

  try {
    const { url, headers } = buildRequest(provider, provider.modelsPath || "/models", plaintext);
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    status = res.status;
    const body = await res.text();

    if (res.ok) {
      return { ok: true, status, latencyMs: Date.now() - started, certainty: "definitive", error: null };
    }

    error = redactKeyError(body.slice(0, 400) || res.statusText, plaintext);

    if (status === 401 || status === 403) {
      return { ok: false, status, latencyMs: Date.now() - started, certainty: "definitive", error };
    }
    return { ok: false, status, latencyMs: Date.now() - started, certainty: "unknown", error };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      certainty: "unknown",
      error: redactKeyError(raw, plaintext),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyAndRecordKey(
  id: number,
  timeoutMs = 10_000,
): Promise<KeyVerificationOutcome> {
  const outcome = await verifyProviderKey(id, timeoutMs);

  if (outcome.certainty === "definitive") {
    recordKeyVerification(id, outcome.ok, outcome.error ?? "");
  } else {
    recordKeyVerification(id, null, outcome.error ?? "(unverified: transient error)");
  }

  return outcome;
}

function redactKeyError(text: string, key: string): string {
  let out = text;
  if (key && key.length >= 8) {
    out = out.split(key).join("[REDACTED]");
    const head = key.slice(0, 12);
    const tail = key.slice(-8);
    if (head.length >= 8) out = out.split(head).join("[REDACTED]");
    if (tail.length >= 8) out = out.split(tail).join("[REDACTED]");
  }
  return out.replace(/\s+/g, " ").trim();
}

export interface RotationResult {
  rotated: boolean;
  exhausted: boolean;
  keysTried: number;
  error: string | null;
}

export function handleAuthFailure(
  providerId: number,
  errorText: string,
): { retry: boolean; exhausted: boolean; keysTried: number; revokedPreview: string | null } {
  const active = listProviderKeys(providerId).find((k) => k.active);
  if (active) {
    recordKeyVerification(active.id, false, errorText.slice(0, 400));
  }

  const { result } = rotateToNextKey(providerId);
  return {
    retry: result.rotated,
    exhausted: result.exhausted,
    keysTried: result.keysTried,
    revokedPreview: active?.keyPreview ?? null,
  };
}

export function identityOfActiveKey(providerId: number): ProviderKey | null {
  return listProviderKeys(providerId).find((k) => k.active) ?? null;
}

export function recordAuthFailure(providerId: number, errorText: string): void {
  const active = listProviderKeys(providerId).find((k) => k.active);
  if (active) {
    recordKeyVerification(active.id, false, errorText.slice(0, 400));
  }
}

export function rotateToNextKey(providerId: number): { key: ProviderKey | null; result: RotationResult } {
  const inactive = listProviderKeys(providerId).filter((k) => !k.active);
  if (inactive.length === 0) {
    return {
      key: null,
      result: { rotated: false, exhausted: true, keysTried: 1, error: "no other keys available" },
    };
  }

  const next = inactive[0];
  const activated = activateProviderKey(next.id);
  if (!activated) {
    return {
      key: null,
      result: { rotated: false, exhausted: true, keysTried: 1, error: "activation failed" },
    };
  }

  return {
    key: activated,
    result: { rotated: true, exhausted: false, keysTried: 2, error: null },
  };
}
