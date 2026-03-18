import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseStrategyFile,
  loadStrategies,
  matchStrategy,
  expandTemplate,
  type Strategy,
} from "../lib/strategy-loader.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  access: vi.fn(),
}));

import { readFile, readdir, access } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

const VALID_STRATEGY_FILE = `---
name: review_pr
description: Deep PR review
pattern: "review pr {branch}"
params:
  branch: { required: true, description: "Branch name" }
---

Check out branch {{branch}} and review it.`;

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    name: "review_pr",
    description: "Deep PR review",
    pattern: "review pr {branch}",
    params: { branch: { required: true, description: "Branch name" } },
    body: "Check out branch {{branch}} and review it.",
    filePath: "/tmp/review-pr.md",
    ...overrides,
  };
}

describe("strategy-loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseStrategyFile", () => {
    it("should parse valid frontmatter and body", async () => {
      mockReadFile.mockResolvedValue(VALID_STRATEGY_FILE);
      const result = await parseStrategyFile("/tmp/review-pr.md");
      expect(result.name).toBe("review_pr");
      expect(result.description).toBe("Deep PR review");
      expect(result.pattern).toBe("review pr {branch}");
      expect(result.params.branch).toEqual({
        required: true,
        description: "Branch name",
      });
      expect(result.body).toBe("Check out branch {{branch}} and review it.");
    });

    it("should throw on missing frontmatter", async () => {
      mockReadFile.mockResolvedValue("no frontmatter here");
      await expect(parseStrategyFile("/tmp/bad.md")).rejects.toThrow(
        "missing frontmatter"
      );
    });

    it("should throw on missing required fields", async () => {
      mockReadFile.mockResolvedValue("---\ndescription: test\n---\nbody");
      await expect(parseStrategyFile("/tmp/bad.md")).rejects.toThrow(
        "missing required fields"
      );
    });

    it("should default params to required: true", async () => {
      const file = `---
name: test
pattern: "test {x}"
params:
  x: { description: "the x param" }
---
body`;
      mockReadFile.mockResolvedValue(file);
      const result = await parseStrategyFile("/tmp/test.md");
      expect(result.params.x.required).toBe(true);
    });
  });

  describe("loadStrategies", () => {
    it("should return empty array if directory does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));
      const result = await loadStrategies("/nonexistent");
      expect(result).toEqual([]);
    });

    it("should load .md files and ignore others", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(["a.md", "b.txt", "c.md"] as any);
      mockReadFile
        .mockResolvedValueOnce(VALID_STRATEGY_FILE)
        .mockResolvedValueOnce(
          `---\nname: other\npattern: "other {x}"\n---\nbody`
        );

      const result = await loadStrategies("/tmp/strategies");
      expect(result).toHaveLength(2);
    });

    it("should skip malformed files", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(["good.md", "bad.md"] as any);
      mockReadFile
        .mockResolvedValueOnce(VALID_STRATEGY_FILE)
        .mockResolvedValueOnce("not valid");

      const result = await loadStrategies("/tmp/strategies");
      expect(result).toHaveLength(1);
    });

    it("should sort by specificity (longer patterns first)", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(["short.md", "long.md"] as any);
      mockReadFile
        .mockResolvedValueOnce(
          `---\nname: short\npattern: "do {x}"\n---\nbody`
        )
        .mockResolvedValueOnce(
          `---\nname: long\npattern: "do something specific {x}"\n---\nbody`
        );

      const result = await loadStrategies("/tmp/strategies");
      expect(result[0].name).toBe("long");
      expect(result[1].name).toBe("short");
    });
  });

  describe("matchStrategy", () => {
    it("should match a single-param pattern", () => {
      const strategy = makeStrategy();
      const result = matchStrategy("review pr feature/my-branch", [strategy]);
      expect(result).not.toBeNull();
      expect(result!.values.branch).toBe("feature/my-branch");
    });

    it("should capture remaining tokens for last param", () => {
      const strategy = makeStrategy({
        pattern: "deploy to {env}",
        params: { env: { required: true, description: "" } },
      });
      const result = matchStrategy("deploy to staging us-east-1", [strategy]);
      expect(result!.values.env).toBe("staging us-east-1");
    });

    it("should match multi-param patterns", () => {
      const strategy = makeStrategy({
        pattern: "deploy {env} {service}",
        params: {
          env: { required: true, description: "" },
          service: { required: true, description: "" },
        },
      });
      const result = matchStrategy("deploy staging api-gateway", [strategy]);
      expect(result!.values.env).toBe("staging");
      expect(result!.values.service).toBe("api-gateway");
    });

    it("should return null for no match", () => {
      const strategy = makeStrategy();
      const result = matchStrategy("something else entirely", [strategy]);
      expect(result).toBeNull();
    });

    it("should match case-insensitively on literals", () => {
      const strategy = makeStrategy();
      const result = matchStrategy("Review PR feature/x", [strategy]);
      expect(result).not.toBeNull();
      expect(result!.values.branch).toBe("feature/x");
    });

    it("should return null when required param has no token", () => {
      const strategy = makeStrategy({
        pattern: "deploy {env} {service}",
        params: {
          env: { required: true, description: "" },
          service: { required: true, description: "" },
        },
      });
      const result = matchStrategy("deploy staging", [strategy]);
      expect(result).toBeNull();
    });

    it("should prefer more specific patterns", () => {
      const general = makeStrategy({
        name: "general",
        pattern: "review {thing}",
        params: { thing: { required: true, description: "" } },
      });
      const specific = makeStrategy({
        name: "specific",
        pattern: "review pr {branch}",
        params: { branch: { required: true, description: "" } },
      });
      // specific should be first due to sort order
      const result = matchStrategy("review pr main", [specific, general]);
      expect(result!.strategy.name).toBe("specific");
    });
  });

  describe("expandTemplate", () => {
    it("should replace placeholders", () => {
      const result = expandTemplate("Hello {{name}}, welcome to {{place}}", {
        name: "JT",
        place: "Earth",
      });
      expect(result).toBe("Hello JT, welcome to Earth");
    });

    it("should leave unknown placeholders untouched", () => {
      const result = expandTemplate("Hello {{name}}", {});
      expect(result).toBe("Hello {{name}}");
    });
  });
});

