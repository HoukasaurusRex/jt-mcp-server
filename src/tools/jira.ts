import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import {
  JiraSearchSchema,
  JiraGetIssueSchema,
  JiraCreateIssueSchema,
  JiraTransitionSchema,
  JiraAddCommentSchema,
  JiraAssignSchema,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

/** Run an acli command and return stdout. Throws on non-zero exit. */
async function acli(
  args: string[],
  { json = true }: { json?: boolean } = {}
): Promise<string> {
  if (json) args.push("--json");
  const result = await execa("acli", args, { reject: false, timeout: 30000 });
  if (result.exitCode !== 0) {
    const output = result.stderr || result.stdout;
    throw new Error(`acli failed (exit ${result.exitCode}): ${output}`);
  }
  return result.stdout;
}

export function register(server: McpServer): void {
  // ── jira_search ───────────────────────────────────────────────────
  server.registerTool(
    "jira_search",
    {
      description:
        "Search Jira issues using JQL via the Atlassian CLI. " +
        "Requires `acli auth login` to have been run first.",
      inputSchema: JiraSearchSchema,
    },
    async ({ jql, max_results, fields }) => {
      try {
        const args = [
          "jira",
          "workitem",
          "search",
          "--jql",
          jql,
          "--limit",
          String(max_results),
        ];
        if (fields) args.push("--fields", fields);

        const stdout = await acli(args);
        return textResult(stdout);
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
        "Get full details of a Jira issue by key via the Atlassian CLI.",
      inputSchema: JiraGetIssueSchema,
    },
    async ({ issue_key, fields }) => {
      try {
        const args = ["jira", "workitem", "view", issue_key];
        if (fields) args.push("--fields", fields);

        const stdout = await acli(args);
        return textResult(stdout);
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
        "Create a new Jira issue via the Atlassian CLI. " +
        "Supports Task, Bug, Story, Epic, and subtask types.",
      inputSchema: JiraCreateIssueSchema,
    },
    async ({ project_key, summary, issue_type, description, assignee, labels, parent_key }) => {
      try {
        const args = [
          "jira",
          "workitem",
          "create",
          "--project",
          project_key,
          "--summary",
          summary,
          "--type",
          issue_type,
        ];

        if (description) args.push("--description", description);
        if (assignee) args.push("--assignee", assignee);
        if (parent_key) args.push("--parent", parent_key);
        if (labels && labels.length > 0) {
          args.push("--label", labels.join(","));
        }

        const stdout = await acli(args);
        return textResult(stdout);
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
        "Transition a Jira issue to a new status (e.g. 'In Progress', 'Done') via the Atlassian CLI.",
      inputSchema: JiraTransitionSchema,
    },
    async ({ issue_key, status }) => {
      try {
        const args = [
          "jira",
          "workitem",
          "transition",
          "--key",
          issue_key,
          "--status",
          status,
        ];

        const stdout = await acli(args, { json: false });
        return textResult(stdout || `Transitioned ${issue_key} → "${status}"`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── jira_add_comment ──────────────────────────────────────────────
  server.registerTool(
    "jira_add_comment",
    {
      description: "Add a comment to a Jira issue via the Atlassian CLI.",
      inputSchema: JiraAddCommentSchema,
    },
    async ({ issue_key, body }) => {
      try {
        const args = [
          "jira",
          "workitem",
          "comment",
          "create",
          "--key",
          issue_key,
          "--body",
          body,
        ];

        const stdout = await acli(args, { json: false });
        return textResult(stdout || `Comment added to ${issue_key}`);
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
        "Assign or unassign a Jira issue via the Atlassian CLI. " +
        "Use '@me' for self-assign or an email address.",
      inputSchema: JiraAssignSchema,
    },
    async ({ issue_key, assignee }) => {
      try {
        const args = [
          "jira",
          "workitem",
          "assign",
          "--key",
          issue_key,
          "--assignee",
          assignee,
        ];

        const stdout = await acli(args, { json: false });
        return textResult(
          stdout || `Assigned ${issue_key} to ${assignee}`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
