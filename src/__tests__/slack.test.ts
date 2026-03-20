import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/slack-client.js", () => ({
  slackFetch: vi.fn(),
  getSlackConfig: vi.fn(() => ({
    token: "xoxp-fake-token",
    authHeader: "Bearer xoxp-fake-token",
  })),
  isSlackAvailable: vi.fn(() => true),
}));

import { slackFetch } from "../lib/slack-client.js";
const mockFetch = vi.mocked(slackFetch);

describe("slack tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export register function", async () => {
    const mod = await import("../tools/slack.js");
    expect(typeof mod.register).toBe("function");
  });

  it("should register three tools", async () => {
    const { register } = await import("../tools/slack.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(3);
    const names = mockServer.registerTool.mock.calls.map((c: any[]) => c[0]);
    expect(names).toEqual([
      "slack_search",
      "slack_channels",
      "slack_history",
    ]);
  });

  describe("slack_search", () => {
    async function getHandler() {
      const { register } = await import("../tools/slack.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[0][2];
    }

    it("should search messages and format results", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          messages: {
            total: 1,
            paging: { count: 20, total: 1, page: 1, pages: 1 },
            matches: [
              {
                channel: { id: "C123", name: "general" },
                username: "jt",
                text: "hello world",
                ts: "1700000000.000000",
                permalink: "https://slack.com/archives/C123/p1700000000000000",
              },
            ],
          },
        },
      });

      const result = await handler({
        query: "hello",
        count: 20,
        page: 1,
        sort: "score",
        sort_dir: "desc",
      });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(1);
      expect(parsed.messages[0].channel).toBe("#general");
      expect(parsed.messages[0].user).toBe("jt");
      expect(parsed.messages[0].text).toBe("hello world");
      expect(parsed.messages[0].permalink).toContain("slack.com");
      expect(mockFetch).toHaveBeenCalledWith("search.messages", {
        query: "hello",
        count: 20,
        page: 1,
        sort: "score",
        sort_dir: "desc",
      });
    });

    it("should truncate long messages", async () => {
      const handler = await getHandler();
      const longText = "a".repeat(600);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          messages: {
            total: 1,
            paging: { count: 20, total: 1, page: 1, pages: 1 },
            matches: [
              {
                channel: { id: "C123", name: "general" },
                username: "jt",
                text: longText,
                ts: "1700000000.000000",
                permalink: "https://slack.com/link",
              },
            ],
          },
        },
      });

      const result = await handler({
        query: "test",
        count: 20,
        page: 1,
        sort: "score",
        sort_dir: "desc",
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.messages[0].text).toContain("[truncated]");
      expect(parsed.messages[0].text.length).toBeLessThan(longText.length);
    });

    it("should return error on API failure", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        error: "invalid_auth",
        data: { ok: false, error: "invalid_auth" },
      });

      const result = await handler({
        query: "test",
        count: 20,
        page: 1,
        sort: "score",
        sort_dir: "desc",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("invalid_auth");
    });
  });

  describe("slack_channels", () => {
    async function getHandler() {
      const { register } = await import("../tools/slack.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[1][2];
    }

    it("should list channels with formatted output", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          channels: [
            {
              id: "C001",
              name: "general",
              is_archived: false,
              is_private: false,
              topic: { value: "Company-wide" },
              purpose: { value: "General discussion" },
              num_members: 150,
            },
            {
              id: "C002",
              name: "engineering",
              is_archived: false,
              is_private: false,
              topic: { value: "" },
              purpose: { value: "Engineering team" },
              num_members: 30,
            },
          ],
        },
      });

      const result = await handler({
        types: "public_channel",
        limit: 100,
        exclude_archived: true,
      });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("#general");
      expect(parsed[0].id).toBe("C001");
      expect(parsed[0].topic).toBe("Company-wide");
      expect(parsed[1].purpose).toBe("Engineering team");
    });

    it("should filter channels by name substring", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          channels: [
            {
              id: "C001",
              name: "general",
              is_archived: false,
              is_private: false,
              topic: { value: "" },
              purpose: { value: "" },
              num_members: 150,
            },
            {
              id: "C002",
              name: "engineering",
              is_archived: false,
              is_private: false,
              topic: { value: "" },
              purpose: { value: "" },
              num_members: 30,
            },
          ],
        },
      });

      const result = await handler({
        filter: "eng",
        types: "public_channel",
        limit: 100,
        exclude_archived: true,
      });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("#engineering");
    });

    it("should return error on API failure", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        error: "missing_scope",
        data: { ok: false, error: "missing_scope" },
      });

      const result = await handler({
        types: "public_channel",
        limit: 100,
        exclude_archived: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("missing_scope");
    });
  });

  describe("slack_history", () => {
    async function getHandler() {
      const { register } = await import("../tools/slack.js");
      const mockServer = { registerTool: vi.fn() };
      register(mockServer as any);
      return mockServer.registerTool.mock.calls[2][2];
    }

    it("should return formatted messages with thread info", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          messages: [
            {
              user: "U123",
              text: "Check this PR",
              ts: "1700000000.000000",
              type: "message",
              thread_ts: "1700000000.000000",
              reply_count: 5,
            },
            {
              user: "U456",
              text: "LGTM",
              ts: "1700000100.000000",
              type: "message",
            },
          ],
          has_more: false,
        },
      });

      const result = await handler({ channel: "C123", limit: 25 });
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.channel).toBe("C123");
      expect(parsed.count).toBe(2);
      expect(parsed.has_more).toBe(false);
      expect(parsed.messages[0].user).toBe("U123");
      expect(parsed.messages[0].thread).toEqual({ ts: "1700000000.000000", replies: 5 });
      expect(parsed.messages[1].thread).toBeNull();
    });

    it("should handle bot messages", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: {
          ok: true,
          messages: [
            {
              bot_id: "B123",
              text: "Deploy completed",
              ts: "1700000000.000000",
              type: "message",
            },
          ],
          has_more: false,
        },
      });

      const result = await handler({ channel: "C123", limit: 25 });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.messages[0].user).toBe("B123");
    });

    it("should return clear error for channel_not_found", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        error: "channel_not_found",
        data: { ok: false, error: "channel_not_found" },
      });

      const result = await handler({ channel: "C999", limit: 25 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found or not accessible");
    });

    it("should pass optional time range params", async () => {
      const handler = await getHandler();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        data: { ok: true, messages: [], has_more: false },
      });

      await handler({
        channel: "C123",
        limit: 10,
        oldest: "1700000000.000000",
        latest: "1700100000.000000",
      });
      expect(mockFetch).toHaveBeenCalledWith("conversations.history", {
        channel: "C123",
        limit: 10,
        oldest: "1700000000.000000",
        latest: "1700100000.000000",
      });
    });
  });
});