describe("strategy tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/strategy.js");
    expect(typeof register).toBe("function");
  });

  it("should register strategy_expand and strategy_list tools", async () => {
    const { register } = await import("../tools/strategy.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    expect(mockServer.registerTool.mock.calls[0][0]).toBe("strategy_expand");
    expect(mockServer.registerTool.mock.calls[1][0]).toBe("strategy_list");
  });

  it("strategy_expand should return error when no strategies exist", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    const { register } = await import("../tools/strategy.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const result = await handler({
      command: "review pr main",
      strategies_dir: "/nonexistent",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No strategies found");
  });

  it("strategy_expand should return error when no match", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["review-pr.md"] as any);
    mockReadFile.mockResolvedValue(VALID_STRATEGY_FILE);

    const { register } = await import("../tools/strategy.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const result = await handler({
      command: "something unknown",
      strategies_dir: "/tmp/strategies",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No strategy matched");
    expect(result.content[0].text).toContain("review pr {branch}");
  });

  it("strategy_expand should return expanded template on match", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["review-pr.md"] as any);
    mockReadFile.mockResolvedValue(VALID_STRATEGY_FILE);

    const { register } = await import("../tools/strategy.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const result = await handler({
      command: "review pr feature/awesome",
      strategies_dir: "/tmp/strategies",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain(
      "Check out branch feature/awesome and review it."
    );
  });

  it("strategy_list should list available strategies", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["review-pr.md"] as any);
    mockReadFile.mockResolvedValue(VALID_STRATEGY_FILE);

    const { register } = await import("../tools/strategy.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[1][2];
    const result = await handler({
      strategies_dir: "/tmp/strategies",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("review_pr");
    expect(result.content[0].text).toContain("review pr {branch}");
  });
});
