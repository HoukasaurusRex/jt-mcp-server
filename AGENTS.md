# Contributing Agent Prompt

Copy this prompt when asking an AI agent (Claude Code or similar) to work on this repo.

---

## Context

You are contributing to `jt-mcp-server`, a personal [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server written in TypeScript. It exposes reusable tools for AI agents — a persistent knowledge graph with semantic search, GitHub project management, conventional commits, PR creation, and integrations with Jira, Confluence, and Netlify.

**Repo:** https://github.com/HoukasaurusRex/jt-mcp-server
**Project board:** https://github.com/users/HoukasaurusRex/projects/15
**Language:** TypeScript (strict, ESM, Node 24+)
**Key deps:** `@modelcontextprotocol/sdk`, `@octokit/graphql`, `execa`, `sql.js`, `zod`

---

## Session Workflow

Follow this sequence every session:

1. **Load context** — call `memory_context` to load preferences, project knowledge, and recent entities
2. **Get the next issue** — query GitHub project #15 for the oldest open "Todo" issue
3. **Move to In Progress** — update the item's Status field to "In Progress" via GraphQL
4. **Implement** — write the tool or feature described in the issue; add a test in `src/__tests__/`
5. **Commit** — single-line conventional commit, e.g. `feat: add github_project_start_issue tool`
   - No `Co-Authored-By` trailers
   - No multiline body
6. **Close and mark Done** — close the GitHub issue, set project status to "Done"
7. **Store learnings** — call `memory_learn` with any new insights discovered during the session

### GraphQL IDs (project #15)

| Field | Value |
|-------|-------|
| Project ID | `PVT_kwHOAWmP0M4BQ4Fi` |
| Status field ID | `PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k` |
| Todo | `f75ad846` |
| In Progress | `47fc9ee4` |
| Done | `98236657` |

---

## Architecture

```
src/
├── index.ts              # Entry — registers core + conditional tools, MCP resources
├── tools/
│   ├── memory.ts         # Knowledge graph: query, learn, context, reflect, CRUD, export
│   ├── github.ts         # GitHub ProjectV2 GraphQL + PR creation
│   ├── git.ts            # Conventional commit with forbidden file blocking
│   ├── jira.ts           # Jira REST API (conditional: ATLASSIAN_DOMAIN)
│   ├── confluence.ts     # Confluence REST API (conditional: ATLASSIAN_DOMAIN)
│   ├── netlify.ts        # Netlify deploy status/logs (conditional: NETLIFY_AUTH_TOKEN)
│   ├── search.ts         # grep/find/read/tree (conditional: JT_MCP_ENABLE_SEARCH)
│   ├── dev-worktree.ts   # Git worktree lifecycle
│   ├── dev-visual-regression.ts  # Playwright visual regression orchestration
│   ├── journal.ts        # Git-to-standup journal entries
│   └── strategy.ts       # Prompt expansion from ~/.jt-strategies/
├── resources/
│   └── memory.ts         # MCP resources: memory://preferences, recent, project/{name}, graph/export
├── lib/
│   ├── memory-db.ts      # sql.js SQLite with compat layer, schema + migrations
│   ├── embeddings.ts     # Ollama embedding provider with graceful degradation
│   ├── vector-search.ts  # Pure JS cosine similarity for semantic search
│   ├── tool-telemetry.ts # Wraps tool registration with event_log telemetry
│   ├── tool-result.ts    # textResult(), errorResult(), catchToolError()
│   ├── atlassian-client.ts  # Shared Jira/Confluence REST client with singleton auth
│   ├── port-utils.ts     # Port check/kill/wait (used by visual regression)
│   ├── nvm-utils.ts      # NVM version resolution (used by worktree)
│   └── strategy-loader.ts  # Load strategy templates from disk
├── __tests__/            # One test file per tool file
└── types.ts              # Shared Zod schemas and inferred types
```

Each tool file exports a `register(server: McpServer): void` function. Non-memory tools use `registerToolWithTelemetry()` to auto-log calls to `event_log`.

---

## Code Conventions

- **Zod** for all input schemas — define schema in `types.ts`, import into tool file
- **`execa`** (not `child_process`) for shelling out to `gh`, `git`, `netlify`
- **`@octokit/graphql`** for GitHub GraphQL calls — singleton client with token caching
- **`catchToolError(err)`** in all catch blocks — DRY error wrapper from `tool-result.ts`
- **`registerToolWithTelemetry()`** for all non-memory tools — automatic event logging
- Error handling: return `errorResult(msg)` on failure — never throw
- No `console.log` in handlers; use `server.sendLoggingMessage` if needed
- Commits must not stage `.env`, `.pem`, `.key`, `.npmrc`, credentials, or `node_modules`
- Conditional tool registration: tools gated behind env vars in `index.ts`

---

## Environment Variables

| Var | Purpose |
|-----|---------|
| `GITHUB_TOKEN` | GitHub API auth (PAT with `repo` + `project` scopes) |
| `NETLIFY_AUTH_TOKEN` | Netlify CLI auth (enables Netlify tools) |
| `ATLASSIAN_DOMAIN` | Atlassian instance (enables Jira + Confluence tools) |
| `ATLASSIAN_EMAIL` | Atlassian account email |
| `ATLASSIAN_API_TOKEN` | Atlassian API token |
| `JT_MEMORY_DB` | Custom path for knowledge graph SQLite |
| `JT_MEMORY_EMBEDDING_PROVIDER` | `ollama` (default) or `none` |
| `JT_MCP_ENABLE_SEARCH` | Set to `1` to enable search tools |

---

## Installing in Another Project

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "jt-mcp": {
      "command": "npx",
      "args": ["-y", "@houkasaurusrex/jt-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "NETLIFY_AUTH_TOKEN": "${NETLIFY_AUTH_TOKEN}"
      }
    }
  }
}
```

Then reference tools in `CLAUDE.md` so agents know they are available.
