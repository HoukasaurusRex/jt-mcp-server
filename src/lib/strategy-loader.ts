import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface StrategyParam {
  required: boolean;
  description: string;
}

export interface Strategy {
  name: string;
  description: string;
  pattern: string;
  params: Record<string, StrategyParam>;
  body: string;
  filePath: string;
}

export interface MatchResult {
  strategy: Strategy;
  values: Record<string, string>;
}

export async function parseStrategyFile(filePath: string): Promise<Strategy> {
  const raw = await readFile(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid strategy file (missing frontmatter): ${filePath}`);
  }

  const frontmatter = parseYaml(match[1]);
  const body = match[2].trim();

  if (!frontmatter.name || !frontmatter.pattern) {
    throw new Error(`Strategy file missing required fields (name, pattern): ${filePath}`);
  }

  const params: Record<string, StrategyParam> = {};
  if (frontmatter.params) {
    for (const [key, val] of Object.entries(frontmatter.params)) {
      const v = val as Record<string, unknown>;
      params[key] = {
        required: v.required !== false,
        description: String(v.description ?? ""),
      };
    }
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description ?? "",
    pattern: frontmatter.pattern,
    params,
    body,
    filePath,
  };
}

export async function loadStrategies(dir: string): Promise<Strategy[]> {
  try {
    await access(dir);
  } catch {
    return [];
  }

  const files = await readdir(dir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  const strategies: Strategy[] = [];
  for (const file of mdFiles) {
    try {
      strategies.push(await parseStrategyFile(join(dir, file)));
    } catch {
      // skip malformed files
    }
  }

  // sort by pattern token count descending (more specific first)
  strategies.sort(
    (a, b) => b.pattern.split(/\s+/).length - a.pattern.split(/\s+/).length
  );

  return strategies;
}

export function matchStrategy(
  command: string,
  strategies: Strategy[]
): MatchResult | null {
  const cmdTokens = command.trim().split(/\s+/);

  for (const strategy of strategies) {
    const patTokens = strategy.pattern.trim().split(/\s+/);
    const values: Record<string, string> = {};
    let cmdIdx = 0;
    let matched = true;

    for (let i = 0; i < patTokens.length; i++) {
      const pat = patTokens[i];
      const paramMatch = pat.match(/^\{(\w+)\}$/);

      if (paramMatch) {
        const paramName = paramMatch[1];
        if (cmdIdx >= cmdTokens.length) {
          // no token available for this param
          matched = false;
          break;
        }
        if (i === patTokens.length - 1) {
          // last token in pattern: capture all remaining
          values[paramName] = cmdTokens.slice(cmdIdx).join(" ");
          cmdIdx = cmdTokens.length;
        } else {
          values[paramName] = cmdTokens[cmdIdx];
          cmdIdx++;
        }
      } else {
        // literal token — must match exactly (case-insensitive)
        if (
          cmdIdx >= cmdTokens.length ||
          cmdTokens[cmdIdx].toLowerCase() !== pat.toLowerCase()
        ) {
          matched = false;
          break;
        }
        cmdIdx++;
      }
    }

    if (matched) {
      return { strategy, values };
    }
  }

  return null;
}

export function expandTemplate(
  body: string,
  values: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}
