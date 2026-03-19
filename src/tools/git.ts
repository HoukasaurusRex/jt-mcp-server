import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { GitConventionalCommitSchema } from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";

const STRICT_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?: .+/;
const RELAXED_RE = /^\w+(\(.+\))?!?: .+/;

const FORBIDDEN_PATTERNS = [".env", "node_modules", "credentials", ".secret"];

export function register(server: McpServer): void {
  server.registerTool(
    "git_conventional_commit",
    {
      description: "Stage files and create a conventional commit. Validates message format and blocks sensitive files.",
      inputSchema: GitConventionalCommitSchema,
    },
    async ({ message, files, strict }) => {
      try {
        const re = strict ? STRICT_RE : RELAXED_RE;
        if (!re.test(message)) {
          const hint = strict
            ? "Must match <type>[scope]: <description> where type is feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
            : "Must match <type>[scope]: <description>";
          return errorResult(
            `Invalid commit message: "${message}". ${hint}`
          );
        }

        if (files && files.length > 0) {
          for (const file of files) {
            if (FORBIDDEN_PATTERNS.some((p) => file.includes(p))) {
              return errorResult(`Refusing to stage forbidden file: ${file}`);
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
          return errorResult("No files staged for commit");
        }

        await execa("git", ["commit", "-m", message]);

        return textResult(`Committed: ${message}\nFiles: ${staged.trim()}`);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
