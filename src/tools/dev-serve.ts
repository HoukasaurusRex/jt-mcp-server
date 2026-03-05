import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { DevServeSchema, DevServeStopSchema } from "../types.js";

const servers = new Map<number, { kill: () => void }>();

async function killPort(port: number): Promise<void> {
  try {
    const { stdout } = await execa("lsof", ["-ti", `:${port}`]);
    const pids = stdout.trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      await execa("kill", ["-9", pid]);
    }
  } catch {
    // nothing on port
  }
}

async function waitForServer(port: number, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server on port ${port} not ready after ${timeout}ms`);
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_serve",
    {
      description: "Serve a directory on a port (kills existing process on that port first). Returns URL when ready.",
      inputSchema: DevServeSchema,
    },
    async ({ directory, port }) => {
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

        await waitForServer(port);

        const url = `http://localhost:${port}`;
        return {
          content: [{ type: "text", text: `Serving ${directory} at ${url}` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
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
        return {
          content: [{ type: "text", text: `Stopped server on port ${port}` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );
}
