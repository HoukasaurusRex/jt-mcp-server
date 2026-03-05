# Contributing Agent Prompt

Copy this prompt when asking an AI agent (Claude Code or similar) to work on this repo.

---

## Context

You are contributing to `jt-mcp-server`, a personal [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server written in TypeScript. It exposes reusable tools that JT Houk's AI agents can call across multiple projects — things like GitHub project management, conventional commits, PR creation, and Netlify deploy checks.

**Repo:** https://github.com/HoukasaurusRex/jt-mcp-server  
**Project board:** https://github.com/users/HoukasaurusRex/projects/15  
**Language:** TypeScript (strict, ESM, Node 22+)  
**Key deps:** `@modelcontextprotocol/sdk`, `@octokit/graphql`, `execa`, `zod`

---

## Session Workflow

Follow this sequence every session:

1. **Get the next issue** — query GitHub project #15 for the oldest open "Todo" issue  
2. **Move to In Progress** — update the item's Status field to "In Progress" via GraphQL  
3. **Implement** — write the tool or feature described in the issue; add a test in `src/__tests__/`  
4. **Commit** — single-line conventional commit, e.g. `feat: add github_project_start_issue tool`  
   - No `Co-Authored-By` trailers  
   - No multiline body  
5. **Close and mark Done** — close the GitHub issue, set project status to "Done"

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
├── index.ts          # McpServer entry — registers all tools, connects StdioServerTransport
├── tools/
│   ├── github.ts     # GitHub GraphQL tools (project workflow, PR creation)
│   ├── git.ts        # git_conventional_commit (stages files, validates, commits)
│   └── netlify.ts    # netlify_deploy_status
├── __tests__/        # One test file per tool file
└── types.ts          # Shared Zod schemas and inferred types
```

Each tool file exports a `register(server: McpServer): void` function that calls `server.tool(name, description, zodSchema, handler)`.

---

## Code Conventions

- **Zod** for all input schemas — define schema in `types.ts`, import into tool file  
- **`execa`** (not `child_process`) for shelling out to `gh`, `git`, `netlify`  
- **`@octokit/graphql`** for all GitHub GraphQL calls — auth via `process.env.GITHUB_TOKEN`  
- Error handling: tools should return `{ content: [{ type: 'text', text: errorMessage }], isError: true }` on failure — never throw  
- No `console.log` in tool handlers; use `server.sendLoggingMessage` if debug output is needed  
- Commits must not stage `.env`, credential files, or `node_modules`

---

## Environment Variables

| Var | Purpose |
|-----|---------|
| `GITHUB_TOKEN` | GitHub API auth (PAT with `repo` + `project` scopes) |
| `NETLIFY_AUTH_TOKEN` | Netlify CLI auth |

---

## Installing in Another Project

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "jt-mcp": {
      "command": "npx",
      "args": ["-y", "jt-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "NETLIFY_AUTH_TOKEN": "${NETLIFY_AUTH_TOKEN}"
      }
    }
  }
}
```

Then reference tools in `CLAUDE.md` so agents know they are available.
