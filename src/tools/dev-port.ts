import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DevPortSchema } from "../types.js";
import { getPidOnPort, killPort, waitForPort } from "../lib/port-utils.js";
import { textResult, errorResult } from "../lib/tool-result.js";

export function register(server: McpServer): void {
  server.registerTool(
    "dev_port",
    {
      description: "Check, kill, or wait for a port to be ready",
      inputSchema: DevPortSchema,
    },
    async ({ port, action, timeout }) => {
      try {
        switch (action) {
          case "check": {
            const pid = await getPidOnPort(port);
            return textResult(
              pid
                ? `Port ${port} is in use by PID ${pid}`
                : `Port ${port} is free`
            );
          }
          case "kill": {
            const pid = await getPidOnPort(port);
            if (!pid) return textResult(`No process found on port ${port}`);
            await killPort(port);
            return textResult(`Killed process ${pid} on port ${port}`);
          }
          case "wait_ready":
            await waitForPort(port, timeout, [200]);
            return textResult(`Port ${port} is ready`);
        }
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
