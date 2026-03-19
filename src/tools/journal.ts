import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { JournalLogSchema } from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";

const HOME = process.env.HOME ?? "/tmp";

/** Auto-discover git repos under ~/code/ (one level deep). */
async function discoverRepos(): Promise<string[]> {
  const codeDir = join(HOME, "code");
  try {
    const { stdout } = await execa("find", [
      codeDir,
      "-maxdepth",
      "2",
      "-name",
      ".git",
      "-type",
      "d",
    ]);
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/\/\.git$/, ""));
  } catch {
    return [];
  }
}

/** Get concise git log summary for a repo in a time window. */
async function repoLog(
  repo: string,
  since: string,
  until: string
): Promise<{ repo: string; commits: string[] }> {
  try {
    const { stdout } = await execa(
      "git",
      [
        "log",
        "--all",
        `--author=${(await execa("git", ["config", "user.email"], { cwd: repo })).stdout}`,
        `--since=${since}`,
        `--until=${until}`,
        "--pretty=format:%s",
      ],
      { cwd: repo }
    );
    const commits = stdout.split("\n").filter(Boolean);
    return { repo: repo.split("/").pop() ?? repo, commits };
  } catch {
    return { repo: repo.split("/").pop() ?? repo, commits: [] };
  }
}

/** Build a terse standup line from commit messages across repos. */
function buildStandupLine(
  results: { repo: string; commits: string[] }[]
): string {
  const parts: string[] = [];
  for (const { repo, commits } of results) {
    if (commits.length === 0) continue;
    // Deduplicate and strip conventional-commit prefixes for brevity
    const unique = [
      ...new Set(
        commits.map((c) =>
          c.replace(/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+?\))?!?:\s*/, "")
        )
      ),
    ];
    parts.push(`${repo}: ${unique.join(", ")}`);
  }
  if (parts.length === 0) return "";
  return `- ${parts.join("; ")}`;
}

export function register(server: McpServer): void {
  server.registerTool(
    "journal_log",
    {
      description:
        "Evaluate git work done in a time period and append a concise standup line to the daily journal draft.",
      inputSchema: JournalLogSchema,
    },
    async ({ since, until, repos, journal_dir, date, dry_run }) => {
      try {
        const now = new Date();
        const effectiveSince = since ?? now.toISOString().slice(0, 10);
        const effectiveUntil = until ?? "now";
        const effectiveDate =
          date ?? now.toISOString().slice(0, 10);

        // Discover or use provided repos
        const repoPaths = repos && repos.length > 0 ? repos : await discoverRepos();
        if (repoPaths.length === 0) {
          return errorResult("No git repos found. Provide repos[] or ensure ~/code/ has git repos.");
        }

        // Collect logs in parallel
        const results = await Promise.all(
          repoPaths.map((r) => repoLog(r, effectiveSince, effectiveUntil))
        );

        const line = buildStandupLine(results);
        if (!line) {
          return textResult("No commits found in the given time period.");
        }

        if (dry_run) {
          return textResult(`[dry run] Would append:\n${line}`);
        }

        // Find or validate journal file
        const draftPath = join(journal_dir, `${effectiveDate}.draft.md`);
        const publishedPath = join(journal_dir, `${effectiveDate}.md`);

        let targetPath: string;
        try {
          await access(draftPath);
          targetPath = draftPath;
        } catch {
          try {
            await access(publishedPath);
            targetPath = publishedPath;
          } catch {
            return errorResult(
              `No journal file found for ${effectiveDate}. Create one first (e.g. yarn new-entry journal).`
            );
          }
        }

        // Append line to end of file
        const content = await readFile(targetPath, "utf-8");
        const updated = content.trimEnd() + "\n" + line + "\n";
        await writeFile(targetPath, updated, "utf-8");

        return textResult(`Appended to ${targetPath}:\n${line}`);
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
