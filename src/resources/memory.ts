/**
 * MCP Resources for the knowledge graph.
 * Exposes graph data as subscribable resources for passive context injection.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb, exportGraph } from "../lib/memory-db.js";

export function register(server: McpServer): void {
  // --- memory://preferences ---
  server.registerResource(
    "user-preferences",
    "memory://preferences",
    { description: "All user preference and convention entities with their observations" },
    async () => {
      const db = await getDb();
      const entities = db.prepare(
        "SELECT name, type FROM entities WHERE type IN ('preference', 'convention') ORDER BY name"
      ).all() as { name: string; type: string }[];

      const getObs = db.prepare("SELECT content FROM observations WHERE entity = ? ORDER BY id");
      const result = entities.map((e) => ({
        name: e.name,
        type: e.type,
        observations: (getObs.all(e.name) as { content: string }[]).map((o) => o.content),
      }));

      return {
        contents: [{
          uri: "memory://preferences",
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // --- memory://recent ---
  server.registerResource(
    "recent-knowledge",
    "memory://recent",
    { description: "Entities accessed in the last 7 days" },
    async () => {
      const db = await getDb();
      const sinceDate = new Date(Date.now() - 7 * 86400000).toISOString();
      const entities = db.prepare(
        "SELECT name, type, last_accessed FROM entities WHERE last_accessed >= ? ORDER BY last_accessed DESC LIMIT 50"
      ).all(sinceDate) as { name: string; type: string; last_accessed: string }[];

      const getObs = db.prepare("SELECT content FROM observations WHERE entity = ? ORDER BY id");
      const result = entities.map((e) => ({
        name: e.name,
        type: e.type,
        last_accessed: e.last_accessed,
        observations: (getObs.all(e.name) as { content: string }[]).map((o) => o.content),
      }));

      return {
        contents: [{
          uri: "memory://recent",
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // --- memory://project/{name} ---
  server.registerResource(
    "project-context",
    new ResourceTemplate("memory://project/{name}", { list: undefined }),
    { description: "All entities related to a specific project" },
    async (uri, { name }) => {
      const db = await getDb();
      const projectName = Array.isArray(name) ? name[0] : name;

      // Find entities matching the project name or related to it
      const direct = db.prepare(
        "SELECT DISTINCT name, type FROM entities WHERE name LIKE ?"
      ).all(`%${projectName}%`) as { name: string; type: string }[];

      const related = db.prepare(
        "SELECT DISTINCT e.name, e.type FROM entities e " +
        "JOIN relations r ON (r.src = e.name OR r.dst = e.name) " +
        "WHERE r.src LIKE ? OR r.dst LIKE ?"
      ).all(`%${projectName}%`, `%${projectName}%`) as { name: string; type: string }[];

      const seen = new Set<string>();
      const entities: { name: string; type: string; observations: string[] }[] = [];
      const getObs = db.prepare("SELECT content FROM observations WHERE entity = ? ORDER BY id");

      for (const e of [...direct, ...related]) {
        if (seen.has(e.name)) continue;
        seen.add(e.name);
        entities.push({
          name: e.name,
          type: e.type,
          observations: (getObs.all(e.name) as { content: string }[]).map((o) => o.content),
        });
      }

      return {
        contents: [{
          uri: `memory://project/${projectName}`,
          mimeType: "application/json",
          text: JSON.stringify(entities, null, 2),
        }],
      };
    }
  );

  // --- memory://graph/export ---
  server.registerResource(
    "graph-export",
    "memory://graph/export",
    { description: "Full knowledge graph as JSON (for backup or visualization)" },
    async () => {
      const db = await getDb();
      const data = exportGraph(db);

      return {
        contents: [{
          uri: "memory://graph/export",
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
  );
}
