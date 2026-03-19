import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/atlassian-client.js", () => ({
  atlassianFetch: vi.fn(),
  getAtlassianConfig: vi.fn(() => ({
    domain: "test.atlassian.net",
    email: "test@example.com",
    token: "fake-token",
    authHeader: "Basic dGVzdDpmYWtl",
  })),
  resolveAssignee: vi.fn(),
  toAdfParagraph: vi.fn((text: string) => ({
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  })),
}));

import { atlassianFetch, resolveAssignee } from "../lib/atlassian-client.js";
const mockFetch = vi.mocked(atlassianFetch);
const mockResolveAssignee = vi.mocked(resolveAssignee);

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

    it("should search issues with JQL via REST API", async () => {
      const handler = await getHandler();
      const issues = [{ key: "PROJ-1", fields: { summary: "Fix bug", status: { name: "To Do" } } }];
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, data: { issues } });

      const result = await handler({
        jql: "project = PROJ",
        max_results: 20,
        fields: "key,summary,status",
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-1");
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/search", {
        query: { jql: "project = PROJ", maxResults: 20, fields: "key,summary,status" },
      });
    });

    it("should return error on API failure", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        data: { errorMessages: ["Invalid JQL query"] },
      });

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
      const issueData = { key: "PROJ-42", fields: { summary: "Add feature" } };
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, data: issueData });

      const result = await handler({ issue_key: "PROJ-42" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-42");
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-42", { query: {} });
    });

    it("should pass fields query param", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, data: {} });

      await handler({ issue_key: "PROJ-42", fields: "summary,comment" });
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-42", {
        query: { fields: "summary,comment" },
      });
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
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, data: { key: "PROJ-99" } });

      const result = await handler({
        project_key: "PROJ",
        summary: "New task",
        issue_type: "Task",
      });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-99");
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue", {
        method: "POST",
        body: {
          fields: {
            project: { key: "PROJ" },
            summary: "New task",
            issuetype: { name: "Task" },
          },
        },
      });
    });

    it("should resolve @me assignee", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: "me-123" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, data: { key: "PROJ-100" } });

      await handler({
        project_key: "PROJ",
        summary: "Self-assigned",
        issue_type: "Task",
        assignee: "@me",
      });

      expect(mockResolveAssignee).toHaveBeenCalledWith("@me");
      const createCall = mockFetch.mock.calls[0];
      expect((createCall[1] as any).body.fields.assignee).toEqual({ accountId: "me-123" });
    });

    it("should resolve email assignee via user search", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: "user-456" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, data: { key: "PROJ-101" } });

      await handler({
        project_key: "PROJ",
        summary: "Assigned to someone",
        issue_type: "Task",
        assignee: "user@example.com",
      });

      expect(mockResolveAssignee).toHaveBeenCalledWith("user@example.com");
    });

    it("should pass optional fields", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, data: { key: "PROJ-102" } });

      await handler({
        project_key: "PROJ",
        summary: "With options",
        issue_type: "Bug",
        description: "Bug description",
        labels: ["urgent", "frontend"],
        parent_key: "PROJ-50",
      });

      const body = (mockFetch.mock.calls[0][1] as any).body.fields;
      expect(body.description).toEqual({
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: "Bug description" }] }],
      });
      expect(body.labels).toEqual(["urgent", "frontend"]);
      expect(body.parent).toEqual({ key: "PROJ-50" });
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
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { transitions: [{ id: "31", name: "In Progress" }, { id: "41", name: "Done" }] },
        })
        .mockResolvedValueOnce({ ok: true, status: 204, data: {} });

      const result = await handler({ issue_key: "PROJ-1", status: "In Progress" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("In Progress");

      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-1/transitions", {
        method: "POST",
        body: { transition: { id: "31" } },
      });
    });

    it("should return error for invalid transition", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { transitions: [{ id: "31", name: "In Progress" }] },
      });

      const result = await handler({ issue_key: "PROJ-1", status: "Invalid Status" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No transition");
      expect(result.content[0].text).toContain("In Progress");
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
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, data: { id: "10001" } });

      const result = await handler({ issue_key: "PROJ-1", body: "Test comment" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("PROJ-1");

      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-1/comment", {
        method: "POST",
        body: {
          body: {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: "Test comment" }] }],
          },
        },
      });
    });
  });

  describe("jira_assign", () => {
    async function getHandler() {
      const { register } = await import("../tools/jira.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[5][2];
    }

    it("should assign issue via email lookup", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: "user-789" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, data: {} });

      const result = await handler({ issue_key: "PROJ-1", assignee: "user@example.com" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Assigned");
      expect(mockResolveAssignee).toHaveBeenCalledWith("user@example.com");
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-1/assignee", {
        method: "PUT",
        body: { accountId: "user-789" },
      });
    });

    it("should self-assign with @me", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: "me-123" });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, data: {} });

      await handler({ issue_key: "PROJ-1", assignee: "@me" });
      expect(mockResolveAssignee).toHaveBeenCalledWith("@me");
    });

    it("should unassign issue", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: null });
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, data: {} });

      const result = await handler({ issue_key: "PROJ-1", assignee: "unassign" });
      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith("/rest/api/3/issue/PROJ-1/assignee", {
        method: "PUT",
        body: { accountId: null },
      });
    });

    it("should return error when user not found", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockResolvedValueOnce({ accountId: null, error: 'Could not find user "nobody@example.com"' });

      const result = await handler({ issue_key: "PROJ-1", assignee: "nobody@example.com" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Could not find user");
    });

    it("should return error on missing env vars", async () => {
      const handler = await getHandler();
      mockResolveAssignee.mockRejectedValueOnce(new Error("ATLASSIAN_DOMAIN environment variable is required"));

      const result = await handler({ issue_key: "PROJ-1", assignee: "@me" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ATLASSIAN_DOMAIN");
    });
  });
});
