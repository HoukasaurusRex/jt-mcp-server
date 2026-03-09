import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DevScriptSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { runCommand } from "../lib/run-command.js";
import { detectPackageManager } from "../lib/package-manager.js";

export function register(server: McpServer): void {
  server.registerTool(
    "dev_script",
    {
      description:
        "Run a package.json script by name with the correct package manager. Validates the script exists and lists available scripts on error.",
      inputSchema: DevScriptSchema,
    },
    async ({ script, args, cwd, node_version, timeout }) => {
      const projectDir = cwd ?? process.cwd();

      try {
        let pkg: { scripts?: Record<string, string> };
        try {
          pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8"));
        } catch {
          return errorResult(`No package.json found in ${projectDir}`);
        }

        const scripts = pkg.scripts ?? {};
        if (!(script in scripts)) {
          const available = Object.keys(scripts);
          return errorResult(
            `Script "${script}" not found in package.json.\nAvailable scripts: ${available.length ? available.join(", ") : "(none)"}`
          );
        }

        const pm = detectPackageManager(projectDir);
        let command: string;
        switch (pm) {
          case "yarn":
            command = `yarn run ${script}`;
            break;
          case "npm":
            command = `npm run ${script}`;
            break;
          case "pnpm":
            command = `pnpm run ${script}`;
            break;
        }
        if (args) command += ` ${args}`;

        const result = await runCommand({ command, cwd: projectDir, node_version, timeout });

        if (result.exitCode !== 0) {
          return errorResult(`${pm} run ${script} failed (exit ${result.exitCode})\n${result.output}`);
        }

        return textResult(result.output || "(no output)");
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
