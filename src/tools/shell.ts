import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { ShellLintSchema } from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

export function register(server: McpServer): void {
  server.registerTool(
    "shell_lint",
    {
      description: "Run ShellCheck on shell scripts and return structured findings. Requires shellcheck to be installed.",
      inputSchema: ShellLintSchema,
    },
    async ({ files, shell, severity }) => {
      try {
        const result = await execa(
          "shellcheck",
          ["-s", shell, "-S", severity, "-f", "json", ...files],
          { reject: false }
        );

        // Exit code 0 = no findings, 1 = findings present, >1 = error
        if ((result.exitCode ?? 0) > 1) {
          const output = result.stderr || result.stdout;
          return errorResult(`ShellCheck error: ${output}`);
        }

        const findings = result.stdout ? JSON.parse(result.stdout) : [];

        if (findings.length === 0) {
          return textResult(`No issues found in ${files.length} file(s).`);
        }

        const summary = findings.map((f: { file: string; line: number; column: number; level: string; code: number; message: string }) => ({
          file: f.file,
          line: f.line,
          column: f.column,
          level: f.level,
          code: `SC${f.code}`,
          message: f.message,
        }));

        return textResult(JSON.stringify(summary, null, 2));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          return errorResult(
            "shellcheck not found. Install it: brew install shellcheck (macOS) or apt install shellcheck (Linux)"
          );
        }
        return errorResult(msg);
      }
    }
  );
}
