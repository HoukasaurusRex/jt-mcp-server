# jt-mcp-server

[![CI](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@houkasaurusrex/jt-mcp-server)](https://www.npmjs.com/package/@houkasaurusrex/jt-mcp-server)

Personal [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents dev workflow tools — GitHub project management, conventional commits, static file serving, nvm-aware command execution, visual regression testing, and more.

## Quick Start

```bash
npx @houkasaurusrex/jt-mcp-server
```

## Add to Claude Code

In your project's `.claude/settings.json`:

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

## Tools

### Dev Workflow

| Tool | Description |
|------|-------------|
| `dev_serve` | Serve a directory on a port. Kills existing process on that port, starts `serve -s`, waits for 200 response, returns URL. |
| `dev_serve_stop` | Stop a dev server by port. |
| `dev_run` | Run a shell command with optional nvm Node version, working directory, and env vars. Resolves Node binary directly from `~/.nvm/versions/node/`. |
| `dev_port` | Port management — `check` what's using a port, `kill` process on a port, `wait_ready` until a port accepts connections. |
| `dev_worktree` | Git worktree lifecycle — `create` (checkout + install deps), `build` (run build command), `remove` (clean up). Worktrees live at `.claude/worktrees/<branch>/`. |
| `dev_install` | Install project dependencies using the correct package manager (auto-detected from lockfile). Supports frozen/immutable lockfile mode for CI. |
| `dev_script` | Run a package.json script by name with the correct package manager. Validates the script exists and lists available scripts on error. |
| `dev_deps` | Add or remove npm packages using the correct package manager. Supports devDependencies. |
| `dev_visual_regression` | Orchestrate a full Playwright visual regression cycle: serve reference dir, capture baselines, serve test dir, run comparison, return results. |

### GitHub

| Tool | Description |
|------|-------------|
| `github_project_next_issue` | Get the oldest "Todo" issue from a GitHub ProjectV2 board. |
| `github_project_set_status` | Update a project item's status (Todo / In Progress / Done). |
| `github_project_complete_issue` | Close a GitHub issue and set its project board status to Done in one call. |
| `github_create_pr` | Create a pull request via `gh` CLI. |

### Git

| Tool | Description |
|------|-------------|
| `git_conventional_commit` | Stage files and create a conventional commit. Validates message format, refuses to stage `.env` or `node_modules`. |

### Shell

| Tool | Description |
|------|-------------|
| `shell_lint` | Run ShellCheck on shell scripts. Returns structured JSON findings with file, line, level, and message. |

### Netlify

| Tool | Description |
|------|-------------|
| `netlify_deploy_status` | Check the latest deploy status for a Netlify site. |

### Memory (Knowledge Graph)

| Tool | Description |
|------|-------------|
| `memory_add_entities` | Create entities (preferences, tools, projects, conventions) with a name, type, and observations. |
| `memory_add_relations` | Create typed directed relations between entities (e.g. PREFERS, USES, AVOIDS). |
| `memory_add_observations` | Add facts or notes to an existing entity. |
| `memory_query` | Search and traverse the knowledge graph by name, type, or relation. |
| `memory_delete` | Delete entities (cascades), relations, or observations. |
| `memory_export` | Export the entire graph as JSON. |
| `memory_import` | Import a graph from JSON (merge or replace). |

## Using the Memory Database

The memory tools provide a persistent knowledge graph that agents can use to remember user preferences, project conventions, and facts across sessions. Data is stored in a SQLite database at `~/.jt-memory/memory.db` and auto-exported to `~/.jt-memory/memory.json` on every write.

### Enabling memory in a project

Add the following to your project's `CLAUDE.md` so the agent knows to use memory at the start of each session:

```markdown
## Memory

This project uses `@houkasaurusrex/jt-mcp-server` memory tools. At the start of every session:
1. Call `memory_query` with no filters to load all stored context
2. Use the returned entities, observations, and relations to inform your work
3. When you learn new user preferences or project conventions, store them with `memory_add_entities` and `memory_add_observations`
```

### How it works

- **Entities** have a name, type, and observations (facts). Types include `preference`, `convention`, `project`, `tool`, `workflow`, etc.
- **Relations** are directed edges between entities (e.g. `JT` --PREFERS--> `Yarn Berry`).
- **Observations** are string facts attached to an entity (e.g. "Always uses single-line conventional commits").
- The database persists at `~/.jt-memory/memory.db` across all projects and sessions.
- Every write auto-exports to `~/.jt-memory/memory.json` as a human-readable backup.
- Override paths with `JT_MEMORY_DB` and `JT_MEMORY_EXPORT_PATH` env vars.

### Example: storing a preference

```json
{ "entities": [{ "name": "commits", "type": "convention", "observations": ["Single-line conventional commits", "No Co-Authored-By trailers"] }] }
```

### Example: querying at session start

```json
{}                                // returns all entities
{ "type": "preference" }         // returns only preferences
{ "name": "yarn", "depth": 2 }   // traverse 2 levels from matching entities
```

## Environment Variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub tools (PAT with `repo` + `project` scopes) |
| `NETLIFY_AUTH_TOKEN` | Netlify tools |

## Development

```bash
yarn install
yarn build
yarn test
yarn test <pattern>   # e.g. yarn test dev-port
```

## License

MIT
