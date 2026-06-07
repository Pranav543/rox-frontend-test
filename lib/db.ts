import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DEFAULT_EPISODE } from "./media";
import type { AdMarker, AdMode } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function getDbPath(): string {
  if (isServerless()) {
    return path.join("/tmp", "vidpod.db");
  }
  return path.join(DATA_DIR, "vidpod.db");
}

let db: Database.Database | null = null;
let dbInitError: Error | null = null;

function getDb(): Database.Database {
  if (dbInitError) throw dbInitError;
  if (!db) {
    try {
      const dbPath = getDbPath();
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      db = new Database(dbPath);
      if (!isServerless()) {
        db.pragma("journal_mode = WAL");
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS ad_markers (
          id TEXT PRIMARY KEY,
          start_time REAL NOT NULL,
          mode TEXT NOT NULL,
          ad_ids TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ads (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          filename TEXT NOT NULL,
          duration REAL NOT NULL DEFAULT 15,
          created_at INTEGER NOT NULL
        );
      `);
      const row = db
        .prepare("SELECT value FROM settings WHERE key = 'episode_filename'")
        .get() as { value: string } | undefined;
      if (!row) {
        db
          .prepare("INSERT INTO settings (key, value) VALUES ('episode_filename', ?)")
          .run(DEFAULT_EPISODE);
      }
    } catch (err) {
      dbInitError =
        err instanceof Error ? err : new Error("Failed to initialize database");
      console.error("[db] init failed:", dbInitError.message);
      throw dbInitError;
    }
  }
  return db;
}

export function isDatabaseAvailable(): boolean {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

type Row = {
  id: string;
  start_time: number;
  mode: string;
  ad_ids: string;
};

function rowToMarker(row: Row): AdMarker {
  return {
    id: row.id,
    startTime: row.start_time,
    mode: row.mode as AdMode,
    adIds: JSON.parse(row.ad_ids) as string[],
  };
}

export function getEpisodeFilename(): string {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = 'episode_filename'")
    .get() as { value: string } | undefined;
  return row?.value ?? DEFAULT_EPISODE;
}

export function getEpisodeFilenameSafe(): string {
  try {
    return getEpisodeFilename();
  } catch {
    return DEFAULT_EPISODE;
  }
}

export function setEpisodeFilename(filename: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('episode_filename', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(filename);
}

export function listMarkers(): AdMarker[] {
  const rows = getDb()
    .prepare("SELECT * FROM ad_markers ORDER BY start_time ASC")
    .all() as Row[];
  return rows.map(rowToMarker);
}

export function listMarkersSafe(): AdMarker[] {
  try {
    return listMarkers();
  } catch {
    return [];
  }
}

export function getMarker(id: string): AdMarker | null {
  const row = getDb()
    .prepare("SELECT * FROM ad_markers WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? rowToMarker(row) : null;
}

export function createMarker(
  id: string,
  startTime: number,
  mode: AdMode,
  adIds: string[]
): AdMarker {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO ad_markers (id, start_time, mode, ad_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         start_time = excluded.start_time,
         mode = excluded.mode,
         ad_ids = excluded.ad_ids,
         updated_at = excluded.updated_at`
    )
    .run(id, startTime, mode, JSON.stringify(adIds), now, now);
  return { id, startTime, mode, adIds };
}

export function updateMarker(
  id: string,
  patch: Partial<{ startTime: number; mode: AdMode; adIds: string[] }>
): AdMarker | null {
  const existing = getMarker(id);
  if (!existing) return null;

  const next = {
    startTime: patch.startTime ?? existing.startTime,
    mode: patch.mode ?? existing.mode,
    adIds: patch.adIds ?? existing.adIds,
  };

  getDb()
    .prepare(
      `UPDATE ad_markers SET start_time = ?, mode = ?, ad_ids = ?, updated_at = ? WHERE id = ?`
    )
    .run(
      next.startTime,
      next.mode,
      JSON.stringify(next.adIds),
      Date.now(),
      id
    );

  return { id, ...next };
}

export function deleteMarker(id: string): boolean {
  const result = getDb().prepare("DELETE FROM ad_markers WHERE id = ?").run(id);
  return result.changes > 0;
}

type AdRow = { id: string; name: string; filename: string; duration: number };

export function listAdsFromDb(): AdRow[] {
  return getDb()
    .prepare("SELECT id, name, filename, duration FROM ads ORDER BY name")
    .all() as AdRow[];
}

export function upsertAd(
  id: string,
  name: string,
  filename: string,
  duration = 15
): void {
  getDb()
    .prepare(
      `INSERT INTO ads (id, name, filename, duration, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, filename = excluded.filename, duration = excluded.duration`
    )
    .run(id, name, filename, duration, Date.now());
}

export function syncDefaultAds(
  catalog: { id: string; name: string; filename: string; duration: number }[]
): void {
  for (const ad of catalog) {
    upsertAd(ad.id, ad.name, ad.filename, ad.duration);
  }
}
