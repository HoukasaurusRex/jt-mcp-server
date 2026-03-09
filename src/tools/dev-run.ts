import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DevRunSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { runCommand } from "../lib/run-command.js";

export { resolveNodeBinPath } from "../lib/nvm-utils.js";

export function register(server: McpServer): void {
  server.registerTool(
    "dev_run",
    {
      description: "Run a shell command with optional nvm Node version, working directory, and environment variables. Enables corepack automatically when a Node version is specified.",
      inputSchema: DevRunSchema,
    },
    async ({ command, node_version, cwd, env, timeout }) => {
      try {
        const result = await runCommand({ command, node_version, cwd, env, timeout });

        if (result.exitCode !== 0) {
          return errorResult(`Exit code ${result.exitCode}\n${result.output}`);
        }

        return textResult(result.output || "(no output)");
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
