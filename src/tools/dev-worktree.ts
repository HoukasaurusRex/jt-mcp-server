import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { DevWorktreeSchema } from "../types.js";

function worktreePath(branch: string): string {
  return join(process.cwd(), ".claude", "worktrees", branch.replace(/\//g, "-"));
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_worktree",
    {
      description: "Manage git worktrees for multi-branch workflows (create with deps install, build, or remove)",
      inputSchema: DevWorktreeSchema,
    },
    async ({ branch, action, node_version, build_command }) => {
      const wtPath = worktreePath(branch);

      try {
        switch (action) {
          case "create": {
            if (existsSync(wtPath)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Worktree already exists at ${wtPath}`,
                  },
                ],
              };
            }

            await execa("git", ["worktree", "add", wtPath, branch]);

            const installEnv: Record<string, string> = {
              ...(process.env as Record<string, string>),
            };

            if (node_version) {
              const { resolveNodeBinPath } = await import("./dev-run.js");
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

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Created worktree for '${branch}' at ${wtPath} and installed dependencies`,
                },
              ],
            };
          }

          case "build": {
            if (!existsSync(wtPath)) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `No worktree found at ${wtPath}. Create it first.`,
                  },
                ],
                isError: true,
              };
            }

            const cmd = build_command ?? "yarn build";
            const buildEnv: Record<string, string> = {
              ...(process.env as Record<string, string>),
            };

            if (node_version) {
              const { resolveNodeBinPath } = await import("./dev-run.js");
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
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Build failed (exit ${result.exitCode})\n${output}`,
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Built '${branch}' worktree at ${wtPath}`,
                },
              ],
            };
          }

          case "remove": {
            if (existsSync(wtPath)) {
              await execa("git", ["worktree", "remove", wtPath, "--force"]);
            }
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Removed worktree for '${branch}' at ${wtPath}`,
                },
              ],
            };
          }
        }
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
