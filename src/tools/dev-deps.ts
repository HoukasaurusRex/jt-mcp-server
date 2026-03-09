import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DevDepsSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { runCommand } from "../lib/run-command.js";
import { detectPackageManager } from "../lib/package-manager.js";

export function register(server: McpServer): void {
  server.registerTool(
    "dev_deps",
    {
      description:
        "Add or remove npm packages using the correct package manager (auto-detected from lockfile). Supports devDependencies.",
      inputSchema: DevDepsSchema,
    },
    async ({ action, packages, dev, cwd, node_version, timeout }) => {
      const projectDir = cwd ?? process.cwd();

      try {
        const pm = detectPackageManager(projectDir);
        const pkgList = packages.join(" ");

        let command: string;
        if (action === "add") {
          switch (pm) {
            case "yarn":
              command = `yarn add ${dev ? "--dev " : ""}${pkgList}`;
              break;
            case "npm":
              command = `npm install ${dev ? "--save-dev " : ""}${pkgList}`;
              break;
            case "pnpm":
              command = `pnpm add ${dev ? "--save-dev " : ""}${pkgList}`;
              break;
          }
        } else {
          switch (pm) {
            case "yarn":
              command = `yarn remove ${pkgList}`;
              break;
            case "npm":
              command = `npm uninstall ${pkgList}`;
              break;
            case "pnpm":
              command = `pnpm remove ${pkgList}`;
              break;
          }
        }

        const result = await runCommand({ command, cwd: projectDir, node_version, timeout });

        if (result.exitCode !== 0) {
          return errorResult(`${pm} ${action} failed (exit ${result.exitCode})\n${result.output}`);
        }

        return textResult(
          `[${pm}] ${action === "add" ? "Added" : "Removed"} ${packages.join(", ")}${dev && action === "add" ? " (dev)" : ""}\n${result.output}`
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
