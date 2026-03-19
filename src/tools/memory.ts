import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb, exportGraph, autoExport, type CompatDatabase } from "../lib/memory-db.js";
import { embed } from "../lib/embeddings.js";
import { findSimilar, storeEmbedding, invalidateEmbeddingCache } from "../lib/vector-search.js";
import {
  MemoryAddEntitiesSchema,
  MemoryAddRelationsSchema,
  MemoryAddObservationsSchema,
  MemoryQuerySchema,
  MemoryDeleteSchema,
  MemoryExportSchema,
  MemoryImportSchema,
  MemoryTrackActionSchema,
  MemorySuggestToolsSchema,
  MemoryContextSchema,
  MemoryLearnSchema,
  MemoryReflectSchema,
} from "../types.js";
import type {
  MemoryAddEntitiesInput,
  MemoryAddRelationsInput,
  MemoryAddObservationsInput,
  MemoryQueryInput,
  MemoryDeleteInput,
  MemoryImportInput,
  MemoryTrackActionInput,
  MemorySuggestToolsInput,
  MemoryContextInput,
  MemoryLearnInput,
  MemoryReflectInput,
} from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";

interface EntityRow {
  name: string;
  type: string;
}

interface RelationRow {
  src: string;
  rel: string;
  dst: string;
}

// --- Query helpers ---

