import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/atlassian-client.js", () => ({
  atlassianFetch: vi.fn(),
  getAtlassianConfig: vi.fn(() => ({
    domain: "test.atlassian.net",
    email: "test@example.com",
    token: "test-token",
  })),
}));
import { atlassianFetch } from "../lib/atlassian-client.js";
const mockFetch = vi.mocked(atlassianFetch);

describe("confluence tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register function", async () => {
    const mod = await import("../tools/confluence.js");
    expect(typeof mod.register).toBe("function");
  });

  it("should register four tools", async () => {
    const { register } = await import("../tools/confluence.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(4);
    const names = mockServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      "confluence_search",
      "confluence_get_page",
      "confluence_create_page",
      "confluence_update_page",
    ]);
  });

  describe("confluence_search", () => {
    async function getHandler() {
      const { register } = await import("../tools/confluence.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("should search pages with CQL", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          results: [
            {
              content: {
                id: "12345",
                title: "API Guide",
                type: "page",
                _links: { webui: "/wiki/spaces/DEV/pages/12345" },
                space: { key: "DEV", name: "Development" },
              },
              excerpt: "This guide covers...",
            },
          ],
          totalSize: 1,
        },
      } as any);

      const result = await handler({ cql: 'title = "API Guide"', max_results: 10 });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.total).toBe(1);
      expect(data.pages[0].title).toBe("API Guide");
      expect(data.pages[0].space).toBe("DEV");
    });

    it("should return error on API failure", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        data: { message: "Invalid CQL" },
      } as any);

      const result = await handler({ cql: "bad query", max_results: 10 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("400");
    });
  });

  describe("confluence_get_page", () => {
    async function getHandler() {
      const { register } = await import("../tools/confluence.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("should get page content", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          id: "12345",
          title: "API Guide",
          space: { key: "DEV", name: "Development" },
          version: { number: 3, when: "2024-01-15", by: { displayName: "John" } },
          body: { storage: { value: "<p>Hello world</p>" } },
          _links: { webui: "/wiki/spaces/DEV/pages/12345" },
        },
      } as any);

      const result = await handler({ page_id: "12345", format: "storage" });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.title).toBe("API Guide");
      expect(data.body).toBe("<p>Hello world</p>");
      expect(data.version).toBe(3);
    });
  });

  describe("confluence_create_page", () => {
    async function getHandler() {
      const { register } = await import("../tools/confluence.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[2][2];
    }

    it("should create a page", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          id: "99999",
          title: "New Page",
          _links: { webui: "/wiki/spaces/DEV/pages/99999" },
        },
      } as any);

      const result = await handler({
        space_key: "DEV",
        title: "New Page",
        body: "<p>Content here</p>",
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe("99999");
      expect(data.title).toBe("New Page");
    });

    it("should include parent_id as ancestor", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { id: "99999", title: "Child Page", _links: { webui: "/..." } },
      } as any);

      await handler({
        space_key: "DEV",
        title: "Child Page",
        body: "<p>Child</p>",
        parent_id: "12345",
      });

      const body = (mockFetch.mock.calls[0][1] as any).body;
      expect(body.ancestors).toEqual([{ id: "12345" }]);
    });
  });

  describe("confluence_update_page", () => {
    async function getHandler() {
      const { register } = await import("../tools/confluence.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[3][2];
    }

    it("should update page with incremented version", async () => {
      const handler = await getHandler();

      // Get current version
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { title: "Existing Page", version: { number: 5 } },
      } as any);

      // Update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          id: "12345",
          title: "Existing Page",
          version: { number: 6 },
          _links: { webui: "/wiki/spaces/DEV/pages/12345" },
        },
      } as any);

      const result = await handler({
        page_id: "12345",
        body: "<p>Updated</p>",
        version_comment: "Updated via MCP",
      });
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.version).toBe(6);

      // Verify version was incremented
      const updateBody = (mockFetch.mock.calls[1][1] as any).body;
      expect(updateBody.version.number).toBe(6);
      expect(updateBody.version.message).toBe("Updated via MCP");
    });

    it("should keep existing title when not provided", async () => {
      const handler = await getHandler();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { title: "Original Title", version: { number: 1 } },
      } as any);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          id: "12345",
          title: "Original Title",
          version: { number: 2 },
          _links: { webui: "/..." },
        },
      } as any);

      await handler({ page_id: "12345", body: "<p>New body</p>" });

      const updateBody = (mockFetch.mock.calls[1][1] as any).body;
      expect(updateBody.title).toBe("Original Title");
    });
  });
});
