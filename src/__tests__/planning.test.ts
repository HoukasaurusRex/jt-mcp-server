import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseTicket } from "../tools/planning.js";

vi.mock("execa", () => ({ execa: vi.fn() }));
import { execa } from "execa";
const mockExeca = vi.mocked(execa);

vi.mock("../lib/atlassian-client.js", () => ({
  atlassianFetch: vi.fn(),
}));
import { atlassianFetch } from "../lib/atlassian-client.js";
const mockAtlassianFetch = vi.mocked(atlassianFetch);

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  access: vi.fn(),
}));
import { readFile, readdir, access } from "node:fs/promises";
const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);

describe("parseTicket", () => {
  it("parses a Jira key", () => {
    expect(parseTicket("PROJ-123")).toEqual({ source: "jira", key: "PROJ-123" });
    expect(parseTicket("ABC-1")).toEqual({ source: "jira", key: "ABC-1" });
    expect(parseTicket("JIRA-9999")).toEqual({ source: "jira", key: "JIRA-9999" });
  });

  it("parses a GitHub issue number", () => {
    expect(parseTicket("42")).toEqual({ source: "github", number: 42 });
    expect(parseTicket("#42")).toEqual({ source: "github", number: 42 });
  });

  it("parses a GitHub issue URL", () => {
    expect(parseTicket("https://github.com/owner/repo/issues/42")).toEqual({
      source: "github",
      repo: "owner/repo",
      number: 42,
    });
  });

  it("throws on unrecognized format", () => {
    expect(() => parseTicket("not-a-ticket")).toThrow("Unrecognized ticket format");
    expect(() => parseTicket("proj-123")).toThrow("Unrecognized ticket format"); // lowercase not valid
  });
});