function keywordSearch(db: CompatDatabase, name: string | undefined, type: string | undefined, limit: number): string[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (name) {
    conditions.push("name LIKE ?");
    params.push(`%${name}%`);
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT name FROM entities ${where} LIMIT ?`)
    .all(...params, limit) as { name: string }[];
  return rows.map((r) => r.name);
}

function graphTraversal(
  db: CompatDatabase,
  name: string | undefined,
  type: string | undefined,
  relation: string | undefined,
  depth: number,
  limit: number
): string[] {
  const seeds = keywordSearch(db, name, type, limit);
  if (seeds.length === 0) return [];

  const visited = new Set<string>();
  const result: string[] = [];
  let frontier = seeds;

  const getOutgoing = db.prepare(
    relation
      ? "SELECT src, rel, dst FROM relations WHERE src = ? AND rel = ?"
      : "SELECT src, rel, dst FROM relations WHERE src = ?"
  );

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];
    for (const entityName of frontier) {
      if (visited.has(entityName)) continue;
      visited.add(entityName);
      result.push(entityName);
      if (result.length >= limit) break;

      const rels = (
        relation
          ? getOutgoing.all(entityName, relation)
          : getOutgoing.all(entityName)
      ) as unknown as RelationRow[];
      for (const r of rels) {
        if (!visited.has(r.dst)) nextFrontier.push(r.dst);
      }
    }
    if (result.length >= limit) break;
    frontier = nextFrontier;
  }

  return result.slice(0, limit);
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
        const now = new Date().toISOString();
        const insertEntity = db.prepare(
          "INSERT OR IGNORE INTO entities (name, type, updated_at) VALUES (?, ?, ?)"
        );
        const touchEntity = db.prepare(
          "UPDATE entities SET updated_at = ? WHERE name = ?"
        );
        const insertObs = db.prepare(
          "INSERT OR IGNORE INTO observations (entity, content) VALUES (?, ?)"
        );

        let created = 0;
        const addAll = db.transaction(() => {
          for (const e of entities) {
            const result = insertEntity.run(e.name, e.type, now);
            if (result.changes > 0) {
              created++;
            } else {
              touchEntity.run(now, e.name);
            }
            if (e.observations) {
              for (const obs of e.observations) {
                insertObs.run(e.name, obs);
              }
            }
          }
        });
        addAll();

        autoExport(db);

        // Background: generate embeddings for new entities
        Promise.resolve().then(async () => {
          for (const e of entities) {
            try {
              const vec = await embed(`${e.name} (${e.type})`);
              if (vec) storeEmbedding(db, "entity", e.name, vec, "all-minilm");
              if (e.observations) {
                for (const obs of e.observations) {
                  const obsVec = await embed(obs);
                  if (obsVec) storeEmbedding(db, "observation", `${e.name}:${obs.slice(0, 50)}`, obsVec, "all-minilm");
                }
              }
            } catch { /* best-effort */ }
          }
        }).catch(() => {});

        return textResult(
          `Created ${created} new entities (${entities.length - created} already existed).`
        );
      } catch (err) {
        return catchToolError(err);
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
        return catchToolError(err);
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
          if (added > 0) {
            db.prepare("UPDATE entities SET updated_at = ? WHERE name = ?")
              .run(new Date().toISOString(), entity);
          }
        });
        addAll();

        autoExport(db);
        return textResult(
          `Added ${added} new observations to "${entity}" (${observations.length - added} duplicates skipped).`
        );
      } catch (err) {
        return catchToolError(err);
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
    async ({ query, name, type, mode, relation, depth, limit, since }: MemoryQueryInput) => {
      try {
        const db = await getDb();
        let entityNames: string[] = [];

        const getObservations = db.prepare(
          "SELECT content FROM observations WHERE entity = ? ORDER BY id"
        );

        // --- Resolve entity names based on mode ---
        if (mode === "temporal") {
          const sinceDate = since ?? new Date(Date.now() - 7 * 86400000).toISOString();
          const rows = db
            .prepare(
              "SELECT name, type FROM entities WHERE last_accessed >= ? ORDER BY last_accessed DESC LIMIT ?"
            )
            .all(sinceDate, limit) as unknown as EntityRow[];
          entityNames = rows.map((r) => r.name);

        } else if (mode === "semantic" || (mode === "hybrid" && query)) {
          const searchText = query ?? name ?? "";
          if (!searchText) {
            return textResult(JSON.stringify({ entities: [], relations: [] }, null, 2));
          }

          const queryVec = await embed(searchText);
          let semanticNames: string[] = [];

          if (queryVec) {
            const similar = findSimilar(db, queryVec, { limit: limit * 2, targetType: "entity" });
            semanticNames = similar.map((s) => s.target_id);
          }

          if (mode === "hybrid") {
            // Also do keyword search and merge
            const keywordNames = keywordSearch(db, name, type, limit);
            const merged = new Set([...semanticNames, ...keywordNames]);
            entityNames = [...merged].slice(0, limit);
          } else {
            entityNames = semanticNames.slice(0, limit);
          }

          // If semantic search returned nothing (no embeddings), fall back to keyword
          if (entityNames.length === 0) {
            entityNames = keywordSearch(db, name ?? query, type, limit);
          }

        } else if (mode === "graph") {
          entityNames = graphTraversal(db, name, type, relation, depth, limit);

        } else {
          // keyword mode (default fallback)
          entityNames = keywordSearch(db, name, type, limit);
        }

        if (entityNames.length === 0) {
          return textResult(JSON.stringify({ entities: [], relations: [] }, null, 2));
        }

        // Bump access tracking
        const now = new Date().toISOString();
        const bumpAccess = db.prepare(
          "UPDATE entities SET access_count = COALESCE(access_count, 0) + 1, last_accessed = ? WHERE name = ?"
        );
        for (const n of entityNames) {
          bumpAccess.run(now, n);
        }

        // Gather full entity data
        const entitiesWithObs = entityNames.map((n) => {
          const e = db.prepare("SELECT name, type FROM entities WHERE name = ?").get(n) as EntityRow | undefined;
          if (!e) return null;
          return {
            name: e.name,
            type: e.type,
            observations: (getObservations.all(e.name) as { content: string }[]).map((o) => o.content),
          };
        }).filter(Boolean);

        // Get relations between found entities
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
        return catchToolError(err);
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
        return catchToolError(err);
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
        return catchToolError(err);
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
        return catchToolError(err);
      }
    }
  );

  // --- memory_track_action ---
  server.registerTool(
    "memory_track_action",
    {
      description:
        "Track a substantive, repeatable action (build, test, deploy, lint, format, git workflow) " +
        "so the system can detect patterns and suggest new MCP tools. " +
        "Do NOT track trivial commands (ls, cd, file reads, one-off searches).",
      inputSchema: MemoryTrackActionSchema,
    },
    async ({ command, description, project, tags, category, outcome, duration_ms }: MemoryTrackActionInput) => {
      try {
        const db = await getDb();
        const tagsJson = tags ? JSON.stringify(tags) : null;
        db.prepare(
          "INSERT INTO tracked_actions (command, description, project, tags, category, outcome, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(command, description ?? null, project ?? null, tagsJson, category ?? null, outcome ?? null, duration_ms ?? null);

        const row = db.prepare(
          "SELECT COUNT(*) as count FROM tracked_actions WHERE command = ?"
        ).get(command) as { count: number };

        autoExport(db);
        return textResult(
          `Tracked action "${command}" (total occurrences: ${row.count}).`
        );
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // --- memory_suggest_tools ---
  server.registerTool(
    "memory_suggest_tools",
    {
      description:
        "Analyze tracked actions to find repeated patterns that could become new MCP tools. " +
        "Returns exact command matches and tag-based clusters that exceed the occurrence/project thresholds.",
      inputSchema: MemorySuggestToolsSchema,
    },
    async ({ min_occurrences, min_projects, category, limit }: MemorySuggestToolsInput) => {
      try {
        const db = await getDb();

        // Tier 1: Exact command matches
        const catFilter = category ? " WHERE category = ?" : "";
        const catParams: unknown[] = category ? [category] : [];

        const exactRows = db.prepare(
          `SELECT command, description, category, ` +
          `COUNT(*) as occurrences, ` +
          `COUNT(DISTINCT project) as project_count, ` +
          `GROUP_CONCAT(DISTINCT project) as projects, ` +
          `MIN(created) as first_seen, ` +
          `MAX(created) as last_seen ` +
          `FROM tracked_actions${catFilter} ` +
          `GROUP BY command ` +
          `HAVING COUNT(*) >= ? AND COUNT(DISTINCT project) >= ? ` +
          `ORDER BY COUNT(*) DESC, COUNT(DISTINCT project) DESC ` +
          `LIMIT ?`
        ).all(...catParams, min_occurrences, min_projects, limit) as Record<string, unknown>[];

        const exactMatches = exactRows.map((r) => ({
          command: r.command as string,
          description: r.description as string | null,
          category: r.category as string | null,
          occurrences: r.occurrences as number,
          project_count: r.project_count as number,
          projects: r.projects ? (r.projects as string).split(",") : [],
          first_seen: r.first_seen as string,
          last_seen: r.last_seen as string,
          suggestion: `Used ${r.occurrences} times across ${r.project_count} project(s). Consider creating an MCP tool.`,
        }));

        // Tier 2: Tag-based clusters (parse in JS since json_each may not be available)
        const allActions = db.prepare(
          `SELECT command, project, tags FROM tracked_actions WHERE tags IS NOT NULL${category ? " AND category = ?" : ""}`
        ).all(...catParams) as { command: string; project: string | null; tags: string }[];

        const tagStats = new Map<string, { commands: Set<string>; projects: Set<string>; count: number }>();
        for (const row of allActions) {
          let parsed: string[];
          try {
            parsed = JSON.parse(row.tags) as string[];
          } catch {
            continue;
          }
          for (const tag of parsed) {
            const stats = tagStats.get(tag) ?? { commands: new Set(), projects: new Set(), count: 0 };
            stats.commands.add(row.command);
            if (row.project) stats.projects.add(row.project);
            stats.count++;
            tagStats.set(tag, stats);
          }
        }

        const tagPatterns = [...tagStats.entries()]
          .filter(([, s]) => s.commands.size >= 2 && s.count >= min_occurrences)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, limit)
          .map(([tag, s]) => ({
            tag,
            total_uses: s.count,
            distinct_commands: s.commands.size,
            distinct_projects: s.projects.size,
            example_commands: [...s.commands].slice(0, 5),
            suggestion: `Tag "${tag}" appears in ${s.commands.size} distinct commands (${s.count} total uses). These may share a generalizable pattern.`,
          }));

        const result = { exact_matches: exactMatches, tag_patterns: tagPatterns };
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // --- memory_context ---
  server.registerTool(
    "memory_context",
    {
      description:
        "Load session-start context: user preferences, project-related entities, and recently accessed knowledge. " +
        "Call this once at the beginning of a session instead of memory_query with no filters.",
      inputSchema: MemoryContextSchema,
    },
    async ({ project, include_preferences, include_recent, recent_days, max_entities }: MemoryContextInput) => {
      try {
        const db = await getDb();
        const seen = new Set<string>();
        const entities: { name: string; type: string; observations: string[] }[] = [];

        const getObs = db.prepare("SELECT content FROM observations WHERE entity = ? ORDER BY id");
        const addEntity = (row: EntityRow) => {
          if (seen.has(row.name) || entities.length >= max_entities) return;
          seen.add(row.name);
          entities.push({
            name: row.name,
            type: row.type,
            observations: (getObs.all(row.name) as { content: string }[]).map((o) => o.content),
          });
        };

        // 1. User preferences and conventions
        if (include_preferences) {
          const prefs = db.prepare(
            "SELECT name, type FROM entities WHERE type IN ('preference', 'convention') ORDER BY name"
          ).all() as unknown as EntityRow[];
          for (const p of prefs) addEntity(p);
        }

        // 2. Project-related entities
        if (project) {
          // Direct name match
          const direct = db.prepare(
            "SELECT name, type FROM entities WHERE name LIKE ?"
          ).all(`%${project}%`) as unknown as EntityRow[];
          for (const d of direct) addEntity(d);

          // Entities related to the project
          const related = db.prepare(
            "SELECT e.name, e.type FROM entities e " +
            "JOIN relations r ON (r.src = e.name OR r.dst = e.name) " +
            "WHERE r.src LIKE ? OR r.dst LIKE ? LIMIT 50"
          ).all(`%${project}%`, `%${project}%`) as unknown as EntityRow[];
          for (const r of related) addEntity(r);
        }

        // 3. Recently accessed
        if (include_recent) {
          const sinceDate = new Date(Date.now() - recent_days * 86400000).toISOString();
          const recent = db.prepare(
            "SELECT name, type FROM entities WHERE last_accessed >= ? ORDER BY last_accessed DESC LIMIT ?"
          ).all(sinceDate, max_entities) as unknown as EntityRow[];
          for (const r of recent) addEntity(r);
        }

        return textResult(JSON.stringify({ entities, count: entities.length }, null, 2));
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // --- memory_learn ---
  server.registerTool(
    "memory_learn",
    {
      description:
        "Store knowledge in a single call. Provide free-text and optionally an entity name. " +
        "If the entity exists, adds as observation. If not, creates it. " +
        "Replaces the 3-call pattern of add_entities + add_observations + add_relations.",
      inputSchema: MemoryLearnSchema,
    },
    async ({ text, entity, type, source }: MemoryLearnInput) => {
      try {
        const db = await getDb();
        const now = new Date().toISOString();
        const entityType = type ?? "knowledge";
        const obsSource = source ?? "manual";

        let targetEntity: string;

        if (entity) {
          // Use specified entity — create if needed
          targetEntity = entity;
          db.prepare(
            "INSERT OR IGNORE INTO entities (name, type, updated_at) VALUES (?, ?, ?)"
          ).run(targetEntity, entityType, now);
        } else {
          // Try to find an existing entity mentioned in the text
          const allEntities = db.prepare("SELECT name FROM entities").all() as { name: string }[];
          const matched = allEntities.find((e) =>
            text.toLowerCase().includes(e.name.toLowerCase())
          );

          if (matched) {
            targetEntity = matched.name;
          } else {
            // Create a new entity from the first meaningful phrase
            targetEntity = text.length > 60 ? text.slice(0, 60).replace(/\s+\S*$/, "") : text;
            db.prepare(
              "INSERT OR IGNORE INTO entities (name, type, updated_at) VALUES (?, ?, ?)"
            ).run(targetEntity, entityType, now);
          }
        }

        // Add the text as an observation
        const result = db.prepare(
          "INSERT OR IGNORE INTO observations (entity, content, source, confidence) VALUES (?, ?, ?, 1.0)"
        ).run(targetEntity, text, obsSource);

        db.prepare("UPDATE entities SET updated_at = ? WHERE name = ?").run(now, targetEntity);

        // Background: generate embedding
        Promise.resolve().then(async () => {
          try {
            const vec = await embed(text);
            if (vec) storeEmbedding(db, "observation", `${targetEntity}:${text.slice(0, 50)}`, vec, "all-minilm");
          } catch { /* best-effort */ }
        }).catch(() => {});

        autoExport(db);

        if (result.changes > 0) {
          return textResult(`Learned: added observation to "${targetEntity}"`);
        }
        return textResult(`"${targetEntity}" already has this observation (duplicate skipped).`);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // --- memory_reflect ---
  server.registerTool(
    "memory_reflect",
    {
      description:
        "Analyze the knowledge graph for health, staleness, contradictions, clusters, or tool usage. " +
        "Use periodically to maintain graph quality.",
      inputSchema: MemoryReflectSchema,
    },
    async ({ mode, dry_run }: MemoryReflectInput) => {
      try {
        const db = await getDb();

        if (mode === "stats") {
          const entityCount = (db.prepare("SELECT COUNT(*) as c FROM entities").get() as { c: number }).c;
          const obsCount = (db.prepare("SELECT COUNT(*) as c FROM observations").get() as { c: number }).c;
          const relCount = (db.prepare("SELECT COUNT(*) as c FROM relations").get() as { c: number }).c;
          const actionCount = (db.prepare("SELECT COUNT(*) as c FROM tracked_actions").get() as { c: number }).c;
          const embeddingCount = (db.prepare("SELECT COUNT(*) as c FROM embeddings").get() as { c: number }).c;
          const orphans = (db.prepare(
            "SELECT COUNT(*) as c FROM entities e WHERE NOT EXISTS (SELECT 1 FROM relations r WHERE r.src = e.name OR r.dst = e.name)"
          ).get() as { c: number }).c;
          const avgObs = entityCount > 0 ? (obsCount / entityCount).toFixed(1) : "0";

          return textResult(JSON.stringify({
            entities: entityCount,
            observations: obsCount,
            relations: relCount,
            tracked_actions: actionCount,
            embeddings: embeddingCount,
            orphan_entities: orphans,
            avg_observations_per_entity: parseFloat(avgObs),
          }, null, 2));
        }

        if (mode === "stale") {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
          const stale = db.prepare(
            "SELECT name, type, last_accessed, access_count FROM entities " +
            "WHERE (last_accessed IS NULL OR last_accessed < ?) ORDER BY last_accessed ASC LIMIT 20"
          ).all(thirtyDaysAgo) as { name: string; type: string; last_accessed: string | null; access_count: number }[];

          return textResult(JSON.stringify({
            stale_entities: stale.map((e) => ({
              name: e.name,
              type: e.type,
              last_accessed: e.last_accessed ?? "never",
              access_count: e.access_count ?? 0,
            })),
            count: stale.length,
            note: dry_run ? "Dry run — no changes made" : "Review and delete with memory_delete",
          }, null, 2));
        }

        if (mode === "contradictions") {
          // Find observations on the same entity with opposing keywords
          const opposites = [
            ["prefers", "avoids"], ["use", "don't use"], ["always", "never"],
            ["enable", "disable"], ["add", "remove"],
          ];
          const allObs = db.prepare(
            "SELECT entity, content FROM observations ORDER BY entity"
          ).all() as { entity: string; content: string }[];

          const byEntity = new Map<string, string[]>();
          for (const o of allObs) {
            const list = byEntity.get(o.entity) ?? [];
            list.push(o.content);
            byEntity.set(o.entity, list);
          }

          const conflicts: { entity: string; observation_a: string; observation_b: string; keywords: string[] }[] = [];
          for (const [entity, observations] of byEntity) {
            for (let i = 0; i < observations.length; i++) {
              for (let j = i + 1; j < observations.length; j++) {
                const a = observations[i].toLowerCase();
                const b = observations[j].toLowerCase();
                for (const [pos, neg] of opposites) {
                  if ((a.includes(pos) && b.includes(neg)) || (a.includes(neg) && b.includes(pos))) {
                    conflicts.push({ entity, observation_a: observations[i], observation_b: observations[j], keywords: [pos, neg] });
                  }
                }
              }
            }
          }

          return textResult(JSON.stringify({
            potential_contradictions: conflicts.slice(0, 20),
            count: conflicts.length,
            note: "Review manually — keyword matching may produce false positives",
          }, null, 2));
        }

        if (mode === "clusters") {
          // Find entities that share the most relations
          const rels = db.prepare(
            "SELECT src, dst, COUNT(*) as shared FROM relations GROUP BY src, dst ORDER BY shared DESC LIMIT 20"
          ).all() as { src: string; dst: string; shared: number }[];

          return textResult(JSON.stringify({
            strongly_connected: rels.map((r) => ({
              entity_a: r.src,
              entity_b: r.dst,
              relation_count: r.shared,
            })),
            count: rels.length,
          }, null, 2));
        }

        if (mode === "tools") {
          const events = db.prepare(
            "SELECT event_type, COUNT(*) as count FROM event_log GROUP BY event_type ORDER BY count DESC"
          ).all() as { event_type: string; count: number }[];

          const recentEvents = db.prepare(
            "SELECT event_type, payload, created_at FROM event_log ORDER BY created_at DESC LIMIT 20"
          ).all() as { event_type: string; payload: string; created_at: string }[];

          return textResult(JSON.stringify({
            event_summary: events,
            recent_events: recentEvents.map((e) => ({
              type: e.event_type,
              created_at: e.created_at,
              payload: (() => { try { return JSON.parse(e.payload); } catch { return e.payload; } })(),
            })),
          }, null, 2));
        }

        return errorResult(`Unknown reflect mode: ${mode}`);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
