"""SQLite registry of installed models and their measured performance.

Two tables that matter:

  models        what Ollama says about a model (static, refreshed on probe)
  measurements  what we observed when running it (append-only, never edited)

Measurements are append-only because a single benchmark is noisy: the first
run after a cold boot, a run while another model holds VRAM, and a run on an
idle machine give very different numbers. Keeping every sample lets the
router use a median and lets a human see the spread instead of a single
number that hides it.
"""

from __future__ import annotations

import json
import sqlite3
import statistics
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS models (
    name            TEXT PRIMARY KEY,
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    family          TEXT NOT NULL DEFAULT '',
    parameter_size  TEXT NOT NULL DEFAULT '',
    quantization    TEXT NOT NULL DEFAULT '',
    capabilities    TEXT NOT NULL DEFAULT '[]',
    context_length  INTEGER NOT NULL DEFAULT 0,
    total_params    INTEGER NOT NULL DEFAULT 0,
    active_params   INTEGER NOT NULL DEFAULT 0,
    expert_count    INTEGER NOT NULL DEFAULT 0,
    expert_used     INTEGER NOT NULL DEFAULT 0,
    first_seen      REAL NOT NULL,
    last_seen       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS measurements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model           TEXT NOT NULL,
    kind            TEXT NOT NULL,
    gen_tps         REAL NOT NULL DEFAULT 0,
    prefill_tps     REAL NOT NULL DEFAULT 0,
    load_s          REAL NOT NULL DEFAULT 0,
    gpu_fraction    REAL NOT NULL DEFAULT -1,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    was_resident    INTEGER NOT NULL DEFAULT 0,
    created_at      REAL NOT NULL,
    FOREIGN KEY (model) REFERENCES models(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meas_model ON measurements(model, kind);

CREATE TABLE IF NOT EXISTS routes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chosen          TEXT NOT NULL,
    intent          TEXT NOT NULL DEFAULT '',
    objective       TEXT NOT NULL DEFAULT '',
    reason          TEXT NOT NULL DEFAULT '',
    considered      TEXT NOT NULL DEFAULT '[]',
    predicted_s     REAL NOT NULL DEFAULT 0,
    actual_s        REAL NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    created_at      REAL NOT NULL
);
"""


@dataclass(frozen=True)
class Perf:
    """Aggregated performance for one model, derived from its samples."""

    gen_tps: float = 0.0
    prefill_tps: float = 0.0
    cold_load_s: float = 0.0
    gpu_fraction: float = -1.0
    samples: int = 0

    @property
    def measured(self) -> bool:
        return self.samples > 0

    @property
    def spills_to_cpu(self) -> bool:
        """True when a measured run did not fit entirely in VRAM.

        -1 means unknown (never measured), which is deliberately not the same
        as "fits".
        """
        return 0 <= self.gpu_fraction < 0.99


class Registry:
    """Storage for model facts, measurements, and routing decisions."""

    def __init__(self, path: str | Path = ":memory:") -> None:
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    # ---- models -------------------------------------------------------

    def upsert_model(self, card: Any) -> None:
        now = time.time()
        self._conn.execute(
            """
            INSERT INTO models (name, size_bytes, family, parameter_size, quantization,
                                capabilities, context_length, total_params, active_params,
                                expert_count, expert_used, first_seen, last_seen)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(name) DO UPDATE SET
                size_bytes=excluded.size_bytes,
                family=excluded.family,
                parameter_size=excluded.parameter_size,
                quantization=excluded.quantization,
                capabilities=excluded.capabilities,
                context_length=excluded.context_length,
                total_params=excluded.total_params,
                active_params=excluded.active_params,
                expert_count=excluded.expert_count,
                expert_used=excluded.expert_used,
                last_seen=excluded.last_seen
            """,
            (card.name, card.size_bytes, card.family, card.parameter_size,
             card.quantization, json.dumps(list(card.capabilities)), card.context_length,
             card.total_params, card.active_params, card.expert_count, card.expert_used,
             now, now),
        )
        self._conn.commit()

    def models(self) -> list[dict[str, Any]]:
        rows = self._conn.execute("SELECT * FROM models ORDER BY name").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["capabilities"] = json.loads(d["capabilities"])
            out.append(d)
        return out

    def model(self, name: str) -> dict[str, Any] | None:
        row = self._conn.execute("SELECT * FROM models WHERE name = ?", (name,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["capabilities"] = json.loads(d["capabilities"])
        return d

    def forget_missing(self, present: Iterable[str]) -> int:
        """Drop models no longer installed. Returns how many were removed."""
        present = list(present)
        placeholders = ",".join("?" * len(present)) or "''"
        cur = self._conn.execute(
            f"DELETE FROM models WHERE name NOT IN ({placeholders})", present)
        self._conn.commit()
        return cur.rowcount

    # ---- measurements -------------------------------------------------

    def record_measurement(self, model: str, kind: str, *, gen_tps: float,
                           prefill_tps: float = 0.0, load_s: float = 0.0,
                           gpu_fraction: float = -1.0, output_tokens: int = 0,
                           was_resident: bool = False) -> None:
        self._conn.execute(
            """INSERT INTO measurements
               (model, kind, gen_tps, prefill_tps, load_s, gpu_fraction,
                output_tokens, was_resident, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (model, kind, gen_tps, prefill_tps, load_s, gpu_fraction,
             output_tokens, int(was_resident), time.time()),
        )
        self._conn.commit()

    def perf(self, model: str) -> Perf:
        """Aggregate a model's samples into one performance estimate.

        Uses the median rather than the mean: a single run that collided with
        another model loading can be several times slower than typical, and a
        mean lets that one sample dominate.
        """
        rows = self._conn.execute(
            "SELECT gen_tps, prefill_tps, load_s, gpu_fraction, was_resident "
            "FROM measurements WHERE model = ? AND gen_tps > 0", (model,)).fetchall()
        if not rows:
            return Perf()

        gen = [r["gen_tps"] for r in rows]
        prefill = [r["prefill_tps"] for r in rows if r["prefill_tps"] > 0]
        # Only cold runs tell us what loading costs; a warm run reports ~0.
        cold = [r["load_s"] for r in rows if not r["was_resident"] and r["load_s"] > 0.1]
        gpu = [r["gpu_fraction"] for r in rows if r["gpu_fraction"] >= 0]

        return Perf(
            gen_tps=statistics.median(gen),
            prefill_tps=statistics.median(prefill) if prefill else 0.0,
            cold_load_s=statistics.median(cold) if cold else 0.0,
            gpu_fraction=statistics.median(gpu) if gpu else -1.0,
            samples=len(rows),
        )

    def all_perf(self) -> dict[str, Perf]:
        return {m["name"]: self.perf(m["name"]) for m in self.models()}

    def measurement_count(self, model: str | None = None) -> int:
        if model:
            row = self._conn.execute(
                "SELECT COUNT(*) c FROM measurements WHERE model = ?", (model,)).fetchone()
        else:
            row = self._conn.execute("SELECT COUNT(*) c FROM measurements").fetchone()
        return row["c"]

    # ---- routes -------------------------------------------------------

    def record_route(self, *, chosen: str, intent: str, objective: str, reason: str,
                     considered: list[dict[str, Any]], predicted_s: float) -> int:
        cur = self._conn.execute(
            """INSERT INTO routes (chosen, intent, objective, reason, considered,
                                   predicted_s, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            (chosen, intent, objective, reason, json.dumps(considered),
             predicted_s, time.time()),
        )
        self._conn.commit()
        row_id = cur.lastrowid
        if row_id is None:  # pragma: no cover - sqlite always sets this on INSERT
            raise RuntimeError("sqlite did not return a rowid for the inserted route")
        return int(row_id)

    def update_prediction(self, route_id: int, predicted_s: float) -> None:
        """Revise a route's prediction before the request runs.

        The server sometimes generates against a wider token budget than the
        one the route was scored with (reasoning models need room to think).
        Recording the stale figure would corrupt the accuracy self-check.
        """
        self._conn.execute("UPDATE routes SET predicted_s = ? WHERE id = ?",
                           (predicted_s, route_id))
        self._conn.commit()

    def close_route(self, route_id: int, *, actual_s: float, output_tokens: int) -> None:
        self._conn.execute(
            "UPDATE routes SET actual_s = ?, output_tokens = ? WHERE id = ?",
            (actual_s, output_tokens, route_id))
        self._conn.commit()

    def recent_routes(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM routes ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["considered"] = json.loads(d["considered"])
            out.append(d)
        return out

    def prediction_accuracy(self) -> dict[str, Any]:
        """How close predicted wall-clock was to actual, for closed routes.

        This is the honest self-check on the router: if predictions are wildly
        off, the scoring model is wrong and should not be trusted.
        """
        rows = self._conn.execute(
            "SELECT predicted_s, actual_s FROM routes "
            "WHERE actual_s > 0 AND predicted_s > 0").fetchall()
        if not rows:
            return {"samples": 0}
        errors = [abs(r["predicted_s"] - r["actual_s"]) / r["actual_s"] for r in rows]
        return {
            "samples": len(rows),
            "median_relative_error": statistics.median(errors),
            "within_50pct": sum(1 for e in errors if e <= 0.5) / len(errors),
        }
