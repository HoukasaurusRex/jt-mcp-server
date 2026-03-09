import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { resolve, relative } from "node:path";
import { readFile, stat, readdir } from "node:fs/promises";
import {
  DevGrepSchema,
  DevFindSchema,
  DevReadSchema,
  DevTreeSchema,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

/** Ensure a path is inside the project root (prevents traversal). */
function assertInside(filePath: string, root: string): void {
  const resolved = resolve(filePath);
  const resolvedRoot = resolve(root);
  if (!resolved.startsWith(resolvedRoot + "/") && resolved !== resolvedRoot) {
    throw new Error(
      `Path "${filePath}" is outside project root "${root}"`
    );
  }
}

export function register(server: McpServer): void {
  // ── dev_grep ──────────────────────────────────────────────────────
  server.registerTool(
    "dev_grep",
    {
      description:
        "Search file contents for a pattern (regex or literal) within a project directory. " +
        "Respects .gitignore, supports glob filtering and context lines. " +
        "Returns matching lines with file paths and line numbers.",
      inputSchema: DevGrepSchema,
    },
    async ({
      pattern,
      cwd,
      glob,
      fixed_strings,
      case_insensitive,
      context_lines,
      max_results,
      files_only,
    }) => {
      try {
        const args: string[] = [
          "--color=never",
          "--no-heading",
          "--line-number",
        ];

        if (fixed_strings) args.push("--fixed-strings");
        if (case_insensitive) args.push("--ignore-case");
        if (files_only) {
          args.push("--files-with-matches");
        } else {
          args.push(`--context=${context_lines}`);
        }
        if (glob) args.push(`--glob=${glob}`);
        args.push(`--max-count=${max_results}`);
        args.push("--", pattern);

        const result = await execa("rg", args, {
          cwd,
          reject: false,
          timeout: 30000,
        });

        // rg exit 0 = matches, 1 = no matches, 2+ = error
        if ((result.exitCode ?? 0) > 1) {
          return errorResult(
            `ripgrep error: ${result.stderr || result.stdout}`
          );
        }

        if (result.exitCode === 1 || !result.stdout.trim()) {
          return textResult("No matches found.");
        }

        // Truncate output if needed
        const lines = result.stdout.split("\n");
        const limit = max_results * (1 + context_lines * 2 + 1); // generous limit
        if (lines.length > limit) {
          return textResult(
            lines.slice(0, limit).join("\n") +
              `\n\n… (output truncated at ${limit} lines)`
          );
        }

        return textResult(result.stdout);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          return errorResult(
            "ripgrep (rg) not found. Install it: brew install ripgrep (macOS) or apt install ripgrep (Linux)"
          );
        }
        return errorResult(msg);
      }
    }
  );

  // ── dev_find ──────────────────────────────────────────────────────
  server.registerTool(
    "dev_find",
    {
      description:
        "Find files and directories by glob pattern within a project directory. " +
        "Respects .gitignore. Returns relative paths sorted alphabetically.",
      inputSchema: DevFindSchema,
    },
    async ({ pattern, cwd, type, max_results }) => {
      try {
        const args: string[] = ["--color=never"];

        if (type === "file") args.push("--type=file");
        else if (type === "directory") args.push("--type=directory");

        args.push("--glob", pattern);
        args.push("--max-results", String(max_results));

        const result = await execa("fd", args, {
          cwd,
          reject: false,
          timeout: 30000,
        });

        if ((result.exitCode ?? 0) > 1) {
          return errorResult(`fd error: ${result.stderr || result.stdout}`);
        }

        if (!result.stdout.trim()) {
          return textResult("No files found.");
        }

        const paths = result.stdout.trim().split("\n").sort();
        return textResult(paths.join("\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          // Fallback: use git ls-files + glob matching if fd not installed
          return await findWithGit(pattern, cwd, type, max_results);
        }
        return errorResult(msg);
      }
    }
  );

  // ── dev_read ──────────────────────────────────────────────────────
  server.registerTool(
    "dev_read",
    {
      description:
        "Read the contents of a file within a project directory. " +
        "Supports line ranges. Returns numbered lines. " +
        "The file must be inside the specified project directory (path traversal is blocked).",
      inputSchema: DevReadSchema,
    },
    async ({ path: filePath, cwd, start_line, end_line, max_lines }) => {
      try {
        const absPath = resolve(filePath);
        assertInside(absPath, cwd);

        const info = await stat(absPath);
        if (!info.isFile()) {
          return errorResult(`Not a file: ${filePath}`);
        }

        // Block binary files (heuristic: check first 8KB)
        const raw = await readFile(absPath);
        if (raw.length > 0) {
          const sample = raw.subarray(0, 8192);
          if (sample.includes(0)) {
            return errorResult(
              `Binary file detected: ${filePath} (${info.size} bytes)`
            );
          }
        }

        const content = raw.toString("utf-8");
        let lines = content.split("\n");

        // Apply line range
        const start = (start_line ?? 1) - 1;
        const end = end_line ?? lines.length;
        lines = lines.slice(start, end);

        // Enforce max_lines
        let truncated = false;
        if (lines.length > max_lines) {
          lines = lines.slice(0, max_lines);
          truncated = true;
        }

        // Format with line numbers
        const numbered = lines.map(
          (line, i) => `${String(start + i + 1).padStart(6)}  ${line}`
        );

        let output = numbered.join("\n");
        if (truncated) {
          output += `\n\n… (truncated at ${max_lines} lines, file has ${content.split("\n").length} total)`;
        }

        const relPath = relative(cwd, absPath);
        return textResult(`── ${relPath} ──\n${output}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── dev_tree ──────────────────────────────────────────────────────
  server.registerTool(
    "dev_tree",
    {
      description:
        "Display the directory tree structure of a project. " +
        "Skips node_modules, .git, and common build artifacts by default. " +
        "Useful for understanding project layout.",
      inputSchema: DevTreeSchema,
    },
    async ({ cwd, depth, include_hidden, directories_only }) => {
      try {
        const SKIP = new Set([
          "node_modules",
          ".git",
          "dist",
          "build",
          "coverage",
          ".next",
          ".nuxt",
          ".cache",
          ".yarn",
          "__pycache__",
          ".tox",
          "target",
          ".turbo",
        ]);

        const lines: string[] = [];
        let count = 0;
        const MAX_ENTRIES = 2000;

        async function walk(
          dir: string,
          prefix: string,
          currentDepth: number
        ): Promise<void> {
          if (currentDepth > depth || count >= MAX_ENTRIES) return;

          let entries = await readdir(dir, { withFileTypes: true });

          // Filter hidden
          if (!include_hidden) {
            entries = entries.filter((e) => !e.name.startsWith("."));
          }

          // Filter skipped directories
          entries = entries.filter((e) => !SKIP.has(e.name));

          // Filter directories only
          if (directories_only) {
            entries = entries.filter((e) => e.isDirectory());
          }

          // Sort: directories first, then alphabetical
          entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) {
              return a.isDirectory() ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          for (let i = 0; i < entries.length; i++) {
            if (count >= MAX_ENTRIES) {
              lines.push(`${prefix}… (truncated at ${MAX_ENTRIES} entries)`);
              return;
            }

            const entry = entries[i];
            const isLast = i === entries.length - 1;
            const connector = isLast ? "└── " : "├── ";
            const childPrefix = isLast ? "    " : "│   ";

            const suffix = entry.isDirectory() ? "/" : "";
            lines.push(`${prefix}${connector}${entry.name}${suffix}`);
            count++;

            if (entry.isDirectory()) {
              await walk(
                resolve(dir, entry.name),
                prefix + childPrefix,
                currentDepth + 1
              );
            }
          }
        }

        const base = resolve(cwd);
        lines.push(relative(process.cwd(), base) || ".");
        await walk(base, "", 1);

        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}

/** Fallback file finder using git ls-files when fd is not installed. */
async function findWithGit(
  pattern: string,
  cwd: string,
  type: string,
  maxResults: number
) {
  try {
    const result = await execa("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd,
      reject: false,
      timeout: 30000,
    });

    if (result.exitCode !== 0) {
      return errorResult(
        "fd not found and git ls-files failed. Install fd: brew install fd (macOS) or apt install fd-find (Linux)"
      );
    }

    // Simple glob matching via minimatch-style conversion
    const files = result.stdout.trim().split("\n").filter(Boolean);
    const regex = globToRegex(pattern);
    const matched = files.filter((f) => regex.test(f));

    if (type === "directory") {
      const dirs = new Set<string>();
      for (const f of matched) {
        const parts = f.split("/");
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join("/"));
        }
      }
      const sorted = [...dirs].sort().slice(0, maxResults);
      return textResult(sorted.length > 0 ? sorted.join("\n") : "No directories found.");
    }

    const sorted = matched.sort().slice(0, maxResults);
    return textResult(sorted.length > 0 ? sorted.join("\n") : "No files found.");
  } catch {
    return errorResult(
      "fd not found and git fallback failed. Install fd: brew install fd (macOS)"
    );
  }
}

/** Convert a simple glob pattern to a RegExp. */
function globToRegex(glob: string): RegExp {
  let re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "⟦GLOBSTAR⟧")
    .replace(/\*/g, "[^/]*")
    .replace(/⟦GLOBSTAR⟧/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(re);
}
