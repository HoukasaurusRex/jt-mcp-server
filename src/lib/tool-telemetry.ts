/**
 * Tool telemetry: wraps tool registration to automatically log every call
 * to the knowledge graph's event_log table. Telemetry is best-effort —
 * failures never block the actual tool call.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDb } from "./memory-db.js";

type ToolHandler = (...args: any[]) => Promise<any>;

/**
 * Log a tool call event to the event_log table.
 */
async function logToolEvent(
  toolName: string,
  isError: boolean,
  durationMs: number
): Promise<void> {
  try {
    const db = await getDb();
    db.prepare(
      "INSERT INTO event_log (event_type, payload) VALUES (?, ?)"
    ).run(
      "tool_call",
      JSON.stringify({ tool: toolName, error: isError, duration_ms: durationMs })
    );
  } catch {
    // Best-effort — never fail the tool
  }
}

/**
 * Wrap a tool handler with telemetry logging.
 * Returns a new handler that logs timing and success/failure.
 */
export function withTelemetry(toolName: string, handler: ToolHandler): ToolHandler {
  return async (...args: any[]) => {
    const start = Date.now();
    const result = await handler(...args);
    const duration = Date.now() - start;
    const isError = result?.isError ?? false;

    // Fire and forget — don't await
    logToolEvent(toolName, isError, duration).catch(() => {});

    return result;
  };
}

/**
 * Helper to register a tool with automatic telemetry.
 * Drop-in replacement for server.registerTool().
 */
export function registerToolWithTelemetry(
  server: McpServer,
  name: string,
  config: { description: string; inputSchema: any },
  handler: ToolHandler
): void {
  server.registerTool(name, config, withTelemetry(name, handler));
}
