import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb, exportGraph, autoExport } from "../lib/memory-db.js";
import {
  MemoryAddEntitiesSchema,
  MemoryAddRelationsSchema,
  MemoryAddObservationsSchema,
  MemoryQuerySchema,
  MemoryDeleteSchema,
  MemoryExportSchema,
  MemoryImportSchema,
} from "../types.js";
import type {
  MemoryAddEntitiesInput,
  MemoryAddRelationsInput,
  MemoryAddObservationsInput,
  MemoryQueryInput,
  MemoryDeleteInput,
  MemoryImportInput,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

interface EntityRow {
  name: string;
  type: string;
}

interface RelationRow {
  src: string;
  rel: string;
  dst: string;
}

export function register(server: McpServer): void {
  // --- memory_add_entities ---
  server.registerTool(
    "memory_add_entities",
    {
      description:
        "Create entities in the knowledge graph with a name, type, and optional observations. " +
        "Use this to store user preferences, tools, projects, conventions, and any facts worth remembering across sessions.",
      inputSchema: MemoryAddEntitiesSchema,
    },
    async ({ entities }: MemoryAddEntitiesInput) => {
      try {
        const db = await getDb();
        const insertEntity = db.prepare(
          "INSERT OR IGNORE INTO entities (name, type) VALUES (?, ?)"
        );
        const insertObs = db.prepare(
          "INSERT OR IGNORE INTO observations (entity, content) VALUES (?, ?)"
        );

        let created = 0;
        const addAll = db.transaction(() => {
          for (const e of entities) {
            const result = insertEntity.run(e.name, e.type);
            if (result.changes > 0) created++;
            if (e.observations) {
              for (const obs of e.observations) {
                insertObs.run(e.name, obs);
              }
            }
          }
        });
        addAll();

        autoExport(db);
        return textResult(
          `Created ${created} new entities (${entities.length - created} already existed).`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_add_relations ---
  server.registerTool(
    "memory_add_relations",
    {
      description:
        "Create typed directed relations between entities in the knowledge graph. " +
        "Common relation types: PREFERS, USES, AVOIDS, DEPENDS_ON, CATEGORY_OF, RELATED_TO, WORKS_ON, CREATED_BY.",
      inputSchema: MemoryAddRelationsSchema,
    },
    async ({ relations }: MemoryAddRelationsInput) => {
      try {
        const db = await getDb();
        const checkEntity = db.prepare(
          "SELECT name FROM entities WHERE name = ?"
        );
        const insertRel = db.prepare(
          "INSERT OR IGNORE INTO relations (src, rel, dst) VALUES (?, ?, ?)"
        );

        const missing: string[] = [];
        let created = 0;

        const addAll = db.transaction(() => {
          for (const r of relations) {
            if (!checkEntity.get(r.src)) missing.push(r.src);
            if (!checkEntity.get(r.dst)) missing.push(r.dst);
          }
          if (missing.length > 0) return;
          for (const r of relations) {
            const result = insertRel.run(r.src, r.rel, r.dst);
            if (result.changes > 0) created++;
          }
        });
        addAll();

        if (missing.length > 0) {
          const unique = [...new Set(missing)];
          return errorResult(
            `Entities not found: ${unique.join(", ")}. Create them first with memory_add_entities.`
          );
        }

        autoExport(db);
        return textResult(
          `Created ${created} new relations (${relations.length - created} already existed).`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_add_observations ---
  server.registerTool(
    "memory_add_observations",
    {
      description:
        "Add observations (facts, attributes, notes) to an existing entity in the knowledge graph.",
      inputSchema: MemoryAddObservationsSchema,
    },
    async ({ entity, observations }: MemoryAddObservationsInput) => {
      try {
        const db = await getDb();
        const check = db.prepare(
          "SELECT name FROM entities WHERE name = ?"
        );
        if (!check.get(entity)) {
          return errorResult(
            `Entity "${entity}" not found. Create it first with memory_add_entities.`
          );
        }

        const insertObs = db.prepare(
          "INSERT OR IGNORE INTO observations (entity, content) VALUES (?, ?)"
        );
        let added = 0;
        const addAll = db.transaction(() => {
          for (const obs of observations) {
            const result = insertObs.run(entity, obs);
            if (result.changes > 0) added++;
          }
        });
        addAll();

        autoExport(db);
        return textResult(
          `Added ${added} new observations to "${entity}" (${observations.length - added} duplicates skipped).`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_query ---
  server.registerTool(
    "memory_query",
    {
      description:
        "Query the knowledge graph to retrieve entities, their observations, and relations. " +
        "Call this at the start of every session to load user preferences and project context. " +
        "Supports search by name (substring), type filter, relation filter, and BFS traversal up to depth 5.",
      inputSchema: MemoryQuerySchema,
    },
    async ({ name, type, relation, depth, limit }: MemoryQueryInput) => {
      try {
        const db = await getDb();

        // Find seed entities
        const conditions: string[] = [];
        const params: string[] = [];
        if (name) {
          conditions.push("name LIKE ?");
          params.push(`%${name}%`);
        }
        if (type) {
          conditions.push("type = ?");
          params.push(type);
        }

        const where =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const seeds = db
          .prepare(`SELECT name, type FROM entities ${where} LIMIT ?`)
          .all(...params, limit) as unknown as EntityRow[];

        if (seeds.length === 0) {
          return textResult(JSON.stringify({ entities: [], relations: [] }, null, 2));
        }

        // BFS traversal
        const visited = new Set<string>();
        const allEntities: EntityRow[] = [];
        let frontier = seeds.map((s) => s.name);

        const getEntity = db.prepare(
          "SELECT name, type FROM entities WHERE name = ?"
        );
        const getOutgoing = db.prepare(
          relation
            ? "SELECT src, rel, dst FROM relations WHERE src = ? AND rel = ?"
            : "SELECT src, rel, dst FROM relations WHERE src = ?"
        );
        const getObservations = db.prepare(
          "SELECT content FROM observations WHERE entity = ? ORDER BY id"
        );

        for (let d = 0; d < depth && frontier.length > 0; d++) {
          const nextFrontier: string[] = [];
          for (const entityName of frontier) {
            if (visited.has(entityName)) continue;
            visited.add(entityName);

            const entity =
              allEntities.find((e) => e.name === entityName) ??
              (getEntity.get(entityName) as EntityRow | undefined);
            if (!entity) continue;
            if (!allEntities.some((e) => e.name === entity.name)) {
              allEntities.push(entity);
            }

            if (allEntities.length >= limit) break;

            const rels = (
              relation
                ? getOutgoing.all(entityName, relation)
                : getOutgoing.all(entityName)
            ) as unknown as RelationRow[];
            for (const r of rels) {
              if (!visited.has(r.dst)) {
                nextFrontier.push(r.dst);
              }
            }
          }
          if (allEntities.length >= limit) break;
          frontier = nextFrontier;
        }

        // Gather observations and relations for all found entities
        const entityNames = allEntities.map((e) => e.name);
        const entitiesWithObs = allEntities.slice(0, limit).map((e) => ({
          name: e.name,
          type: e.type,
          observations: (
            getObservations.all(e.name) as { content: string }[]
          ).map((o) => o.content),
        }));

        // Get all relations between found entities
        const placeholders = entityNames.map(() => "?").join(",");
        const allRelations =
          entityNames.length > 0
            ? (db
                .prepare(
                  `SELECT src, rel, dst FROM relations WHERE src IN (${placeholders}) AND dst IN (${placeholders})`
                )
                .all(...entityNames, ...entityNames) as unknown as RelationRow[])
            : [];

        return textResult(
          JSON.stringify(
            { entities: entitiesWithObs, relations: allRelations },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_delete ---
  server.registerTool(
    "memory_delete",
    {
      description:
        "Delete entities, relations, or observations from the knowledge graph. " +
        "Deleting an entity cascades to its observations and relations.",
      inputSchema: MemoryDeleteSchema,
    },
    async ({ entities, relations, observations }: MemoryDeleteInput) => {
      try {
        const db = await getDb();
        const summary: string[] = [];

        const deleteAll = db.transaction(() => {
          if (entities && entities.length > 0) {
            const del = db.prepare("DELETE FROM entities WHERE name = ?");
            let count = 0;
            for (const name of entities) {
              const result = del.run(name);
              count += result.changes;
            }
            summary.push(`Deleted ${count} entities.`);
          }

          if (relations && relations.length > 0) {
            const del = db.prepare(
              "DELETE FROM relations WHERE src = ? AND rel = ? AND dst = ?"
            );
            let count = 0;
            for (const r of relations) {
              const result = del.run(r.src, r.rel, r.dst);
              count += result.changes;
            }
            summary.push(`Deleted ${count} relations.`);
          }

          if (observations && observations.length > 0) {
            const del = db.prepare(
              "DELETE FROM observations WHERE entity = ? AND content = ?"
            );
            let count = 0;
            for (const o of observations) {
              const result = del.run(o.entity, o.content);
              count += result.changes;
            }
            summary.push(`Deleted ${count} observations.`);
          }
        });
        deleteAll();

        if (summary.length === 0) {
          return textResult("Nothing to delete — no entities, relations, or observations specified.");
        }

        autoExport(db);
        return textResult(summary.join(" "));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_export ---
  server.registerTool(
    "memory_export",
    {
      description:
        "Export the entire knowledge graph as JSON. Use this to create backups or share your memory database.",
      inputSchema: MemoryExportSchema,
    },
    async () => {
      try {
        const db = await getDb();
        const data = exportGraph(db);
        return textResult(JSON.stringify(data, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- memory_import ---
  server.registerTool(
    "memory_import",
    {
      description:
        "Import a knowledge graph from JSON. Use merge mode to add to existing data, or replace mode to start fresh.",
      inputSchema: MemoryImportSchema,
    },
    async ({ data, merge }: MemoryImportInput) => {
      try {
        const db = await getDb();

        const importAll = db.transaction(() => {
          if (!merge) {
            db.exec("DELETE FROM relations");
            db.exec("DELETE FROM observations");
            db.exec("DELETE FROM entities");
          }

          const insertEntity = db.prepare(
            "INSERT OR IGNORE INTO entities (name, type) VALUES (?, ?)"
          );
          const insertObs = db.prepare(
            "INSERT OR IGNORE INTO observations (entity, content) VALUES (?, ?)"
          );
          const insertRel = db.prepare(
            "INSERT OR IGNORE INTO relations (src, rel, dst) VALUES (?, ?, ?)"
          );

          for (const e of data.entities) {
            insertEntity.run(e.name, e.type);
            for (const obs of e.observations) {
              insertObs.run(e.name, obs);
            }
          }
          for (const r of data.relations) {
            insertRel.run(r.src, r.rel, r.dst);
          }
        });
        importAll();

        autoExport(db);
        return textResult(
          `Imported ${data.entities.length} entities and ${data.relations.length} relations (mode: ${merge ? "merge" : "replace"}).`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
