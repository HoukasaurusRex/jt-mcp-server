import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { DevVisualRegressionSchema } from "../types.js";

async function killPort(port: number): Promise<void> {
  try {
    const { stdout } = await execa("lsof", ["-ti", `:${port}`]);
    for (const pid of stdout.trim().split("\n").filter(Boolean)) {
      await execa("kill", ["-9", pid]);
    }
  } catch {
    // nothing on port
  }
}

async function serveDir(dir: string, port: number): Promise<{ kill: () => void }> {
  await killPort(port);
  const subprocess = execa("npx", ["serve", "-s", "-l", String(port), dir], {
    reject: false,
    stdio: "ignore",
  });
  const handle = { kill: () => subprocess.kill() };

  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 404) return handle;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  handle.kill();
  throw new Error(`Server on port ${port} did not start within 15s`);
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_visual_regression",
    {
      description: "Run a visual regression test cycle: serve reference dir, capture/update baselines, serve test dir, run comparison tests",
      inputSchema: DevVisualRegressionSchema,
    },
    async ({
      reference_dir,
      test_dir,
      port,
      update_baselines,
      test_command,
      update_command,
    }) => {
      let child: { kill: () => void } | null = null;

      try {
        child = await serveDir(reference_dir, port);

        if (update_baselines) {
          const updateResult = await execa("sh", ["-c", update_command], {
            reject: false,
          });
          if (updateResult.exitCode !== 0) {
            const output = [updateResult.stdout, updateResult.stderr]
              .filter(Boolean)
              .join("\n");
            child.kill();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Baseline update failed (exit ${updateResult.exitCode})\n${output}`,
                },
              ],
              isError: true,
            };
          }
        }

        child.kill();
        child = await serveDir(test_dir, port);

        const testResult = await execa("sh", ["-c", test_command], {
          reject: false,
        });

        child.kill();
        await killPort(port);

        const output = [testResult.stdout, testResult.stderr]
          .filter(Boolean)
          .join("\n");

        if (testResult.exitCode !== 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Visual regression tests failed (exit ${testResult.exitCode})\n${output}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Visual regression tests passed\n${output}`,
            },
          ],
        };
      } catch (err) {
        if (child) child.kill();
        await killPort(port);
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    }
  );
}
