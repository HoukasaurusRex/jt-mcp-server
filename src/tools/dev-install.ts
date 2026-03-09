import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DevInstallSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { runCommand } from "../lib/run-command.js";
import { detectPackageManager } from "../lib/package-manager.js";

export function register(server: McpServer): void {
  server.registerTool(
    "dev_install",
    {
      description:
        "Install project dependencies using the correct package manager (auto-detected from lockfile). Supports frozen/immutable lockfile mode for CI.",
      inputSchema: DevInstallSchema,
    },
    async ({ cwd, frozen, node_version, timeout }) => {
      try {
        const pm = detectPackageManager(cwd);

        let command: string;
        switch (pm) {
          case "yarn":
            command = frozen ? "yarn install --immutable" : "yarn install";
            break;
          case "npm":
            command = frozen ? "npm ci" : "npm install";
            break;
          case "pnpm":
            command = frozen ? "pnpm install --frozen-lockfile" : "pnpm install";
            break;
        }

        const result = await runCommand({ command, cwd, node_version, timeout });

        if (result.exitCode !== 0) {
          return errorResult(`${pm} install failed (exit ${result.exitCode})\n${result.output}`);
        }

        return textResult(`[${pm}] Dependencies installed successfully\n${result.output}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
