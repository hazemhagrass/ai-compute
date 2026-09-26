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

export function recordKeyVerification(
  id: number,
  ok: boolean,
  error: string,
): void {
  getDb()
    .prepare(
      "UPDATE provider_keys SET last_verified_at = datetime('now'), last_verify_ok = ?, last_verify_error = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(ok ? 1 : 0, error, id);
}