describe("planning tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no strategy templates found
    mockAccess.mockRejectedValue(new Error("ENOENT"));
  });

  it("exports a register function", async () => {
    const { register } = await import("../tools/planning.js");
    expect(typeof register).toBe("function");
  });

  it("registers plan_from_ticket and plan_review tools", async () => {
    const { register } = await import("../tools/planning.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    expect(mockServer.registerTool.mock.calls[0][0]).toBe("plan_from_ticket");
    expect(mockServer.registerTool.mock.calls[1][0]).toBe("plan_review");
  });

  describe("plan_from_ticket", () => {
    async function getHandler() {
      const { register } = await import("../tools/planning.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("returns error for Jira key when ATLASSIAN_DOMAIN is not set", async () => {
      const originalDomain = process.env.ATLASSIAN_DOMAIN;
      delete process.env.ATLASSIAN_DOMAIN;
      try {
        const handler = await getHandler();
        const result = await handler({
          ticket: "PROJ-123",
          strategies_dir: "/tmp/strategies",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("ATLASSIAN_DOMAIN is not set");
      } finally {
        if (originalDomain !== undefined) process.env.ATLASSIAN_DOMAIN = originalDomain;
      }
    });

    it("fetches a Jira ticket and returns composed output", async () => {
      process.env.ATLASSIAN_DOMAIN = "test.atlassian.net";
      process.env.ATLASSIAN_EMAIL = "test@example.com";
      process.env.ATLASSIAN_API_TOKEN = "token";

      mockAtlassianFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { key: "PROJ-123", fields: { summary: "Add feature X" } },
      });

      const handler = await getHandler();
      const result = await handler({
        ticket: "PROJ-123",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("# Ticket Data");
      expect(result.content[0].text).toContain("PROJ-123");
      expect(result.content[0].text).toContain("# Instructions");

      delete process.env.ATLASSIAN_DOMAIN;
      delete process.env.ATLASSIAN_EMAIL;
      delete process.env.ATLASSIAN_API_TOKEN;
    });

    it("returns error when Jira API responds with non-ok status", async () => {
      process.env.ATLASSIAN_DOMAIN = "test.atlassian.net";
      process.env.ATLASSIAN_EMAIL = "test@example.com";
      process.env.ATLASSIAN_API_TOKEN = "token";

      mockAtlassianFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        data: { errorMessages: ["Issue not found"] },
      });

      const handler = await getHandler();
      const result = await handler({
        ticket: "PROJ-999",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Jira API error (404)");

      delete process.env.ATLASSIAN_DOMAIN;
      delete process.env.ATLASSIAN_EMAIL;
      delete process.env.ATLASSIAN_API_TOKEN;
    });

    it("fetches a GitHub issue and returns composed output", async () => {
      mockExeca
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ title: "Fix bug", body: "Description", url: "https://github.com/owner/repo/issues/42" }),
          stderr: "",
          exitCode: 0,
        } as any)
        .mockResolvedValueOnce({
          stdout: "src/index.ts\nsrc/types.ts",
          stderr: "",
          exitCode: 0,
        } as any);

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        cwd: "/project",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("# Ticket Data");
      expect(result.content[0].text).toContain("Fix bug");
      expect(result.content[0].text).toContain("# File Tree");
      expect(result.content[0].text).toContain("src/index.ts");
      expect(result.content[0].text).toContain("# Instructions");
    });

    it("extracts repo from GitHub URL", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ title: "Issue", body: "", url: "" }),
        stderr: "",
        exitCode: 0,
      } as any);

      const handler = await getHandler();
      await handler({
        ticket: "https://github.com/myorg/myrepo/issues/5",
        strategies_dir: "/tmp/strategies",
      });

      const ghCall = mockExeca.mock.calls[0];
      expect(ghCall[1]).toContain("-R");
      expect(ghCall[1]).toContain("myorg/myrepo");
    });

    it("returns error when gh CLI is not installed", async () => {
      const err = new Error("ENOENT: gh not found");
      mockExeca.mockRejectedValueOnce(err);

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("GitHub CLI (gh) is not installed");
    });

    it("truncates file tree when over 200 lines", async () => {
      const manyFiles = Array.from({ length: 600 }, (_, i) => `src/file${i}.ts`).join("\n");
      mockExeca
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ title: "Issue", body: "" }),
          stderr: "",
          exitCode: 0,
        } as any)
        .mockResolvedValueOnce({
          stdout: manyFiles,
          stderr: "",
          exitCode: 0,
        } as any);

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        cwd: "/project",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.content[0].text).toContain("400 more files");
    });

    it("skips file tree silently when git fails", async () => {
      mockExeca
        .mockResolvedValueOnce({
          stdout: JSON.stringify({ title: "Issue", body: "" }),
          stderr: "",
          exitCode: 0,
        } as any)
        .mockRejectedValueOnce(new Error("not a git repository"));

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        cwd: "/not-a-repo",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).not.toContain("# File Tree");
    });

    it("uses custom strategy template when available", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(["plan-ticket.md"] as any);
      mockReadFile.mockResolvedValue(
        `---\nname: plan_ticket\npattern: "plan ticket {ticket}"\n---\nCustom planning prompt`
      );
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ title: "Issue", body: "" }),
        stderr: "",
        exitCode: 0,
      } as any);

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.content[0].text).toContain("Custom planning prompt");
    });

    it("falls back to hardcoded prompt when template not found", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ title: "Issue", body: "" }),
        stderr: "",
        exitCode: 0,
      } as any);

      const handler = await getHandler();
      const result = await handler({
        ticket: "42",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.content[0].text).toContain("Implementation Steps");
    });
  });

  describe("plan_review", () => {
    async function getHandler() {
      const { register } = await import("../tools/planning.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("returns review instructions without plan text", async () => {
      const handler = await getHandler();
      const result = await handler({ strategies_dir: "/tmp/strategies" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("# Review Instructions");
      expect(result.content[0].text).not.toContain("# Plan to Review");
    });

    it("includes plan text when provided", async () => {
      const handler = await getHandler();
      const result = await handler({
        plan: "My implementation plan",
        strategies_dir: "/tmp/strategies",
      });

      expect(result.content[0].text).toContain("# Plan to Review");
      expect(result.content[0].text).toContain("My implementation plan");
      expect(result.content[0].text).toContain("# Review Instructions");
    });

    it("uses custom strategy template when available", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(["review-plan.md"] as any);
      mockReadFile.mockResolvedValue(
        `---\nname: review_plan\npattern: "review plan"\n---\nCustom review prompt`
      );

      const handler = await getHandler();
      const result = await handler({ strategies_dir: "/tmp/strategies" });

      expect(result.content[0].text).toContain("Custom review prompt");
    });

    it("falls back to hardcoded prompt when template not found", async () => {
      const handler = await getHandler();
      const result = await handler({ strategies_dir: "/tmp/strategies" });

      expect(result.content[0].text).toContain("Edge cases");
      expect(result.content[0].text).toContain("claude --model sonnet");
    });
  });
});
