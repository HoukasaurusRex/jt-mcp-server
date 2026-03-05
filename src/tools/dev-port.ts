import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { DevPortSchema } from "../types.js";

async function getPidOnPort(port: number): Promise<string | null> {
  try {
    const { stdout } = await execa("lsof", [
      "-ti",
      `:${port}`,
    ]);
    const pid = stdout.trim().split("\n")[0];
    return pid || null;
  } catch {
    return null;
  }
}

async function killPort(port: number): Promise<string> {
  const pid = await getPidOnPort(port);
  if (!pid) {
    return `No process found on port ${port}`;
  }
  await execa("kill", ["-9", pid]);
  return `Killed process ${pid} on port ${port}`;
}

async function waitReady(
  port: number,
  timeout: number
): Promise<string> {
  const start = Date.now();
  const interval = 250;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) {
        return `Port ${port} is ready (${Date.now() - start}ms)`;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Port ${port} not ready after ${timeout}ms`);
}

export function register(server: McpServer): void {
  server.registerTool(
    "dev_port",
    {
      description: "Check, kill, or wait for a port to be ready",
      inputSchema: DevPortSchema,
    },
    async ({ port, action, timeout }) => {
      try {
        let result: string;
        switch (action) {
          case "check": {
            const pid = await getPidOnPort(port);
            result = pid
              ? `Port ${port} is in use by PID ${pid}`
              : `Port ${port} is free`;
            break;
          }
          case "kill":
            result = await killPort(port);
            break;
          case "wait_ready":
            result = await waitReady(port, timeout);
            break;
        }
        return { content: [{ type: "text", text: result }] };
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
