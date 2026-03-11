import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  JiraSearchSchema,
  JiraGetIssueSchema,
  JiraCreateIssueSchema,
  JiraTransitionSchema,
  JiraAddCommentSchema,
  JiraAssignSchema,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { atlassianFetch } from "../lib/atlassian-client.js";

// Jira REST API v3 — https://developer.atlassian.com/cloud/jira/platform/rest/v3/

export function register(server: McpServer): void {
  // ── jira_search ───────────────────────────────────────────────────
  server.registerTool(
    "jira_search",
    {
      description:
        "Search Jira issues using JQL via the Atlassian REST API. " +
        "Requires ATLASSIAN_DOMAIN, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN env vars.",
      inputSchema: JiraSearchSchema,
    },
    async ({ jql, max_results, fields }) => {
      try {
        const res = await atlassianFetch<{ issues: unknown[] }>("/rest/api/3/search", {
          query: {
            jql,
            maxResults: max_results,
            fields,
          },
        });
        if (!res.ok) {
          return errorResult(`Jira search failed (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(JSON.stringify(res.data.issues ?? res.data, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_get_issue ────────────────────────────────────────────────
  server.registerTool(
    "jira_get_issue",
    {
      description:
        "Get full details of a Jira issue by key via the Atlassian REST API.",
      inputSchema: JiraGetIssueSchema,
    },
    async ({ issue_key, fields }) => {
      try {
        const res = await atlassianFetch(`/rest/api/3/issue/${issue_key}`, {
          query: fields ? { fields } : {},
        });
        if (!res.ok) {
          return errorResult(`Failed to get ${issue_key} (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(JSON.stringify(res.data, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_create_issue ─────────────────────────────────────────────
  server.registerTool(
    "jira_create_issue",
    {
      description:
        "Create a new Jira issue via the Atlassian REST API. " +
        "Supports Task, Bug, Story, Epic, and subtask types.",
      inputSchema: JiraCreateIssueSchema,
    },
    async ({ project_key, summary, issue_type, description, assignee, labels, parent_key }) => {
      try {
        // Resolve @me to current user's accountId
        let assigneeId: string | undefined;
        if (assignee === "@me") {
          const me = await atlassianFetch<{ accountId: string }>("/rest/api/3/myself");
          if (!me.ok) {
            return errorResult(`Failed to resolve @me (${me.status}): ${JSON.stringify(me.data)}`);
          }
          assigneeId = me.data.accountId;
        } else if (assignee) {
          // Search for user by email to get accountId
          const users = await atlassianFetch<Array<{ accountId: string }>>(
            "/rest/api/3/user/search",
            { query: { query: assignee } }
          );
          if (!users.ok || !Array.isArray(users.data) || users.data.length === 0) {
            return errorResult(`Could not find user "${assignee}"`);
          }
          assigneeId = users.data[0].accountId;
        }

        const issueFields: Record<string, unknown> = {
          project: { key: project_key },
          summary,
          issuetype: { name: issue_type },
        };
        if (description) {
          issueFields.description = {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
          };
        }
        if (assigneeId) issueFields.assignee = { accountId: assigneeId };
        if (labels && labels.length > 0) issueFields.labels = labels;
        if (parent_key) issueFields.parent = { key: parent_key };

        const res = await atlassianFetch<{ key: string }>("/rest/api/3/issue", {
          method: "POST",
          body: { fields: issueFields },
        });
        if (!res.ok) {
          return errorResult(`Failed to create issue (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(JSON.stringify(res.data, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_transition ───────────────────────────────────────────────
  server.registerTool(
    "jira_transition",
    {
      description:
        "Transition a Jira issue to a new status (e.g. 'In Progress', 'Done') via the Atlassian REST API.",
      inputSchema: JiraTransitionSchema,
    },
    async ({ issue_key, status }) => {
      try {
        // First, get available transitions
        const tRes = await atlassianFetch<{ transitions: Array<{ id: string; name: string }> }>(
          `/rest/api/3/issue/${issue_key}/transitions`
        );
        if (!tRes.ok) {
          return errorResult(`Failed to get transitions for ${issue_key} (${tRes.status}): ${JSON.stringify(tRes.data)}`);
        }

        const match = tRes.data.transitions.find(
          (t) => t.name.toLowerCase() === status.toLowerCase()
        );
        if (!match) {
          const available = tRes.data.transitions.map((t) => t.name).join(", ");
          return errorResult(`No transition "${status}" for ${issue_key}. Available: ${available}`);
        }

        const res = await atlassianFetch(`/rest/api/3/issue/${issue_key}/transitions`, {
          method: "POST",
          body: { transition: { id: match.id } },
        });
        if (!res.ok) {
          return errorResult(`Failed to transition ${issue_key} (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(`Transitioned ${issue_key} → "${status}"`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_add_comment ──────────────────────────────────────────────
  server.registerTool(
    "jira_add_comment",
    {
      description: "Add a comment to a Jira issue via the Atlassian REST API.",
      inputSchema: JiraAddCommentSchema,
    },
    async ({ issue_key, body }) => {
      try {
        const res = await atlassianFetch(`/rest/api/3/issue/${issue_key}/comment`, {
          method: "POST",
          body: {
            body: {
              type: "doc",
              version: 1,
              content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
            },
          },
        });
        if (!res.ok) {
          return errorResult(`Failed to comment on ${issue_key} (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(`Comment added to ${issue_key}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_assign ───────────────────────────────────────────────────
  server.registerTool(
    "jira_assign",
    {
      description:
        "Assign or unassign a Jira issue via the Atlassian REST API. " +
        "Use '@me' for self-assign or an email address.",
      inputSchema: JiraAssignSchema,
    },
    async ({ issue_key, assignee }) => {
      try {
        let accountId: string | null;

        if (assignee === "unassign") {
          accountId = null;
        } else if (assignee === "@me") {
          const me = await atlassianFetch<{ accountId: string }>("/rest/api/3/myself");
          if (!me.ok) {
            return errorResult(`Failed to resolve @me (${me.status}): ${JSON.stringify(me.data)}`);
          }
          accountId = me.data.accountId;
        } else {
          const users = await atlassianFetch<Array<{ accountId: string }>>(
            "/rest/api/3/user/search",
            { query: { query: assignee } }
          );
          if (!users.ok || !Array.isArray(users.data) || users.data.length === 0) {
            return errorResult(`Could not find user "${assignee}"`);
          }
          accountId = users.data[0].accountId;
        }

        const res = await atlassianFetch(`/rest/api/3/issue/${issue_key}/assignee`, {
          method: "PUT",
          body: { accountId },
        });
        if (!res.ok) {
          return errorResult(`Failed to assign ${issue_key} (${res.status}): ${JSON.stringify(res.data)}`);
        }
        return textResult(`Assigned ${issue_key} to ${assignee}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
