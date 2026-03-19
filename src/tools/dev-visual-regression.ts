import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { DevVisualRegressionSchema } from "../types.js";
import { killPort, waitForPort } from "../lib/port-utils.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";

async function serveDir(dir: string, port: number, timeout: number): Promise<{ kill: () => void }> {
  await killPort(port);
  const subprocess = execa("npx", ["serve", "-s", "-l", String(port), dir], {
    reject: false,
    stdio: "ignore",
  });
  const handle = { kill: () => subprocess.kill() };

  try {
    await waitForPort(port, timeout);
    return handle;
  } catch {
    handle.kill();
    throw new Error(`Server on port ${port} did not start within ${timeout}ms`);
  }
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
      startup_timeout,
    }) => {
      let child: { kill: () => void } | null = null;

      try {
        child = await serveDir(reference_dir, port, startup_timeout);

        if (update_baselines) {
          const updateResult = await execa("sh", ["-c", update_command], {
            reject: false,
          });
          if (updateResult.exitCode !== 0) {
            const output = [updateResult.stdout, updateResult.stderr]
              .filter(Boolean)
              .join("\n");
            child.kill();
            return errorResult(
              `Baseline update failed (exit ${updateResult.exitCode})\n${output}`
            );
          }
        }

        child.kill();
        child = await serveDir(test_dir, port, startup_timeout);

        const testResult = await execa("sh", ["-c", test_command], {
          reject: false,
        });

        child.kill();
        await killPort(port);

        const output = [testResult.stdout, testResult.stderr]
          .filter(Boolean)
          .join("\n");

        if (testResult.exitCode !== 0) {
          return errorResult(
            `Visual regression tests failed (exit ${testResult.exitCode})\n${output}`
          );
        }

        return textResult(`Visual regression tests passed\n${output}`);
      } catch (err) {
        if (child) child.kill();
        await killPort(port);
        return catchToolError(err);
      }
    }
  );
}
