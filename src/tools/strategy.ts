import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StrategyExpandSchema, StrategyListSchema } from "../types.js";
import type { StrategyExpandInput, StrategyListInput } from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";
import { registerToolWithTelemetry } from "../lib/tool-telemetry.js";
import {
  loadStrategies,
  matchStrategy,
  expandTemplate,
} from "../lib/strategy-loader.js";

export function register(server: McpServer): void {
  registerToolWithTelemetry(server,
    "strategy_expand",
    {
      description:
        "Expand a short command into a rich strategy prompt. " +
        "Matches the command against strategy templates in ~/.jt-strategies/ " +
        "and returns the filled-in prompt with parameters substituted. " +
        "IMPORTANT: Call this tool first when the user gives a short imperative " +
        "command that could match a strategy template (e.g. 'review pr X', 'debug deploy X').",
      inputSchema: StrategyExpandSchema,
    },
    async ({ command, strategies_dir }: StrategyExpandInput) => {
      try {
        const strategies = await loadStrategies(strategies_dir);
        if (strategies.length === 0) {
          return errorResult(
            `No strategies found in ${strategies_dir}. ` +
              "Create .md files with YAML frontmatter (name, pattern, params) and a template body."
          );
        }

        const result = matchStrategy(command, strategies);
        if (!result) {
          const available = strategies
            .map((s) => `  ${s.pattern} — ${s.description}`)
            .join("\n");
          return errorResult(
            `No strategy matched "${command}". Available strategies:\n${available}`
          );
        }

        // check required params
        for (const [name, param] of Object.entries(result.strategy.params)) {
          if (param.required && !result.values[name]) {
            return errorResult(
              `Missing required parameter: {${name}} — ${param.description}`
            );
          }
        }

        const expanded = expandTemplate(result.strategy.body, result.values);
        return textResult(expanded);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  registerToolWithTelemetry(server,
    "strategy_list",
    {
      description:
        "List all available strategy templates with names, descriptions, and usage patterns.",
      inputSchema: StrategyListSchema,
    },
    async ({ strategies_dir }: StrategyListInput) => {
      try {
        const strategies = await loadStrategies(strategies_dir);
        if (strategies.length === 0) {
          return textResult(
            `No strategies found in ${strategies_dir}. ` +
              "Create .md files with YAML frontmatter (name, pattern, params) and a template body."
          );
        }

        const output = strategies
          .map((s) => {
            const paramList = Object.entries(s.params)
              .map(
                ([k, v]) =>
                  `    {${k}}: ${v.description}${v.required ? " (required)" : ""}`
              )
              .join("\n");
            return [
              s.name,
              `  ${s.description}`,
              `  Pattern: ${s.pattern}`,
              paramList ? `  Params:\n${paramList}` : "  Params: none",
            ].join("\n");
          })
          .join("\n\n");

        return textResult(output);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
