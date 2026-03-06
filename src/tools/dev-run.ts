import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { DevRunSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

export function resolveNodeBinPath(version: string): string | null {
  const nvmDir = join(homedir(), ".nvm", "versions", "node");

  const exactPath = join(nvmDir, version.startsWith("v") ? version : `v${version}`, "bin");
  if (existsSync(exactPath)) return exactPath;

  try {
    const dirs = readdirSync(nvmDir);
    const prefix = version.startsWith("v") ? version : `v${version}`;
    const match = dirs
      .filter((d) => d.startsWith(prefix))
      .sort()
      .pop();
    if (match) {
      const binPath = join(nvmDir, match, "bin");
      if (existsSync(binPath)) return binPath;
    }
  } catch {
    // nvm dir doesn't exist or not readable
  }

  return null;
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_run",
    {
      description: "Run a shell command with optional nvm Node version, working directory, and environment variables. Enables corepack automatically when a Node version is specified.",
      inputSchema: DevRunSchema,
    },
    async ({ command, node_version, cwd, env, timeout }) => {
      try {
        const execEnv: Record<string, string> = {
          ...(process.env as Record<string, string>),
          ...(env as Record<string, string> | undefined),
        };

        if (node_version) {
          const binPath = resolveNodeBinPath(node_version);
          if (!binPath) {
            return errorResult(
              `Node version ${node_version} not found in ~/.nvm/versions/node/`
            );
          }
          execEnv.PATH = `${binPath}:${execEnv.PATH ?? ""}`;
          await execa("corepack", ["enable"], { env: execEnv, reject: false });
        }

        const result = await execa("sh", ["-c", command], {
          cwd: cwd ?? process.cwd(),
          env: execEnv,
          reject: false,
          timeout,
        });

        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n");

        if (result.exitCode !== 0) {
          return errorResult(`Exit code ${result.exitCode}\n${output}`);
        }

        return textResult(output || "(no output)");
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
