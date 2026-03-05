import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { DevRunSchema } from "../types.js";

export function resolveNodeBinPath(version: string): string | null {
  const nvmDir = join(homedir(), ".nvm", "versions", "node");

  // Try exact match first (e.g. "v20.11.0")
  const exactPath = join(nvmDir, version.startsWith("v") ? version : `v${version}`, "bin");
  if (existsSync(exactPath)) return exactPath;

  // Try prefix match (e.g. "20" -> find "v20.x.y")
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
    async ({ command, node_version, cwd, env }) => {
      try {
        const execEnv: Record<string, string> = {
          ...(process.env as Record<string, string>),
          ...(env as Record<string, string> | undefined),
        };

        // If a node version is requested, prepend the nvm bin to PATH
        if (node_version) {
          const binPath = resolveNodeBinPath(node_version);
          if (!binPath) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Node version ${node_version} not found in ~/.nvm/versions/node/`,
                },
              ],
              isError: true,
            };
          }
          execEnv.PATH = `${binPath}:${execEnv.PATH ?? ""}`;

          // Enable corepack so yarn/pnpm are available for the resolved Node version
          await execa("corepack", ["enable"], { env: execEnv, reject: false });
        }

        const result = await execa("sh", ["-c", command], {
          cwd: cwd ?? process.cwd(),
          env: execEnv,
          reject: false,
          timeout: 300000, // 5 min default
        });

        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n");

        if (result.exitCode !== 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Exit code ${result.exitCode}\n${output}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: output || "(no output)" }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    }
  );
}
