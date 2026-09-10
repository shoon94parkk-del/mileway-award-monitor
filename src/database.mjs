import { DatabaseSync } from "node:sqlite";
import { databasePath, ensureDataDirs } from "./config.mjs";

export function openDatabase() {
  ensureDataDirs();
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      checked_at TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER,
      payload_hash TEXT,
      raw_file TEXT
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES runs(id),
      travel_date TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      flight TEXT,
      cabin TEXT NOT NULL,
      fare_class TEXT,
      available INTEGER NOT NULL,
      seats INTEGER,
      source_path TEXT,
      observed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS observations_lookup
      ON observations(travel_date, origin, destination, cabin, fare_class, observed_at);

    CREATE TABLE IF NOT EXISTS current_state (
      state_key TEXT PRIMARY KEY,
      travel_date TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      flight TEXT,
      cabin TEXT NOT NULL,
      fare_class TEXT,
      available INTEGER NOT NULL,
      seats INTEGER,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      event_type TEXT NOT NULL,
      state_key TEXT NOT NULL,
      travel_date TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      flight TEXT,
      cabin TEXT NOT NULL,
      fare_class TEXT,
      seats INTEGER,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function rowKey(row) {
  return [row.date, row.origin, row.destination, row.flight || "", row.cabin, row.fareClass || ""].join("|");
}

export function recordRun(db, { endpoint, statusCode, payloadHash, rawFile, rows, notifyOnFirstSeen = true }) {
  const now = new Date().toISOString();
  const events = [];
  const insertRun = db.prepare(`
    INSERT INTO runs (checked_at, endpoint, status_code, payload_hash, raw_file)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertObservation = db.prepare(`
    INSERT INTO observations (
      run_id, travel_date, origin, destination, flight, cabin, fare_class,
      available, seats, source_path, observed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const readState = db.prepare("SELECT * FROM current_state WHERE state_key = ?");
  const upsertState = db.prepare(`
    INSERT INTO current_state (
      state_key, travel_date, origin, destination, flight, cabin, fare_class,
      available, seats, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(state_key) DO UPDATE SET
      available = excluded.available,
      seats = excluded.seats,
      last_seen_at = excluded.last_seen_at
  `);
  const insertEvent = db.prepare(`
    INSERT INTO events (
      event_type, state_key, travel_date, origin, destination, flight,
      cabin, fare_class, seats, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    const run = insertRun.run(now, endpoint, statusCode, payloadHash, rawFile || null);
    const runId = Number(run.lastInsertRowid);
    for (const row of rows) {
      const key = rowKey(row);
      const previous = readState.get(key);
      insertObservation.run(
        runId,
        row.date,
        row.origin,
        row.destination,
        row.flight,
        row.cabin,
        row.fareClass,
        row.available ? 1 : 0,
        row.seats,
        row.sourcePath,
        now,
      );

      let eventType = null;
      if (!previous && row.available && notifyOnFirstSeen) eventType = "NEW";
      if (previous && !previous.available && row.available) eventType = "NEW";
      if (previous && previous.available && !row.available) eventType = "GONE";

      upsertState.run(
        key,
        row.date,
        row.origin,
        row.destination,
        row.flight,
        row.cabin,
        row.fareClass,
        row.available ? 1 : 0,
        row.seats,
        previous?.first_seen_at || now,
        now,
      );

      if (eventType) {
        insertEvent.run(eventType, key, row.date, row.origin, row.destination, row.flight, row.cabin, row.fareClass, row.seats, now);
        events.push({ type: eventType, ...row, createdAt: now });
      }
    }
    db.exec("COMMIT");
    return { runId, events };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listCurrent(db, { availableOnly = false } = {}) {
  const sql = `
    SELECT
      travel_date AS date,
      origin,
      destination,
      flight,
      cabin,
      fare_class AS fareClass,
      available,
      seats,
      last_seen_at AS lastSeenAt
    FROM current_state
    ${availableOnly ? "WHERE available = 1" : ""}
    ORDER BY travel_date, origin, destination, cabin, fare_class
  `;
  return db.prepare(sql).all().map((row) => ({ ...row, available: Boolean(row.available) }));
}
