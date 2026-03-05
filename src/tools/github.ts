import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphql } from "@octokit/graphql";
import { execa } from "execa";
import {
  GitHubProjectNextIssueSchema,
  GitHubProjectSetStatusSchema,
  GitHubProjectCompleteIssueSchema,
  GitHubCreatePRSchema,
} from "../types.js";

function getGraphqlClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN environment variable is required");
  return graphql.defaults({ headers: { authorization: `token ${token}` } });
}

export function register(server: McpServer): void {
  server.registerTool(
    "github_project_next_issue",
    {
      description: "Get the oldest open Todo issue from a GitHub ProjectV2 board",
      inputSchema: GitHubProjectNextIssueSchema,
    },
    async ({ project_id, status_field_id, todo_option_id }) => {
      try {
        const gql = getGraphqlClient();
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
          return {
            content: [{ type: "text", text: "No Todo issues found in the project" }],
          };
        }

        const oldest = todoItems[0];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  item_id: oldest.id,
                  title: oldest.content!.title,
                  number: oldest.content!.number,
                  url: oldest.content!.url,
                  body: oldest.content!.body,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "github_project_set_status",
    {
      description: "Update the status of a GitHub ProjectV2 item (Todo, In Progress, Done)",
      inputSchema: GitHubProjectSetStatusSchema,
    },
    async ({ project_id, item_id, status_field_id, status_option_id }) => {
      try {
        const gql = getGraphqlClient();
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

        return {
          content: [
            {
              type: "text",
              text: `Updated item ${item_id} status to ${status_option_id}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "github_project_complete_issue",
    {
      description: "Close a GitHub issue and set its project board status to Done in one call",
      inputSchema: GitHubProjectCompleteIssueSchema,
    },
    async ({ issue_number, repo, item_id, project_id, status_field_id, done_option_id }) => {
      try {
        const closeArgs = ["issue", "close", String(issue_number)];
        if (repo) closeArgs.push("--repo", repo);
        await execa("gh", closeArgs);

        const gql = getGraphqlClient();
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

        return {
          content: [
            {
              type: "text",
              text: `Closed issue #${issue_number} and set project item ${item_id} to Done`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "github_create_pr",
    {
      description: "Create a GitHub pull request using the gh CLI",
      inputSchema: GitHubCreatePRSchema,
    },
    async ({ title, body, base, head, draft }) => {
      try {
        const args = ["pr", "create", "--title", title, "--base", base];
        if (body) args.push("--body", body);
        if (head) args.push("--head", head);
        if (draft) args.push("--draft");

        const result = await execa("gh", args);
        return {
          content: [{ type: "text", text: result.stdout }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );
}
