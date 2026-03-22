import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlanFromTicketSchema, PlanReviewSchema } from "../types.js";
import type { PlanFromTicketInput, PlanReviewInput } from "../types.js";
import { textResult, errorResult, catchToolError } from "../lib/tool-result.js";
import { registerToolWithTelemetry } from "../lib/tool-telemetry.js";
import { loadStrategies } from "../lib/strategy-loader.js";
import { atlassianFetch } from "../lib/atlassian-client.js";
import { execa } from "execa";

const PLAN_TICKET_FALLBACK = `Analyze the ticket above and the codebase to produce an implementation plan.

1. Parse the ticket for requirements, acceptance criteria, and constraints
2. Use available tools (dev_grep, dev_find, dev_read, dev_tree) to explore affected areas of the codebase
3. Query memory for related project context (memory_query with semantic search)
4. Produce a plan with these sections:
   - **Summary**: What needs to be done and why (1-2 sentences)
   - **Affected Files**: List of files to create/modify/delete
   - **Implementation Steps**: Ordered list with enough detail to implement
   - **Edge Cases**: Potential issues, error scenarios, boundary conditions
   - **Test Plan**: What to test and how to verify
   - **Complexity**: Low / Medium / High with brief justification`;

const REVIEW_PLAN_FALLBACK = `Review the implementation plan for quality and completeness.

1. **Edge cases**: Identify missing error handling, boundary conditions, race conditions
2. **Simpler alternatives**: Flag any over-engineered steps that could be simplified
3. **Creative solutions**: Suggest approaches not considered (existing utilities, libraries, patterns in the codebase)
4. **Dependency order**: Verify steps are in the right order and nothing is missing
5. **Test coverage**: Check that edge cases from step 1 are covered in the test plan

Then produce an optimized version of the plan:
- Ordered file changes with exact paths
- Explicit done-criteria per step
- Validation commands (test/build/lint) after each logical group
- Self-contained — works without prior conversation context

Finally, save the optimized plan to a file and suggest:
- CLI: \`claude --model sonnet -p "implement the plan in <path>"\`
- IDE: Open a new session with Sonnet model selected and paste the plan`;

interface TicketRef {
  source: "jira" | "github";
  key?: string;
  number?: number;
  repo?: string;
}

export function parseTicket(ticket: string): TicketRef {
  // Jira key: e.g. PROJ-123, ABC-1
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(ticket)) {
    return { source: "jira", key: ticket };
  }

  // GitHub URL: https://github.com/owner/repo/issues/42
  const urlMatch = ticket.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
  if (urlMatch) {
    return { source: "github", repo: urlMatch[1], number: parseInt(urlMatch[2], 10) };
  }

  // GitHub issue number: #42 or 42
  const numMatch = ticket.match(/^#?(\d+)$/);
  if (numMatch) {
    return { source: "github", number: parseInt(numMatch[1], 10) };
  }

  throw new Error(
    `Unrecognized ticket format: "${ticket}". ` +
    "Expected a Jira key (PROJ-123), GitHub issue number (42 or #42), " +
    "or GitHub issue URL (https://github.com/owner/repo/issues/42)."
  );
}

async function loadTemplateByName(name: string, dir: string, fallback: string): Promise<string> {
  const strategies = await loadStrategies(dir);
  const match = strategies.find((s) => s.name === name);
  return match?.body ?? fallback;
}

export function register(server: McpServer): void {
  registerToolWithTelemetry(
    server,
    "plan_from_ticket",
    {
      description:
        "Fetch a Jira or GitHub ticket and compose it with codebase context to produce an implementation plan. " +
        "Returns ticket data, file tree, and planning instructions. " +
        "After receiving the plan, use plan_review to optimize it before implementation.",
      inputSchema: PlanFromTicketSchema,
    },
    async ({ ticket, repo, cwd, strategies_dir }: PlanFromTicketInput) => {
      try {
        const ref = parseTicket(ticket);

        // --- Fetch ticket data ---
        let ticketData: string;

        if (ref.source === "jira") {
          if (!process.env.ATLASSIAN_DOMAIN) {
            return errorResult(
              `Ticket "${ticket}" looks like a Jira key but ATLASSIAN_DOMAIN is not set. ` +
              "Set ATLASSIAN_DOMAIN, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN to use Jira tickets."
            );
          }
          const res = await atlassianFetch(`/rest/api/3/issue/${ref.key}`);
          if (!res.ok) {
            return errorResult(`Jira API error (${res.status}): ${JSON.stringify(res.data)}`);
          }
          ticketData = JSON.stringify(res.data, null, 2);
        } else {
          const targetRepo = ref.repo ?? repo;
          const args = [
            "issue", "view", String(ref.number),
            "--json", "title,body,labels,assignees,milestone,url,state",
          ];
          if (targetRepo) args.push("-R", targetRepo);
          try {
            const result = await execa("gh", args, cwd ? { cwd } : {});
            ticketData = result.stdout;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("ENOENT") || msg.includes("not found")) {
              return errorResult("GitHub CLI (gh) is not installed or not in PATH.");
            }
            return errorResult(`gh issue view failed: ${msg}`);
          }
        }

        // --- File tree (optional, truncated) ---
        let fileTree = "";
        if (cwd) {
          try {
            const result = await execa("git", ["ls-tree", "-r", "--name-only", "HEAD"], { cwd });
            const lines = result.stdout.split("\n");
            const MAX_TREE_LINES = 500;
            fileTree =
              lines.length > MAX_TREE_LINES
                ? lines.slice(0, MAX_TREE_LINES).join("\n") +
                  `\n... (${lines.length - MAX_TREE_LINES} more files)`
                : result.stdout;
          } catch {
            // not a git repo or no commits — skip silently
          }
        }

        // --- Load strategy prompt ---
        const prompt = await loadTemplateByName("plan_ticket", strategies_dir, PLAN_TICKET_FALLBACK);

        // --- Compose output ---
        const sections = [
          "# Ticket Data\n\n" + ticketData,
          fileTree ? "# File Tree\n\n" + fileTree : "",
          "# Instructions\n\n" + prompt,
        ].filter(Boolean);

        return textResult(sections.join("\n\n---\n\n"));
      } catch (err) {
        return catchToolError(err);
      }
    }
  );

  registerToolWithTelemetry(
    server,
    "plan_review",
    {
      description:
        "Review and optimize an implementation plan for edge cases, simpler alternatives, and missing considerations. " +
        "Returns review instructions and Sonnet handoff guidance. " +
        "Pair with plan_from_ticket for the full ticket-to-implementation workflow.",
      inputSchema: PlanReviewSchema,
    },
    async ({ plan, strategies_dir }: PlanReviewInput) => {
      try {
        const prompt = await loadTemplateByName("review_plan", strategies_dir, REVIEW_PLAN_FALLBACK);

        const sections = [
          plan ? "# Plan to Review\n\n" + plan : "",
          "# Review Instructions\n\n" + prompt,
        ].filter(Boolean);

        return textResult(sections.join("\n\n---\n\n"));
      } catch (err) {
        return catchToolError(err);
      }
    }
  );
}
