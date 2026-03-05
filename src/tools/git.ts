import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { GitConventionalCommitSchema } from "../types.js";

const CONVENTIONAL_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+/;

const FORBIDDEN_PATTERNS = [".env", "node_modules", "credentials", ".secret"];

export function register(server: McpServer): void {
  server.registerTool(
    "git_conventional_commit",
    {
      description: "Stage files and create a conventional commit. Validates message format and blocks sensitive files.",
      inputSchema: GitConventionalCommitSchema,
    },
    async ({ message, files }) => {
      try {
        if (!CONVENTIONAL_RE.test(message)) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid conventional commit message: "${message}". Must match <type>[scope]: <description>`,
              },
            ],
            isError: true,
          };
        }

        if (files && files.length > 0) {
          for (const file of files) {
            if (FORBIDDEN_PATTERNS.some((p) => file.includes(p))) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Refusing to stage forbidden file: ${file}`,
                  },
                ],
                isError: true,
              };
            }
          }
          await execa("git", ["add", ...files]);
        }

        const { stdout: staged } = await execa("git", [
          "diff",
          "--cached",
          "--name-only",
        ]);
        if (!staged.trim()) {
          return {
            content: [
              { type: "text", text: "No files staged for commit" },
            ],
            isError: true,
          };
        }

        await execa("git", ["commit", "-m", message]);

        return {
          content: [
            {
              type: "text",
              text: `Committed: ${message}\nFiles: ${staged.trim()}`,
            },
          ],
        };
      } catch (err) {
        const message_ = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message_ }],
          isError: true,
        };
      }
    }
  );
}
