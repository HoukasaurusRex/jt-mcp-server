import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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

// --- Compatibility layer matching the better-sqlite3 API subset we use ---

export interface RunResult {
  changes: number;
}

export interface CompatStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export interface CompatDatabase {
  prepare(sql: string): CompatStatement;
  exec(sql: string): void;
  pragma(cmd: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

function wrapDatabase(raw: SqlJsDatabase, dbPath: string): CompatDatabase {
  function save(): void {
    if (dbPath === ":memory:") return;
    try {
      mkdirSync(dirname(dbPath), { recursive: true });
      const data = raw.export();
      writeFileSync(dbPath, Buffer.from(data));
    } catch {
      // best-effort persistence
    }
  }

  const db: CompatDatabase = {
    prepare(sql: string): CompatStatement {
      return {
        run(...params: unknown[]): RunResult {
          const stmt = raw.prepare(sql);
          try {
            stmt.run(params.length > 0 ? params as initSqlJs.BindParams : undefined);
            return { changes: raw.getRowsModified() };
          } finally {
            stmt.free();
          }
        },
        get(...params: unknown[]): Record<string, unknown> | undefined {
          const stmt = raw.prepare(sql);
          try {
            if (params.length > 0) stmt.bind(params as initSqlJs.BindParams);
            if (!stmt.step()) return undefined;
            return stmt.getAsObject() as Record<string, unknown>;
          } finally {
            stmt.free();
          }
        },
        all(...params: unknown[]): Record<string, unknown>[] {
          const stmt = raw.prepare(sql);
          try {
            if (params.length > 0) stmt.bind(params as initSqlJs.BindParams);
            const rows: Record<string, unknown>[] = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject() as Record<string, unknown>);
            }
            return rows;
          } finally {
            stmt.free();
          }
        },
      };
    },

    exec(sql: string): void {
      raw.run(sql);
      save();
    },

    pragma(cmd: string): void {
      raw.run(`PRAGMA ${cmd}`);
    },

    transaction<T>(fn: () => T): () => T {
      return () => {
        raw.run("BEGIN");
        try {
          const result = fn();
          raw.run("COMMIT");
          save();
          return result;
        } catch (err) {
          raw.run("ROLLBACK");
          throw err;
        }
      };
    },

    close(): void {
      save();
      raw.close();
    },
  };

  return db;
}

// --- Singleton ---

let _db: CompatDatabase | null = null;
let _initPromise: Promise<CompatDatabase> | null = null;

export async function getDb(): Promise<CompatDatabase> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const SQL = await initSqlJs();

    let raw: SqlJsDatabase;
    if (DB_PATH !== ":memory:" && existsSync(DB_PATH)) {
      const buffer = readFileSync(DB_PATH);
      raw = new SQL.Database(buffer);
    } else {
      raw = new SQL.Database();
    }

    const db = wrapDatabase(raw, DB_PATH);
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA_SQL);

    _db = db;
    return db;
  })();

  return _initPromise;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _initPromise = null;
  }
}

/** For tests: inject a pre-built compat database */
export function _setDb(db: CompatDatabase | null): void {
  _db = db;
  _initPromise = db ? Promise.resolve(db) : null;
}

// --- Export / Import helpers ---

export interface ExportData {
  version: number;
  exported_at: string;
  entities: { name: string; type: string; observations: string[] }[];
  relations: { src: string; rel: string; dst: string }[];
}

export function exportGraph(db: CompatDatabase): ExportData {
  const entities = db
    .prepare("SELECT name, type FROM entities ORDER BY name")
    .all() as { name: string; type: string }[];

  const observations = db
    .prepare("SELECT entity, content FROM observations ORDER BY entity, id")
    .all() as { entity: string; content: string }[];

  const obsByEntity = new Map<string, string[]>();
  for (const o of observations) {
    const list = obsByEntity.get(o.entity as string) ?? [];
    list.push(o.content as string);
    obsByEntity.set(o.entity as string, list);
  }

  const relations = db
    .prepare("SELECT src, rel, dst FROM relations ORDER BY src, rel, dst")
    .all() as { src: string; rel: string; dst: string }[];

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    entities: entities.map((e) => ({
      name: e.name as string,
      type: e.type as string,
      observations: obsByEntity.get(e.name as string) ?? [],
    })),
    relations: relations.map((r) => ({
      src: r.src as string,
      rel: r.rel as string,
      dst: r.dst as string,
    })),
  };
}

export function autoExport(db: CompatDatabase): void {
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
