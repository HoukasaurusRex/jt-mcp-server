import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphql } from "@octokit/graphql";
import { execa } from "execa";
import {
  GitHubProjectNextIssueSchema,
  GitHubProjectSetStatusSchema,
  GitHubProjectCompleteIssueSchema,
  GitHubCreatePRSchema,
} from "../types.js";
import type {
  GitHubProjectNextIssueInput,
  GitHubProjectSetStatusInput,
  GitHubProjectCompleteIssueInput,
  GitHubCreatePRInput,
} from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";
import { registerToolWithTelemetry } from "../lib/tool-telemetry.js";

let _gqlClient: ReturnType<typeof graphql.defaults> | null = null;

async function getGraphqlClient() {
  if (_gqlClient) return _gqlClient;
  const envToken = process.env.GITHUB_TOKEN;
  let token: string;
  if (envToken) {
    token = envToken;
  } else {
    const { stdout } = await execa("gh", ["auth", "token"]);
    token = stdout.trim();
    if (!token) throw new Error("No GITHUB_TOKEN env var and `gh auth token` returned empty");
  }
  _gqlClient = graphql.defaults({ headers: { authorization: `token ${token}` } });
  return _gqlClient;
}

export function register(server: McpServer): void {
  registerToolWithTelemetry(server,
    "github_project_next_issue",
    {
      description: "Get the oldest open Todo issue from a GitHub ProjectV2 board",
      inputSchema: GitHubProjectNextIssueSchema,
    },
    async ({ project_id, status_field_id, todo_option_id }: GitHubProjectNextIssueInput) => {
      try {
        const gql = await getGraphqlClient();
        const result = await gql<{
          node: {
            items: {
              nodes: Array<{
                id: string;
                fieldValueByName: { optionId: string } | null;
                content: {
                  title: string;
                  number: number;
                  url: string;
                  body: string;
                } | null;
              }>;
            };
          };
        }>(
          `query ($projectId: ID!) {
            node(id: $projectId) {
              ... on ProjectV2 {
                items(first: 50) {
                  nodes {
                    id
                    fieldValueByName(name: "Status") {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        optionId
                      }
                    }
                    content {
                      ... on Issue {
                        title
                        number
                        url
                        body
                      }
                    }
                  }
                }
              }
            }
          }`,
          { projectId: project_id }
        );

        const todoItems = result.node.items.nodes.filter(
          (item) =>
            item.fieldValueByName?.optionId === todo_option_id &&
            item.content != null
        );

        if (todoItems.length === 0) {
          return textResult("No Todo issues found in the project");
        }

        const oldest = todoItems[0];
        return textResult(
          JSON.stringify(
            {
              item_id: oldest.id,
              title: oldest.content!.title,
              number: oldest.content!.number,
              url: oldest.content!.url,
              body: oldest.content!.body,
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

  registerToolWithTelemetry(server,
    "github_project_set_status",
    {
      description: "Update the status of a GitHub ProjectV2 item (Todo, In Progress, Done)",
      inputSchema: GitHubProjectSetStatusSchema,
    },
    async ({ project_id, item_id, status_field_id, status_option_id }: GitHubProjectSetStatusInput) => {
      try {
        const gql = await getGraphqlClient();
        await gql(
          `mutation ($input: UpdateProjectV2ItemFieldValueInput!) {
            updateProjectV2ItemFieldValue(input: $input) {
              projectV2Item { id }
            }
          }`,
          {
            input: {
              projectId: project_id,
              itemId: item_id,
              fieldId: status_field_id,
              value: { singleSelectOptionId: status_option_id },
            },
          }
        );

        return textResult(`Updated item ${item_id} status to ${status_option_id}`);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  registerToolWithTelemetry(server,
    "github_project_complete_issue",
    {
      description: "Close a GitHub issue and set its project board status to Done in one call",
      inputSchema: GitHubProjectCompleteIssueSchema,
    },
    async ({ issue_number, repo, item_id, project_id, status_field_id, done_option_id }: GitHubProjectCompleteIssueInput) => {
      try {
        const closeArgs = ["issue", "close", String(issue_number)];
        if (repo) closeArgs.push("--repo", repo);
        await execa("gh", closeArgs);

        const gql = await getGraphqlClient();
        await gql(
          `mutation ($input: UpdateProjectV2ItemFieldValueInput!) {
            updateProjectV2ItemFieldValue(input: $input) {
              projectV2Item { id }
            }
          }`,
          {
            input: {
              projectId: project_id,
              itemId: item_id,
              fieldId: status_field_id,
              value: { singleSelectOptionId: done_option_id },
            },
          }
        );

        return textResult(
          `Closed issue #${issue_number} and set project item ${item_id} to Done`
        );
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  registerToolWithTelemetry(server,
    "github_create_pr",
    {
      description: "Create a GitHub pull request using the gh CLI",
      inputSchema: GitHubCreatePRSchema,
    },
    async ({ title, body, base, head, draft }: GitHubCreatePRInput) => {
      try {
        const args = ["pr", "create", "--title", title, "--base", base];
        if (body) args.push("--body", body);
        if (head) args.push("--head", head);
        if (draft) args.push("--draft");

        const result = await execa("gh", args);
        return textResult(result.stdout);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
