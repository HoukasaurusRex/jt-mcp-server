import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { DevServeSchema, DevServeStopSchema } from "../types.js";
import { killPort, waitForPort } from "../lib/port-utils.js";
import { textResult, errorResult } from "../lib/tool-result.js";

const servers = new Map<number, { kill: () => void }>();

export function register(server: McpServer): void {
  server.registerTool(
    "dev_serve",
    {
      description: "Serve a directory on a port (kills existing process on that port first). Returns URL when ready.",
      inputSchema: DevServeSchema,
    },
    async ({ directory, port, startup_timeout }) => {
      try {
        const existing = servers.get(port);
        if (existing) {
          existing.kill();
          servers.delete(port);
        }
        await killPort(port);

        const subprocess = execa("npx", ["serve", "-s", "-l", String(port), directory], {
          reject: false,
          stdio: "ignore",
        });
        servers.set(port, { kill: () => subprocess.kill() });

        await waitForPort(port, startup_timeout);

        return textResult(`Serving ${directory} at http://localhost:${port}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.registerTool(
    "dev_serve_stop",
    {
      description: "Stop a dev server running on a port",
      inputSchema: DevServeStopSchema,
    },
    async ({ port }) => {
      try {
        const child = servers.get(port);
        if (child) {
          child.kill();
          servers.delete(port);
        }
        await killPort(port);
        return textResult(`Stopped server on port ${port}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
