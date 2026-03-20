import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SlackSearchSchema,
  SlackChannelsSchema,
  SlackHistorySchema,
} from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";
import { registerToolWithTelemetry } from "../lib/tool-telemetry.js";
import { slackFetch } from "../lib/slack-client.js";

const MAX_TEXT_LENGTH = 500;

function truncate(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + " [truncated]";
}

export function register(server: McpServer): void {
  // ── slack_search ──────────────────────────────────────────────────
  registerToolWithTelemetry(server,
    "slack_search",
    {
      description:
        "Search Slack messages across the workspace. " +
        "Supports Slack search modifiers: in:#channel, from:@user, before:, after:, has:link, has:reaction. " +
        "Requires SLACK_USER_TOKEN or Slack CLI auth.",
      inputSchema: SlackSearchSchema,
    },
    async ({ query, count, page, sort, sort_dir }) => {
      try {
        const res = await slackFetch<{
          messages: {
            total: number;
            paging: { count: number; total: number; page: number; pages: number };
            matches: Array<{
              channel: { id: string; name: string };
              username: string;
              text: string;
              ts: string;
              permalink: string;
            }>;
          };
        }>("search.messages", { query, count, page, sort, sort_dir });

        if (!res.ok) {
          return errorResult(`Slack search failed: ${res.error}`);
        }

        const { messages } = res.data;
        const formatted = messages.matches.map((m) => ({
          channel: `#${m.channel.name}`,
          user: m.username,
          timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
          text: truncate(m.text),
          permalink: m.permalink,
        }));

        return textResult(
          JSON.stringify(
            {
              total: messages.total,
              page: messages.paging.page,
              pages: messages.paging.pages,
              count: formatted.length,
              messages: formatted,
            },
            null,
            2
          )
        );
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // ── slack_channels ────────────────────────────────────────────────
  registerToolWithTelemetry(server,
    "slack_channels",
    {
      description:
        "List or filter Slack channels by name. " +
        "Returns channel IDs needed by slack_history. " +
        "Client-side name filter; returns first page only in large workspaces.",
      inputSchema: SlackChannelsSchema,
    },
    async ({ filter, types, limit, exclude_archived }) => {
      try {
        const res = await slackFetch<{
          channels: Array<{
            id: string;
            name: string;
            is_archived: boolean;
            is_private: boolean;
            topic: { value: string };
            purpose: { value: string };
            num_members: number;
          }>;
        }>("conversations.list", { types, limit, exclude_archived });

        if (!res.ok) {
          return errorResult(`Slack channels list failed: ${res.error}`);
        }

        let channels = res.data.channels;

        if (filter) {
          const lowerFilter = filter.toLowerCase();
          channels = channels.filter((c) =>
            c.name.toLowerCase().includes(lowerFilter)
          );
        }

        const formatted = channels.map((c) => ({
          id: c.id,
          name: `#${c.name}`,
          topic: c.topic.value || null,
          purpose: c.purpose.value || null,
          members: c.num_members,
          archived: c.is_archived,
          private: c.is_private,
        }));

        return textResult(JSON.stringify(formatted, null, 2));
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  // ── slack_history ─────────────────────────────────────────────────
  registerToolWithTelemetry(server,
    "slack_history",
    {
      description:
        "Get recent messages from a Slack channel. " +
        "Returns user IDs (not display names) and thread indicators. " +
        "Use slack_channels to find channel IDs by name.",
      inputSchema: SlackHistorySchema,
    },
    async ({ channel, limit, oldest, latest }) => {
      try {
        const res = await slackFetch<{
          messages: Array<{
            user?: string;
            bot_id?: string;
            text: string;
            ts: string;
            type: string;
            subtype?: string;
            thread_ts?: string;
            reply_count?: number;
          }>;
          has_more: boolean;
        }>("conversations.history", { channel, limit, oldest, latest });

        if (!res.ok) {
          if (res.error === "channel_not_found") {
            return errorResult(
              "Channel not found or not accessible. Verify the channel ID and that your token has access."
            );
          }
          return errorResult(`Slack history failed: ${res.error}`);
        }

        const formatted = res.data.messages.map((m) => ({
          user: m.user ?? m.bot_id ?? "unknown",
          timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
          text: truncate(m.text),
          thread: m.thread_ts
            ? { ts: m.thread_ts, replies: m.reply_count ?? 0 }
            : null,
        }));

        return textResult(
          JSON.stringify(
            {
              channel,
              count: formatted.length,
              has_more: res.data.has_more,
              messages: formatted,
            },
            null,
            2
          )
        );
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
