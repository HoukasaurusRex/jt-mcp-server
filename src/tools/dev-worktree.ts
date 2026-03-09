import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { DevWorktreeSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { resolveNodeBinPath } from "../lib/nvm-utils.js";

function worktreePath(branch: string): string {
  return join(process.cwd(), ".claude", "worktrees", branch.replace(/\//g, "-"));
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_worktree",
    {
      description: "Manage git worktrees for multi-branch workflows (create with deps install, build, remove, or list)",
      inputSchema: DevWorktreeSchema,
    },
    async ({ branch, action, node_version, build_command }) => {
      const wtPath = worktreePath(branch);

      try {
        switch (action) {
          case "list": {
            const { stdout } = await execa("git", ["worktree", "list", "--porcelain"]);
            const worktrees = stdout
              .split("\n\n")
              .filter(Boolean)
              .map((block) => {
                const lines = block.split("\n");
                const result: Record<string, string> = {};
                for (const line of lines) {
                  const spaceIdx = line.indexOf(" ");
                  if (spaceIdx > 0) {
                    result[line.slice(0, spaceIdx)] = line.slice(spaceIdx + 1);
                  } else if (line === "bare" || line === "detached") {
                    result[line] = "true";
                  }
                }
                return result;
              });
            return textResult(JSON.stringify(worktrees, null, 2));
          }

          case "create": {
            if (existsSync(wtPath)) {
              return textResult(`Worktree already exists at ${wtPath}`);
            }

            await execa("git", ["worktree", "add", wtPath, branch]);

            const installEnv: Record<string, string> = {
              ...(process.env as Record<string, string>),
            };

            if (node_version) {
              const binPath = resolveNodeBinPath(node_version);
              if (binPath) {
                installEnv.PATH = `${binPath}:${installEnv.PATH ?? ""}`;
                await execa("corepack", ["enable"], { env: installEnv, reject: false });
              }
            }

            await execa("sh", ["-c", "yarn install --immutable || yarn install || npm install"], {
              cwd: wtPath,
              env: installEnv,
              reject: false,
            });

            return textResult(
              `Created worktree for '${branch}' at ${wtPath} and installed dependencies`
            );
          }

          case "build": {
            if (!existsSync(wtPath)) {
              return errorResult(`No worktree found at ${wtPath}. Create it first.`);
            }

            const cmd = build_command ?? "yarn build";
            const buildEnv: Record<string, string> = {
              ...(process.env as Record<string, string>),
            };

            if (node_version) {
              const binPath = resolveNodeBinPath(node_version);
              if (binPath) {
                buildEnv.PATH = `${binPath}:${buildEnv.PATH ?? ""}`;
                await execa("corepack", ["enable"], { env: buildEnv, reject: false });
              }
            }

            const result = await execa("sh", ["-c", cmd], {
              cwd: wtPath,
              env: buildEnv,
              reject: false,
            });

            if (result.exitCode !== 0) {
              const output = [result.stdout, result.stderr]
                .filter(Boolean)
                .join("\n");
              return errorResult(`Build failed (exit ${result.exitCode})\n${output}`);
            }

            return textResult(`Built '${branch}' worktree at ${wtPath}`);
          }

          case "remove": {
            if (existsSync(wtPath)) {
              await execa("git", ["worktree", "remove", wtPath, "--force"]);
            }
            return textResult(`Removed worktree for '${branch}' at ${wtPath}`);
          }
        }
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
