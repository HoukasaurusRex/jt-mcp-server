import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn() }));
import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("jira tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register function", async () => {
    const mod = await import("../tools/jira.js");
    expect(typeof mod.register).toBe("function");
  });

  it("should register six tools", async () => {
    const { register } = await import("../tools/jira.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(6);
    const names = mockServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      "jira_search",
      "jira_get_issue",
      "jira_create_issue",
      "jira_transition",
      "jira_add_comment",
      "jira_assign",
    ]);
  });

  describe("jira_search", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("should search issues with JQL via acli", async () => {
      const handler = await getHandler();
      const jsonOutput = JSON.stringify([
        { key: "PROJ-1", summary: "Fix bug", status: "To Do" },
      ]);
      mockExeca.mockResolvedValueOnce({
        stdout: jsonOutput,
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        jql: "project = PROJ",
        max_results: 20,
        fields: "key,summary,status",
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-1");

      // Verify acli was called with correct args
      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("jira");
      expect(args).toContain("workitem");
      expect(args).toContain("search");
      expect(args).toContain("--jql");
      expect(args).toContain("project = PROJ");
      expect(args).toContain("--json");
    });

    it("should return error on acli failure", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "Invalid JQL query",
        exitCode: 1,
      } as any);

      const result = await handler({
        jql: "bad query",
        max_results: 20,
        fields: "key,summary",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid JQL");
    });
  });

  describe("jira_get_issue", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("should get issue details", async () => {
      const handler = await getHandler();
      const jsonOutput = JSON.stringify({
        key: "PROJ-42",
        summary: "Add feature",
        status: "In Progress",
      });
      mockExeca.mockResolvedValueOnce({
        stdout: jsonOutput,
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ issue_key: "PROJ-42" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-42");

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("view");
      expect(args).toContain("PROJ-42");
    });

    it("should pass fields flag", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "{}",
        stderr: "",
        exitCode: 0,
      } as any);

      await handler({ issue_key: "PROJ-42", fields: "summary,comment" });
      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("--fields");
      expect(args).toContain("summary,comment");
    });
  });

  describe("jira_create_issue", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[2][2];
    }

    it("should create an issue", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ key: "PROJ-99" }),
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({
        project_key: "PROJ",
        summary: "New task",
        issue_type: "Task",
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-99");

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("create");
      expect(args).toContain("--project");
      expect(args).toContain("PROJ");
      expect(args).toContain("--summary");
      expect(args).toContain("New task");
    });

    it("should pass optional flags", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ key: "PROJ-100" }),
        stderr: "",
        exitCode: 0,
      } as any);

      await handler({
        project_key: "PROJ",
        summary: "With options",
        issue_type: "Bug",
        description: "Bug description",
        assignee: "user@example.com",
        labels: ["urgent", "frontend"],
        parent_key: "PROJ-50",
      });

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("--description");
      expect(args).toContain("Bug description");
      expect(args).toContain("--assignee");
      expect(args).toContain("user@example.com");
      expect(args).toContain("--label");
      expect(args).toContain("urgent,frontend");
      expect(args).toContain("--parent");
      expect(args).toContain("PROJ-50");
    });
  });

  describe("jira_transition", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[3][2];
    }

    it("should transition issue status", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ issue_key: "PROJ-1", status: "In Progress" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("In Progress");

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("transition");
      expect(args).toContain("--key");
      expect(args).toContain("PROJ-1");
      expect(args).toContain("--status");
      expect(args).toContain("In Progress");
      // transition doesn't use --json
      expect(args).not.toContain("--json");
    });
  });

  describe("jira_add_comment", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[4][2];
    }

    it("should add comment to issue", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ issue_key: "PROJ-1", body: "Test comment" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-1");

      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("comment");
      expect(args).toContain("create");
      expect(args).toContain("--body");
      expect(args).toContain("Test comment");
    });
  });

  describe("jira_assign", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[5][2];
    }

    it("should assign issue", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      const result = await handler({ issue_key: "PROJ-1", assignee: "user@example.com" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Assigned");
    });

    it("should self-assign with @me", async () => {
      const handler = await getHandler();
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
      } as any);

      await handler({ issue_key: "PROJ-1", assignee: "@me" });
      const args = mockExeca.mock.calls[0][1] as string[];
      expect(args).toContain("--assignee");
      expect(args).toContain("@me");
    });

    it("should return error on ENOENT (acli not installed)", async () => {
      const handler = await getHandler();
      const err = new Error("ENOENT") as any;
      err.code = "ENOENT";
      mockExeca.mockRejectedValueOnce(err);

      const result = await handler({ issue_key: "PROJ-1", assignee: "@me" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ENOENT");
    });
  });
});
