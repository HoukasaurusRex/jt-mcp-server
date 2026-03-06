import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";

let testDb: Database.Database;

vi.mock("../lib/memory-db.js", () => ({
  getDb: () => testDb,
  closeDb: () => {},
  exportGraph: vi.fn(),
  autoExport: vi.fn(),
}));

// Must import after mock setup
import { exportGraph } from "../lib/memory-db.js";

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
`;

function getHandler(mockServer: any, toolName: string) {
  const call = mockServer.registerTool.mock.calls.find(
    (c: any) => c[0] === toolName
  );
  if (!call) throw new Error(`Tool ${toolName} not registered`);
  return call[2];
}

describe("memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testDb = new Database(":memory:");
    testDb.pragma("foreign_keys = ON");
    testDb.exec(SCHEMA_SQL);

    // Make exportGraph return real data from testDb
    vi.mocked(exportGraph).mockImplementation((db: any) => {
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
    });
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/memory.js");
    expect(typeof register).toBe("function");
  });

  it("should register all 7 memory tools", async () => {
    const { register } = await import("../tools/memory.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(7);
    const names = mockServer.registerTool.mock.calls.map((c: any) => c[0]);
    expect(names).toEqual([
      "memory_add_entities",
      "memory_add_relations",
      "memory_add_observations",
      "memory_query",
      "memory_delete",
      "memory_export",
      "memory_import",
    ]);
  });

  describe("memory_add_entities", () => {
    it("should create entities with observations", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const handler = getHandler(mockServer, "memory_add_entities");

      const result = await handler({
        entities: [
          {
            name: "TypeScript",
            type: "language",
            observations: ["Preferred for all projects", "Use strict mode"],
          },
        ],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Created 1 new entities");

      // Verify in DB
      const entity = testDb
        .prepare("SELECT * FROM entities WHERE name = ?")
        .get("TypeScript") as any;
      expect(entity.type).toBe("language");

      const obs = testDb
        .prepare("SELECT content FROM observations WHERE entity = ?")
        .all("TypeScript") as any[];
      expect(obs).toHaveLength(2);
    });

    it("should handle duplicates gracefully", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const handler = getHandler(mockServer, "memory_add_entities");

      await handler({
        entities: [{ name: "TS", type: "language" }],
      });
      const result = await handler({
        entities: [{ name: "TS", type: "language" }],
      });

      expect(result.content[0].text).toContain("1 already existed");
    });
  });

  describe("memory_add_relations", () => {
    it("should create relations between existing entities", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const addRelations = getHandler(mockServer, "memory_add_relations");

      await addEntities({
        entities: [
          { name: "JT", type: "person" },
          { name: "TypeScript", type: "language" },
        ],
      });

      const result = await addRelations({
        relations: [{ src: "JT", rel: "PREFERS", dst: "TypeScript" }],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Created 1 new relations");
    });

    it("should error on missing entities", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addRelations = getHandler(mockServer, "memory_add_relations");

      const result = await addRelations({
        relations: [{ src: "Ghost", rel: "PREFERS", dst: "Nothing" }],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Entities not found");
    });
  });

  describe("memory_add_observations", () => {
    it("should add observations to existing entity", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const addObs = getHandler(mockServer, "memory_add_observations");

      await addEntities({
        entities: [{ name: "Yarn", type: "tool" }],
      });

      const result = await addObs({
        entity: "Yarn",
        observations: ["Use Berry (v4)", "node-modules linker"],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Added 2 new observations");
    });

    it("should error on missing entity", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addObs = getHandler(mockServer, "memory_add_observations");

      const result = await addObs({
        entity: "NonExistent",
        observations: ["some fact"],
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("memory_query", () => {
    async function seedData(mockServer: any) {
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const addRelations = getHandler(mockServer, "memory_add_relations");

      await addEntities({
        entities: [
          {
            name: "JT",
            type: "person",
            observations: ["Prefers TypeScript", "Uses Yarn Berry"],
          },
          { name: "TypeScript", type: "language", observations: ["Strict mode always"] },
          { name: "Vitest", type: "tool", observations: ["Preferred test framework"] },
        ],
      });
      await addRelations({
        relations: [
          { src: "JT", rel: "PREFERS", dst: "TypeScript" },
          { src: "JT", rel: "USES", dst: "Vitest" },
          { src: "Vitest", rel: "DEPENDS_ON", dst: "TypeScript" },
        ],
      });
    }

    it("should search by name substring", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      await seedData(mockServer);
      const query = getHandler(mockServer, "memory_query");

      const result = await query({ name: "Type", depth: 1, limit: 20 });
      const data = JSON.parse(result.content[0].text);
      expect(data.entities).toHaveLength(1);
      expect(data.entities[0].name).toBe("TypeScript");
    });

    it("should filter by type", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      await seedData(mockServer);
      const query = getHandler(mockServer, "memory_query");

      const result = await query({ type: "tool", depth: 1, limit: 20 });
      const data = JSON.parse(result.content[0].text);
      expect(data.entities).toHaveLength(1);
      expect(data.entities[0].name).toBe("Vitest");
    });

    it("should traverse relations at depth 2", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      await seedData(mockServer);
      const query = getHandler(mockServer, "memory_query");

      const result = await query({ name: "JT", depth: 2, limit: 20 });
      const data = JSON.parse(result.content[0].text);
      // JT -> TypeScript, Vitest -> TypeScript (already visited)
      expect(data.entities.length).toBeGreaterThanOrEqual(3);
    });

    it("should respect limit", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      await seedData(mockServer);
      const query = getHandler(mockServer, "memory_query");

      const result = await query({ depth: 1, limit: 1 });
      const data = JSON.parse(result.content[0].text);
      expect(data.entities.length).toBeLessThanOrEqual(1);
    });

    it("should return empty result for no matches", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const query = getHandler(mockServer, "memory_query");

      const result = await query({ name: "nonexistent", depth: 1, limit: 20 });
      const data = JSON.parse(result.content[0].text);
      expect(data.entities).toHaveLength(0);
    });
  });

  describe("memory_delete", () => {
    it("should delete entities with cascade", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const addRelations = getHandler(mockServer, "memory_add_relations");
      const del = getHandler(mockServer, "memory_delete");

      await addEntities({
        entities: [
          { name: "A", type: "test", observations: ["fact about A"] },
          { name: "B", type: "test" },
        ],
      });
      await addRelations({
        relations: [{ src: "A", rel: "RELATED_TO", dst: "B" }],
      });

      const result = await del({ entities: ["A"] });
      expect(result.content[0].text).toContain("Deleted 1 entities");

      // Observations and relations should be cascaded
      const obs = testDb
        .prepare("SELECT * FROM observations WHERE entity = ?")
        .all("A");
      expect(obs).toHaveLength(0);
      const rels = testDb.prepare("SELECT * FROM relations").all();
      expect(rels).toHaveLength(0);
    });

    it("should delete specific observations", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const del = getHandler(mockServer, "memory_delete");

      await addEntities({
        entities: [
          { name: "X", type: "test", observations: ["keep this", "remove this"] },
        ],
      });

      await del({
        observations: [{ entity: "X", content: "remove this" }],
      });

      const obs = testDb
        .prepare("SELECT content FROM observations WHERE entity = ?")
        .all("X") as any[];
      expect(obs).toHaveLength(1);
      expect(obs[0].content).toBe("keep this");
    });
  });

  describe("memory_export", () => {
    it("should export the full graph as JSON", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const exportTool = getHandler(mockServer, "memory_export");

      await addEntities({
        entities: [
          { name: "Node", type: "runtime", observations: ["v22+"] },
        ],
      });

      const result = await exportTool({});
      const data = JSON.parse(result.content[0].text);
      expect(data.version).toBe(1);
      expect(data.entities).toHaveLength(1);
      expect(data.entities[0].name).toBe("Node");
      expect(data.entities[0].observations).toEqual(["v22+"]);
    });
  });

  describe("memory_import", () => {
    it("should import in merge mode", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const importTool = getHandler(mockServer, "memory_import");

      await addEntities({
        entities: [{ name: "Existing", type: "test", observations: ["old fact"] }],
      });

      const result = await importTool({
        data: {
          entities: [
            { name: "New", type: "test", observations: ["new fact"] },
          ],
          relations: [],
        },
        merge: true,
      });

      expect(result.content[0].text).toContain("merge");
      const all = testDb.prepare("SELECT * FROM entities").all();
      expect(all).toHaveLength(2);
    });

    it("should import in replace mode", async () => {
      const { register } = await import("../tools/memory.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      const addEntities = getHandler(mockServer, "memory_add_entities");
      const importTool = getHandler(mockServer, "memory_import");

      await addEntities({
        entities: [{ name: "Old", type: "test" }],
      });

      const result = await importTool({
        data: {
          entities: [
            { name: "Fresh", type: "test", observations: [] },
          ],
          relations: [],
        },
        merge: false,
      });

      expect(result.content[0].text).toContain("replace");
      const all = testDb.prepare("SELECT * FROM entities").all() as any[];
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe("Fresh");
    });
  });
});
