/**
 * Multi-key management per provider (issue #156).
 *
 * The existing world stored one encrypted key on the provider row. That
 * blocks the common workflows a real user needs:
 *
 *   - hold two keys at once (old + new) while rotating without a window of
 *     failing requests;
 *   - label a key ("personal / work / billing") because a naked key preview
 *     is not enough to tell them apart;
 *   - see when a key was last verified and what the verification said,
 *     because a key that once worked is not proof it still does.
 *
 * The active key is authoritative: this module keeps providers.api_key_enc
 * in sync with the row marked `active = 1`, so the existing chat path and
 * every route that already reads getProviderSecret() keeps working.
 */
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

/**
 * Add a new key for a provider. Optionally activate it (which deactivates
 * any other active key on the same provider and updates the mirror on
 * providers.api_key_enc).
 */
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
  // First key for a provider becomes active without asking: a provider that
  // has a key in the pool but none in use is a state nobody wants, and the
  // old single-key UI never produced it.
  const hasActive = db
    .prepare("SELECT 1 FROM provider_keys WHERE provider_id = ? AND active = 1 AND id != ?")
    .get(providerId, id);
  if (activate || !hasActive) activateProviderKey(id);
  return getProviderKey(id)!;
}

/**
 * Set a key as the active one for its provider, deactivating siblings.
 * Runs in a single transaction so the unique-index invariant is never
 * violated even if another writer is racing.
 */
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
      // Deleting the active key leaves the provider with no key. Any other
      // key becomes the active one; if none, api_key_enc is cleared so the
      // chat path fails loudly instead of using stale bytes.
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

// Internal helper used inside a running transaction.
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

/** Reveal the plaintext for a specific key. Used by the verify endpoint. */
export function revealProviderKey(id: number): string {
  const r = getDb()
    .prepare("SELECT key_enc FROM provider_keys WHERE id = ?")
    .get(id) as { key_enc: string } | undefined;
  if (!r) throw new Error("key not found");
  return decryptSecret(r.key_enc);
}

/**
 * Record a verification outcome.
 *
 * ok: true/false = a definitive verdict from the provider; both the verdict
 * and the verification timestamp are written. null = the probe never produced
 * a verdict (timeout, 5xx): only the error text is written. last_verify_ok
 * and last_verified_at are left exactly as they were, because last_verified_at
 * means "last DEFINITIVE verification" -- a never-verified key keeps its empty
 * timestamp, and a transient failure can neither turn "never verified" into
 * "failed" nor overwrite a verdict someone actually observed.
 */
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

/* -------------------------------------------------------------- verify (#162) */

export interface KeyVerificationOutcome {
  ok: boolean;
  /** HTTP status of the probe; 0 when the request never completed. */
  status: number;
  latencyMs: number;
  /** "definitive" = the key is known-good or known-bad; "unknown" = transient. */
  certainty: "definitive" | "unknown";
  error: string | null;
}

/**
 * Verify one stored key against its provider (#162).
 *
 * The probe is a GET on the provider's models endpoint -- the cheapest call
 * every provider accepts -- with THIS key substituted into the request. The
 * provider's active key is deliberately not used: the point is to learn about
 * the key in the pool row, not about whatever happens to be active.
 *
 * Failure classes, and why certainty matters:
 *   - 401/403  -> definitive failure. The provider saw the key and rejected it.
 *   - 200/2xx  -> definitive success.
 *   - 5xx, timeouts, network errors -> unknown. The provider never evaluated
 *     the key, so overwriting a prior ok=true with a transient error would
 *     record a fact nobody observed. The error text is still stored for the
 *     audit trail, but last_verify_ok is left as it was.
 */
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

    // redactSecrets lives in client.ts; import it alongside buildRequest.
    error = redactKeyError(body.slice(0, 400) || res.statusText, plaintext);

    if (status === 401 || status === 403) {
      return { ok: false, status, latencyMs: Date.now() - started, certainty: "definitive", error };
    }
    // 5xx and odd 4xx (429, 404 on a misconfigured path): the key was not
    // judged. Record the error text but say so.
    return { ok: false, status, latencyMs: Date.now() - started, certainty: "unknown", error };
  } catch (err) {
    // Abort from the timeout lands here too; the message names it.
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

/**
 * Verify-and-record: classify the probe, then persist it. Split from
 * verifyProviderKey so tests can exercise classification against a mock
 * fetch without touching the database, and so #166 (rotation on auth
 * failure) can reuse the same classification.
 */
export async function verifyAndRecordKey(
  id: number,
  timeoutMs = 10_000,
): Promise<KeyVerificationOutcome> {
  const outcome = await verifyProviderKey(id, timeoutMs);

  if (outcome.certainty === "definitive") {
    recordKeyVerification(id, outcome.ok, outcome.error ?? "");
  } else {
    // Unknown: keep the previous verdict (or no verdict at all), store the
    // error text only. The audit trail shows the probe happened without
    // claiming a result nobody observed.
    recordKeyVerification(id, null, outcome.error ?? "(unverified: transient error)");
  }

  return outcome;
}

/** Scrub the plaintext key (and its head/tail shapes) out of an error body. */
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

/* -------------------------------------------------------------- rotation (#166) */

export interface RotationResult {
  rotated: boolean;
  /** True when the retried request also got 401/403 and no keys remain. */
  exhausted: boolean;
  /** Keys tried, including the one that failed and any rotated-to key. */
  keysTried: number;
  error: string | null;
}

/**
 * Rotate to the next inactive key after a 401/403 and re-sync the provider
 * row (#166). Returns which key (if any) the caller should retry with.
 *
 * Deliberately NOT verifying before activating: an extra models-endpoint call
 * per rotation adds latency and its own failure modes, and the retry that the
 * caller is about to make IS the verification -- if the next key is also bad,
 * the retry's 401 lands here again and the pool reports exhaustion. The
 * request path is the judge.
 */
/**
 * Handle a 401/403 from a live call: record it against the key that was
 * actually active when the request was sent, then rotate. Centralised here
 * (rather than in client.ts) so the decision and the audit write happen in
 * one place and can be unit tested without mocking fetch twice.
 */
export function handleAuthFailure(
  providerId: number,
  errorText: string,
): { retry: boolean; exhausted: boolean; keysTried: number } {
  recordAuthFailure(providerId, errorText);

  const { result } = rotateToNextKey(providerId);
  return { retry: result.rotated, exhausted: result.exhausted, keysTried: result.keysTried };
}

/**
 * Record a definitive auth failure against the currently active key WITHOUT
 * rotating. Used by the retried call (#166): its 401 proves the rotated-to
 * key is also dead, but rotating again on one user-facing request would walk
 * the whole pool silently -- the caller reports exhaustion instead, and the
 * next request starts fresh from whatever the pool holds.
 */
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
