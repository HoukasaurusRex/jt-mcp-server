import Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_DIR = join(homedir(), ".jt-memory");
const DB_PATH = process.env.JT_MEMORY_DB ?? join(DEFAULT_DIR, "memory.db");
const EXPORT_PATH = process.env.JT_MEMORY_EXPORT_PATH ?? join(DEFAULT_DIR, "memory.json");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS entities (
  name    TEXT PRIMARY KEY,
  type    TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS observations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entity    TEXT NOT NULL REFERENCES entities(name) ON DELETE CASCADE,
  content   TEXT NOT NULL,
  created   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity, content)
);

CREATE TABLE IF NOT EXISTS relations (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  src     TEXT NOT NULL REFERENCES entities(name) ON DELETE CASCADE,
  rel     TEXT NOT NULL,
  dst     TEXT NOT NULL REFERENCES entities(name) ON DELETE CASCADE,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(src, rel, dst)
);

CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity);
CREATE INDEX IF NOT EXISTS idx_relations_src ON relations(src);
CREATE INDEX IF NOT EXISTS idx_relations_dst ON relations(dst);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
`;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (DB_PATH !== ":memory:") {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(SCHEMA_SQL);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export interface ExportData {
  version: number;
  exported_at: string;
  entities: { name: string; type: string; observations: string[] }[];
  relations: { src: string; rel: string; dst: string }[];
}

export function exportGraph(db: Database.Database): ExportData {
  const entities = db
    .prepare("SELECT name, type FROM entities ORDER BY name")
    .all() as { name: string; type: string }[];

  const observations = db
    .prepare("SELECT entity, content FROM observations ORDER BY entity, id")
    .all() as { entity: string; content: string }[];

  const obsByEntity = new Map<string, string[]>();
  for (const o of observations) {
    const list = obsByEntity.get(o.entity) ?? [];
    list.push(o.content);
    obsByEntity.set(o.entity, list);
  }

  const relations = db
    .prepare("SELECT src, rel, dst FROM relations ORDER BY src, rel, dst")
    .all() as { src: string; rel: string; dst: string }[];

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    entities: entities.map((e) => ({
      name: e.name,
      type: e.type,
      observations: obsByEntity.get(e.name) ?? [],
    })),
    relations,
  };
}

export function autoExport(db: Database.Database): void {
  if (!EXPORT_PATH) return;
  try {
    if (EXPORT_PATH !== ":memory:" && DB_PATH !== ":memory:") {
      mkdirSync(dirname(EXPORT_PATH), { recursive: true });
      const data = exportGraph(db);
      writeFileSync(EXPORT_PATH, JSON.stringify(data, null, 2));
    }
  } catch {
    // Auto-export is best-effort; don't fail the tool operation
  }
}
